import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { MAX_LIVES, POINTS } from '../engine/scoring'

const STORAGE_KEY = 'event-loop-arena:v1'

export interface LevelRecord {
  levelId: string
  completed: boolean
  score: number
  predictionsCorrect: number
  predictionsTotal: number
  wrongAnswers: number
  violations: number
  hintsUsed: number
  learningMode: boolean
}

export interface GameState {
  score: number
  lives: number
  currentLevelId: string | null
  records: Record<string, LevelRecord>
}

export type CorrectKind = 'prediction' | 'action' | 'explanation' | 'loop'

export type GameEvent =
  | { type: 'open-level'; levelId: string }
  | { type: 'correct'; levelId: string; kind: CorrectKind }
  | { type: 'prediction-missed'; levelId: string }
  | { type: 'wrong'; levelId: string; critical?: boolean }
  | { type: 'violation'; levelId: string }
  | { type: 'hint'; levelId: string }
  | { type: 'complete'; levelId: string; bonus: number }
  | { type: 'reset' }
  | { type: 'hydrate'; state: GameState }

const emptyRecord = (levelId: string): LevelRecord => ({
  levelId,
  completed: false,
  score: 0,
  predictionsCorrect: 0,
  predictionsTotal: 0,
  wrongAnswers: 0,
  violations: 0,
  hintsUsed: 0,
  learningMode: false,
})

export const initialState: GameState = {
  score: 0,
  lives: MAX_LIVES,
  currentLevelId: null,
  records: {},
}

function withRecord(
  state: GameState,
  levelId: string,
  update: (record: LevelRecord) => LevelRecord,
): Record<string, LevelRecord> {
  const record = state.records[levelId] ?? emptyRecord(levelId)
  return { ...state.records, [levelId]: update(record) }
}

function addScore(state: GameState, levelId: string, points: number): GameState {
  return {
    ...state,
    score: Math.max(0, state.score + points),
    records: withRecord(state, levelId, (record) => ({ ...record, score: record.score + points })),
  }
}

export function reducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'hydrate':
      return event.state

    case 'reset':
      return initialState

    case 'open-level': {
      const record = state.records[event.levelId] ?? emptyRecord(event.levelId)
      return {
        ...state,
        currentLevelId: event.levelId,
        // Жизни восстанавливаются на входе в уровень: прогресс не блокируется.
        lives: MAX_LIVES,
        records: { ...state.records, [event.levelId]: { ...record, learningMode: false } },
      }
    }

    case 'correct': {
      const points =
        event.kind === 'prediction'
          ? POINTS.prediction
          : event.kind === 'explanation'
            ? POINTS.explanation
            : event.kind === 'loop'
              ? POINTS.loopStep
              : POINTS.action
      const next = addScore(state, event.levelId, points)
      if (event.kind !== 'prediction') return next
      return {
        ...next,
        records: withRecord(next, event.levelId, (record) => ({
          ...record,
          predictionsCorrect: record.predictionsCorrect + 1,
          predictionsTotal: record.predictionsTotal + 1,
        })),
      }
    }

    case 'prediction-missed':
      return {
        ...state,
        records: withRecord(state, event.levelId, (record) => ({
          ...record,
          predictionsTotal: record.predictionsTotal + 1,
        })),
      }

    case 'wrong': {
      const scored = addScore(state, event.levelId, POINTS.wrongChoice)
      const lives = event.critical ? Math.max(0, scored.lives - 1) : scored.lives
      return {
        ...scored,
        lives,
        records: withRecord(scored, event.levelId, (record) => ({
          ...record,
          wrongAnswers: record.wrongAnswers + 1,
          learningMode: record.learningMode || lives === 0,
        })),
      }
    }

    case 'violation': {
      const scored = addScore(state, event.levelId, POINTS.loopViolation)
      const lives = Math.max(0, scored.lives - 1)
      return {
        ...scored,
        lives,
        records: withRecord(scored, event.levelId, (record) => ({
          ...record,
          violations: record.violations + 1,
          learningMode: record.learningMode || lives === 0,
        })),
      }
    }

    case 'hint': {
      const scored = addScore(state, event.levelId, POINTS.hintUsed)
      return {
        ...scored,
        records: withRecord(scored, event.levelId, (record) => ({
          ...record,
          hintsUsed: record.hintsUsed + 1,
        })),
      }
    }

    case 'complete': {
      const record = state.records[event.levelId] ?? emptyRecord(event.levelId)
      const noHintBonus = record.hintsUsed === 0 ? POINTS.noHintBonus : 0
      const total = event.bonus + noHintBonus
      const scored = addScore(state, event.levelId, total)
      return {
        ...scored,
        records: withRecord(scored, event.levelId, (current) => ({ ...current, completed: true })),
      }
    }

    default:
      return state
  }
}

interface GameContextValue {
  state: GameState
  dispatch: (event: GameEvent) => void
  recordFor: (levelId: string) => LevelRecord
}

const GameContext = createContext<GameContextValue | null>(null)

function load(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<GameState>
    if (typeof parsed.score !== 'number' || typeof parsed.records !== 'object') return initialState
    return {
      score: parsed.score,
      lives: typeof parsed.lives === 'number' ? parsed.lives : MAX_LIVES,
      currentLevelId: parsed.currentLevelId ?? null,
      records: (parsed.records as Record<string, LevelRecord>) ?? {},
    }
  } catch {
    return initialState
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, load)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* приватный режим браузера — просто не сохраняем */
    }
  }, [state])

  const recordFor = useCallback(
    (levelId: string) => state.records[levelId] ?? emptyRecord(levelId),
    [state.records],
  )

  const value = useMemo(() => ({ state, dispatch, recordFor }), [state, recordFor])
  return <GameContext value={value}>{children}</GameContext>
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext)
  if (!value) throw new Error('useGame must be used inside <GameProvider>')
  return value
}
