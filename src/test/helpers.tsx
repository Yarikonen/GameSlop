import { act, fireEvent, render, screen, within, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { vi, type Mock } from 'vitest'
import { App } from '../App'
import type { ChallengeHandlers } from '../components/challengeTypes'
import type {
  Challenge,
  ChoiceChallenge,
  ClassifyChallenge,
  EventLoopChallenge,
  EventLoopItem,
  Level,
  PredictOutputChallenge,
  SandboxId,
} from '../engine/types'
import { legalNextId } from '../engine/validator'
import {
  GameProvider,
  STORAGE_KEY,
  initialState,
  type CorrectKind,
  type GameState,
  type LevelRecord,
} from '../state/gameStore'

/* ------------------------------------------------------------------ */
/*  Рендер                                                             */
/* ------------------------------------------------------------------ */

/** Рендер любого куска игры внутри провайдера прогресса + готовый user-event. */
export function renderWithGame(ui: ReactElement, options?: RenderOptions) {
  const user = userEvent.setup()
  const view = render(<GameProvider>{ui}</GameProvider>, options)
  return { user, ...view }
}

/** Рендер приложения целиком — для сквозных пользовательских сценариев. */
export function renderApp() {
  return renderWithGame(<App />)
}

/* ------------------------------------------------------------------ */
/*  Прогресс игрока                                                    */
/* ------------------------------------------------------------------ */

export function makeRecord(levelId: string, patch: Partial<LevelRecord> = {}): LevelRecord {
  return {
    levelId,
    completed: false,
    score: 0,
    predictionsCorrect: 0,
    predictionsTotal: 0,
    wrongAnswers: 0,
    violations: 0,
    hintsUsed: 0,
    learningMode: false,
    ...patch,
  }
}

/** Положить сохранённый прогресс в localStorage ДО рендера игры. */
export function seedProgress(patch: Partial<GameState> = {}): GameState {
  const state: GameState = { ...initialState, ...patch }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

/** Прочитать то, что игра сохранила в localStorage. */
export function storedProgress(): GameState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as GameState) : null
}

export function storedScore(): number {
  return storedProgress()?.score ?? 0
}

export function storedRecord(levelId: string): LevelRecord {
  return storedProgress()?.records[levelId] ?? makeRecord(levelId)
}

/* ------------------------------------------------------------------ */
/*  Заглушки обработчиков заданий                                      */
/* ------------------------------------------------------------------ */

export interface MockHandlers extends ChallengeHandlers {
  onCorrect: Mock<(kind: CorrectKind) => void>
  onWrong: Mock<(critical?: boolean) => void>
  onViolation: Mock<() => void>
  onPredictionMissed: Mock<() => void>
  onSolved: Mock<() => void>
}

export function makeHandlers(learningMode = false): MockHandlers {
  return {
    onCorrect: vi.fn<(kind: CorrectKind) => void>(),
    onWrong: vi.fn<(critical?: boolean) => void>(),
    onViolation: vi.fn<() => void>(),
    onPredictionMissed: vi.fn<() => void>(),
    onSolved: vi.fn<() => void>(),
    learningMode,
  }
}

/* ------------------------------------------------------------------ */
/*  Drag & Drop                                                        */
/* ------------------------------------------------------------------ */

/** jsdom не создаёт DataTransfer — подсовываем совместимую заглушку. */
function makeDataTransfer(payload: string) {
  let data = payload
  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    files: [],
    items: [],
    types: ['text/plain'],
    getData: () => data,
    setData: (_format: string, value: string) => {
      data = value
    },
    clearData: () => {
      data = ''
    },
    setDragImage: () => {},
  }
}

/** Перетащить карточку в цель: dragStart на источнике + drop на приёмнике. */
export function dragCard(source: Element, target: Element, id = '') {
  const dataTransfer = makeDataTransfer(id)
  fireEvent.dragStart(source, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
}

/* ------------------------------------------------------------------ */
/*  Симуляция                                                          */
/* ------------------------------------------------------------------ */

/** Текущий шаг симуляции по счётчику «шаг N / M». */
export function currentStep(): { index: number; total: number } {
  const text = screen.getByText(/шаг \d+ \/ \d+/).textContent ?? ''
  const [, index, total] = /шаг (\d+) \/ (\d+)/.exec(text) ?? []
  return { index: Number(index), total: Number(total) }
}

/* ------------------------------------------------------------------ */
/*  Часы                                                               */
/* ------------------------------------------------------------------ */

/** Набор фейковых таймеров, который НЕ трогает performance — его подменяем сами. */
export const BUSY_LOOP_TIMERS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'Date',
] as const

/**
 * Часы для лабораторий, которые крутят настоящие CPU-циклы
 * `while (performance.now() < end)`.
 *
 * Замороженное время такой цикл не завершит никогда, поэтому performance.now()
 * идёт по фейковым таймерам (Date) плюс stepMs на каждый вызов: цикл честно
 * доходит до конца за конечное число итераций, а ожидание таймеров по-прежнему
 * двигается вручную.
 */
