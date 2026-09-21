import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MAX_LIVES, POINTS } from '../engine/scoring'
import { makeRecord, storedProgress } from '../test/helpers'
import {
  GameProvider,
  STORAGE_KEY,
  initialState,
  reducer,
  useGame,
  type GameEvent,
  type GameState,
} from './gameStore'

const LEVEL = 'level1'

function apply(events: GameEvent[], from: GameState = initialState): GameState {
  return events.reduce(reducer, from)
}

describe('прогресс игрока (reducer)', () => {
  it('новая игра — ноль очков, полные жизни, пустая история', () => {
    expect(initialState).toEqual({ score: 0, lives: MAX_LIVES, currentLevelId: null, records: {} })
  })

  describe('вход в уровень', () => {
    it('заводит запись уровня и запоминает текущий уровень', () => {
      const state = apply([{ type: 'open-level', levelId: LEVEL }])

      expect(state.currentLevelId).toBe(LEVEL)
      expect(state.records[LEVEL]).toEqual(makeRecord(LEVEL))
    })

    it('возвращает жизни и выключает Learning Mode — уровень можно переиграть', () => {
      const state = apply([
        { type: 'open-level', levelId: LEVEL },
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'open-level', levelId: LEVEL },
      ])

      expect(state.lives).toBe(MAX_LIVES)
      expect(state.records[LEVEL].learningMode).toBe(false)
      expect(state.records[LEVEL].wrongAnswers).toBe(3)
    })

    it('не стирает результат уже пройденного уровня', () => {
      const state = apply([
        { type: 'open-level', levelId: LEVEL },
        { type: 'correct', levelId: LEVEL, kind: 'prediction' },
        { type: 'complete', levelId: LEVEL, bonus: 100 },
        { type: 'open-level', levelId: LEVEL },
      ])

      expect(state.records[LEVEL].completed).toBe(true)
      expect(state.records[LEVEL].score).toBeGreaterThan(0)
    })
  })

  describe('начисление очков', () => {
    it('верный прогноз — 100 очков и плюс к статистике прогнозов', () => {
      const state = apply([{ type: 'correct', levelId: LEVEL, kind: 'prediction' }])

      expect(state.score).toBe(POINTS.prediction)
      expect(state.records[LEVEL].predictionsCorrect).toBe(1)
      expect(state.records[LEVEL].predictionsTotal).toBe(1)
    })

    it('обычное действие — 50 очков, счётчик прогнозов не трогается', () => {
      const state = apply([{ type: 'correct', levelId: LEVEL, kind: 'action' }])

      expect(state.score).toBe(POINTS.action)
      expect(state.records[LEVEL].predictionsTotal).toBe(0)
    })

    it('ответ «на объяснение» дороже обычного действия', () => {
      expect(apply([{ type: 'correct', levelId: LEVEL, kind: 'explanation' }]).score).toBe(
        POINTS.explanation,
      )
      expect(POINTS.explanation).toBeGreaterThan(POINTS.action)
    })

    it('шаг в роли Event Loop — 100 очков', () => {
      expect(apply([{ type: 'correct', levelId: LEVEL, kind: 'loop' }]).score).toBe(POINTS.loopStep)
    })

    it('прогноз со второй попытки учитывается, но не приносит очков', () => {
      const state = apply([{ type: 'prediction-missed', levelId: LEVEL }])

      expect(state.score).toBe(0)
      expect(state.records[LEVEL].predictionsTotal).toBe(1)
      expect(state.records[LEVEL].predictionsCorrect).toBe(0)
    })

    it('очки уровня копятся в его записи', () => {
      const state = apply([
        { type: 'correct', levelId: LEVEL, kind: 'prediction' },
        { type: 'correct', levelId: LEVEL, kind: 'action' },
      ])

      expect(state.records[LEVEL].score).toBe(POINTS.prediction + POINTS.action)
      expect(state.score).toBe(POINTS.prediction + POINTS.action)
    })
  })

  describe('ошибки и жизни', () => {
    it('первая ошибка стоит очков, но не жизни', () => {
      const state = apply([
        { type: 'correct', levelId: LEVEL, kind: 'prediction' },
        { type: 'wrong', levelId: LEVEL },
      ])

      expect(state.score).toBe(POINTS.prediction + POINTS.wrongChoice)
      expect(state.lives).toBe(MAX_LIVES)
      expect(state.records[LEVEL].wrongAnswers).toBe(1)
    })

    it('повторная ошибка снимает жизнь', () => {
      const state = apply([{ type: 'wrong', levelId: LEVEL, critical: true }])
      expect(state.lives).toBe(MAX_LIVES - 1)
    })

    it('после потери всех жизней включается Learning Mode', () => {
      const state = apply([
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'wrong', levelId: LEVEL, critical: true },
      ])

      expect(state.lives).toBe(0)
      expect(state.records[LEVEL].learningMode).toBe(true)
    })

    it('жизни не уходят в минус', () => {
      const state = apply(
        Array.from({ length: 6 }, () => ({ type: 'wrong', levelId: LEVEL, critical: true }) as const),
      )
      expect(state.lives).toBe(0)
    })

    it('нарушение правил Event Loop стоит и очков, и жизни', () => {
      const state = apply([
        { type: 'correct', levelId: LEVEL, kind: 'loop' },
        { type: 'violation', levelId: LEVEL },
      ])

      expect(state.score).toBe(POINTS.loopStep + POINTS.loopViolation)
      expect(state.lives).toBe(MAX_LIVES - 1)
      expect(state.records[LEVEL].violations).toBe(1)
    })

    it('общий счёт не опускается ниже нуля', () => {
      const state = apply([
        { type: 'wrong', levelId: LEVEL },
        { type: 'wrong', levelId: LEVEL },
      ])

      expect(state.score).toBe(0)
      // В записи уровня штраф виден целиком — итоговая таблица показывает правду.
      expect(state.records[LEVEL].score).toBe(POINTS.wrongChoice * 2)
    })
  })

  describe('подсказки', () => {
    it('подсказка стоит очков и попадает в статистику', () => {
      const state = apply([
        { type: 'correct', levelId: LEVEL, kind: 'prediction' },
        { type: 'hint', levelId: LEVEL },
      ])

      expect(state.score).toBe(POINTS.prediction + POINTS.hintUsed)
      expect(state.records[LEVEL].hintsUsed).toBe(1)
    })
  })

  describe('закрытие уровня', () => {
    it('бонус за скорость и прохождение плюс бонус «без подсказок»', () => {
      const state = apply([
        { type: 'open-level', levelId: LEVEL },
        { type: 'complete', levelId: LEVEL, bonus: 200 },
      ])

      expect(state.score).toBe(200 + POINTS.noHintBonus)
      expect(state.records[LEVEL].completed).toBe(true)
    })

    it('с подсказкой бонус «без подсказок» не даётся', () => {
      const events: GameEvent[] = [
        { type: 'open-level', levelId: LEVEL },
        { type: 'correct', levelId: LEVEL, kind: 'prediction' },
      ]
      const withHint = apply([
        ...events,
        { type: 'hint', levelId: LEVEL },
        { type: 'complete', levelId: LEVEL, bonus: 200 },
      ])
      const withoutHint = apply([...events, { type: 'complete', levelId: LEVEL, bonus: 200 }])

      expect(withHint.score).toBe(POINTS.prediction + POINTS.hintUsed + 200)
      expect(withoutHint.score).toBe(POINTS.prediction + 200 + POINTS.noHintBonus)
    })

    it('уровень можно закрыть, даже если жизни кончились', () => {
      const state = apply([
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'wrong', levelId: LEVEL, critical: true },
        { type: 'complete', levelId: LEVEL, bonus: 100 },
      ])

      expect(state.records[LEVEL].completed).toBe(true)
      expect(state.lives).toBe(0)
    })
  })

  describe('служебные события', () => {
    it('сброс возвращает игру к начальному состоянию', () => {
      const played = apply([
        { type: 'correct', levelId: LEVEL, kind: 'prediction' },
        { type: 'complete', levelId: LEVEL, bonus: 100 },
      ])

      expect(reducer(played, { type: 'reset' })).toEqual(initialState)
    })

    it('восстановление подставляет сохранённое состояние целиком', () => {
      const saved: GameState = {
        score: 1234,
        lives: 1,
        currentLevelId: 'level4',
        records: { level4: makeRecord('level4', { completed: true, score: 1234 }) },
      }

      expect(reducer(initialState, { type: 'hydrate', state: saved })).toEqual(saved)
    })

    it('неизвестное событие ничего не меняет', () => {
      const event = { type: 'нет-такого' } as unknown as GameEvent
      expect(reducer(initialState, event)).toBe(initialState)
    })
  })
})

