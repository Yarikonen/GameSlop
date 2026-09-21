/**
 * Состояние забега в бесконечном режиме.
 *
 * Чистые функции без React: правила выбора операции берутся из
 * engine/validator, волны — из generator, экран только рисует результат.
 */
import { MAX_LIVES } from '../engine/scoring'
import type { EventLoopItem } from '../engine/types'
import { validateLoopPick } from '../engine/validator'
import { generateWave } from './generator'

export const ENDLESS_POINTS = {
  /** За каждую верно выбранную операцию, умножается на множитель серии. */
  pick: 10,
  /** За полностью разобранную волну, умножается на её номер. */
  waveClear: 50,
} as const

export const STREAK_PER_MULTIPLIER = 5
export const MAX_MULTIPLIER = 5

export type RunStatus = 'playing' | 'wave-cleared' | 'over'

export interface RunEvent {
  ok: boolean
  text: string
}

export interface EndlessRun {
  seed: number
  wave: number
  microtasks: EventLoopItem[]
  tasks: EventLoopItem[]
  output: string[]
  score: number
  /** Верных ходов подряд — растит множитель. */
  streak: number
  lives: number
  status: RunStatus
  /** Что нового появилось на этой волне. */
  unlocked: string[]
  event: RunEvent | null
}

/** Множитель за серию: каждые пять верных ходов подряд, максимум ×5. */
export function multiplierFor(streak: number): number {
  return Math.min(1 + Math.floor(streak / STREAK_PER_MULTIPLIER), MAX_MULTIPLIER)
}

function loadWave(run: Omit<EndlessRun, 'microtasks' | 'tasks' | 'unlocked'>, wave: number): EndlessRun {
  const generated = generateWave(wave, run.seed)
  return {
    ...run,
    wave,
    microtasks: generated.microtasks,
    tasks: generated.tasks,
    unlocked: generated.unlocked,
  }
}

export function startRun(seed = Math.floor(Math.random() * 1_000_000) + 1): EndlessRun {
  return loadWave(
    {
      seed,
      wave: 1,
      output: [],
      score: 0,
      streak: 0,
      lives: MAX_LIVES,
      status: 'playing',
      event: null,
    },
    1,
  )
}

/** Игрок выбрал операцию. Правила те же, что на четвёртом уровне. */
export function pick(run: EndlessRun, id: string): EndlessRun {
  if (run.status !== 'playing') return run

  const verdict = validateLoopPick({ microtasks: run.microtasks, tasks: run.tasks }, id)
  if (!verdict.ok) {
    const lives = Math.max(0, run.lives - 1)
    return {
      ...run,
      lives,
      streak: 0,
      status: lives === 0 ? 'over' : 'playing',
      event: { ok: false, text: `EVENT LOOP VIOLATION — ${verdict.reason}` },
    }
  }

  const fromMicro = run.microtasks[0]?.id === id
  const item = (fromMicro ? run.microtasks[0] : run.tasks[0]) as EventLoopItem
  const microtasks = fromMicro ? run.microtasks.slice(1) : [...run.microtasks]
  const tasks = fromMicro ? [...run.tasks] : run.tasks.slice(1)

  for (const spawn of item.spawns ?? []) {
    if (spawn.queue === 'microtask') microtasks.push(spawn.item)
    else tasks.push(spawn.item)
  }

  const streak = run.streak + 1
  const multiplier = multiplierFor(streak)
  const cleared = microtasks.length === 0 && tasks.length === 0
  const waveBonus = cleared ? ENDLESS_POINTS.waveClear * run.wave : 0

  return {
    ...run,
    microtasks,
    tasks,
    output: item.output ? [...run.output, item.output] : run.output,
    score: run.score + ENDLESS_POINTS.pick * multiplier + waveBonus,
    streak,
    status: cleared ? 'wave-cleared' : 'playing',
    event: {
      ok: true,
      text: cleared
        ? `Волна ${run.wave} разобрана: ${[...run.output, item.output].join(' → ')}`
        : item.spawns?.length
          ? `${item.label} — выполнена, и поставила новую операцию в очередь.`
          : `${item.label} — верно.`,
    },
  }
}

/** Перейти на следующую волну после разобранной. */
export function nextWave(run: EndlessRun): EndlessRun {
  if (run.status !== 'wave-cleared') return run
  return loadWave({ ...run, output: [], status: 'playing', event: null }, run.wave + 1)
}