export function busyLoopClock(stepMs = 1) {
  const origin = Date.now()
  let extra = 0
  return vi.spyOn(performance, 'now').mockImplementation(() => {
    extra += stepMs
    return Date.now() - origin + extra
  })
}

/* ------------------------------------------------------------------ */
/*  Прохождение заданий                                                */
/*                                                                     */
/*  Здесь намеренно fireEvent, а не user-event: эти помощники работают  */
/*  и с фейковыми таймерами, которые нужны лабораториям.               */
/* ------------------------------------------------------------------ */

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function clickButton(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

/** Промотать фейковое время вместе с микрозадачами. */
async function advanceTime(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

export function solvePredictOutput(challenge: PredictOutputChallenge, container: HTMLElement) {
  challenge.answer.forEach((label, index) => {
    const tray = container.querySelector<HTMLElement>('.predict__tray') as HTMLElement
    const [card] = within(tray).getAllByRole('button', { name: label })
    fireEvent.click(card)
    fireEvent.click(container.querySelectorAll('.predict__slots .slot')[index])
  })
  clickButton(/ПРОВЕРИТЬ ПРОГНОЗ/)
}

function solveClassify(challenge: ClassifyChallenge, container: HTMLElement) {
  for (const item of challenge.items) {
    const tray = container.querySelector<HTMLElement>('.classify__tray') as HTMLElement
    fireEvent.click(within(tray).getByRole('button', { name: item.label }))
    fireEvent.click(container.querySelector(`.bucket--${challenge.answer[item.id]}`) as Element)
  }
  clickButton('ПРОВЕРИТЬ')
}

export function solveChoice(challenge: ChoiceChallenge) {
  const answer = challenge.options.find((option) => option.id === challenge.answer)
  if (!answer) throw new Error(`У задания ${challenge.id} нет верного варианта`)
  clickButton(answer.label)
}

/** Пройти раунд Event Loop строго по правилам. */
function solveEventLoop(challenge: EventLoopChallenge) {
  const micro: EventLoopItem[] = [...challenge.microtasks]
  const tasks: EventLoopItem[] = [...challenge.tasks]

  for (let guard = 0; guard < 50; guard += 1) {
    const nextId = legalNextId({ microtasks: micro, tasks })
    if (nextId === null) break
    const fromMicro = micro[0]?.id === nextId
    const item = (fromMicro ? micro.shift() : tasks.shift()) as EventLoopItem
    clickButton(new RegExp(escape(item.label)))
    for (const spawn of item.spawns ?? []) {
      if (spawn.queue === 'microtask') micro.push(spawn.item)
      else tasks.push(spawn.item)
    }
  }
}

/** Прогнать лабораторию уровня. Требует включённых фейковых таймеров. */
async function solveSandbox(sandbox: SandboxId, container: HTMLElement) {
  if (sandbox === 'fetch-race') {
    clickButton(/Вариант A/)
    await advanceTime(1300)
    clickButton(/Вариант B/)
    await advanceTime(900)
    return
  }

  if (sandbox === 'freeze-lab') {
    clickButton(/CALCULATE REPORT/)
    await advanceTime(200)
    clickButton(/WEB WORKER/)
    await advanceTime(2000)
    return
  }

  if (sandbox === 'starvation-lab') {
    clickButton(/spawn\(\)/)
    await advanceTime(600)
    return
  }

  for (const probe of container.querySelectorAll('.incident__probes .probe')) {
    fireEvent.click(probe)
    await advanceTime(600)
  }
}

async function solveChallenge(challenge: Challenge, container: HTMLElement) {
  if (challenge.kind === 'predict-output') return solvePredictOutput(challenge, container)
  if (challenge.kind === 'classify') return solveClassify(challenge, container)
  if (challenge.kind === 'choice') return solveChoice(challenge)
  if (challenge.kind === 'event-loop') return solveEventLoop(challenge)
  return solveSandbox(challenge.sandbox, container)
}

/**
 * Пройти уровень целиком: решить задания (в том числе те, что всплывают
 * во время симуляции) и доиграть сценарий до конца.
 */
export async function playLevel(level: Level, container: HTMLElement) {
  const solved = new Set<string>()

  for (let guard = 0; guard < 120; guard += 1) {
    const visible = level.challenges.find(
      (challenge) => !solved.has(challenge.id) && screen.queryAllByText(challenge.prompt).length > 0,
    )

    if (visible) {
      await solveChallenge(visible, container)
      solved.add(visible.id)
      const next = screen.queryByRole('button', { name: /СЛЕДУЮЩЕЕ ЗАДАНИЕ/ })
      if (next) fireEvent.click(next)
      continue
    }

    const step = screen.getByRole('button', { name: /STEP/ }) as HTMLButtonElement
    if (step.disabled) break
    fireEvent.click(step)
  }

  if (solved.size !== level.challenges.length) {
    throw new Error(`Уровень ${level.id}: решено ${solved.size} из ${level.challenges.length} заданий`)
  }
}