/* ------------------------------------------------------------------ */

function Harness() {
  const { state, dispatch, recordFor } = useGame()
  return (
    <div>
      <span data-testid="score">{state.score}</span>
      <span data-testid="lives">{state.lives}</span>
      <span data-testid="hints">{recordFor(LEVEL).hintsUsed}</span>
      <button type="button" onClick={() => dispatch({ type: 'hint', levelId: LEVEL })}>
        подсказка
      </button>
    </div>
  )
}

describe('сохранение прогресса между сессиями', () => {
  it('поднимает сохранённый прогресс при запуске игры', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ score: 500, lives: 2, currentLevelId: 'level2', records: {} }),
    )

    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    expect(screen.getByTestId('score')).toHaveTextContent('500')
    expect(screen.getByTestId('lives')).toHaveTextContent('2')
  })

  it('записывает каждое изменение в localStorage', async () => {
    const user = userEvent.setup()
    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'подсказка' }))

    expect(storedProgress()?.records[LEVEL].hintsUsed).toBe(1)
  })

  it('битое сохранение не ломает запуск', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ это не json')

    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    expect(screen.getByTestId('score')).toHaveTextContent('0')
  })

  it('сохранение чужого формата игнорируется', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ score: 'много', records: null }))

    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    expect(screen.getByTestId('score')).toHaveTextContent('0')
    expect(screen.getByTestId('lives')).toHaveTextContent(String(MAX_LIVES))
  })

  it('сохранение без жизней восстанавливает полный запас', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ score: 10, records: {} }))

    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    expect(screen.getByTestId('lives')).toHaveTextContent(String(MAX_LIVES))
  })

  it('приватный режим браузера: игра работает без сохранения', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'подсказка' }))
    expect(screen.getByTestId('hints')).toHaveTextContent('1')
  })

  it('недоступное хранилище не мешает старту', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )

    expect(screen.getByTestId('score')).toHaveTextContent('0')
  })

  it('useGame вне провайдера сообщает об ошибке разработчику', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness />)).toThrow(/useGame must be used inside/)
    consoleError.mockRestore()
  })
})
