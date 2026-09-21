/**
 * Генератор волн бесконечного режима.
 *
 * Правила Event Loop берутся из engine/validator — здесь только сборка
 * очередей. Волна растёт не множителями, а словарём: сначала then и
 * setTimeout, дальше добавляются queueMicrotask, продолжения после await,
 * setInterval и операции, которые во время выполнения ставят новые.
 */
import type { EventLoopItem } from '../engine/types'

export type QueueName = 'microtask' | 'task'

interface Flavor {
  id: string
  queue: QueueName
  /** С какой волны операция начинает встречаться. */
  from: number
  label: (output: string) => string
  note?: string
  /** Показывается игроку в момент появления. */
  intro?: string
}

/**
 * Только те операции, для которых очередь названа честно.
 * requestAnimationFrame сюда не входит: его колбэк выполняется на шаге
 * отрисовки, а не как обычная задача, и в этой модели соврал бы.
 */
const FLAVORS: Flavor[] = [
  { id: 'then', queue: 'microtask', from: 1, label: (output) => `then → ${output}` },
  { id: 'timeout', queue: 'task', from: 1, label: (output) => `timeout → ${output}` },
  {
    id: 'queue-microtask',
    queue: 'microtask',
    from: 3,
    label: (output) => `queueMicrotask → ${output}`,
    intro: 'queueMicrotask кладёт колбэк в ту же очередь микрозадач, что и .then().',
  },
  {
    id: 'continuation',
    queue: 'microtask',
    from: 5,
    label: (output) => `continuation → ${output}`,
    note: 'после await',
    intro: 'Код после await — микрозадача-продолжение, а не отдельная задача.',
  },
  {
    id: 'interval',
    queue: 'task',
    from: 7,
    label: (output) => `interval → ${output}`,
    intro: 'Колбэк setInterval попадает в очередь задач — туда же, куда setTimeout.',
  },
]

interface SpawnRule {
  id: string
  from: number
  /** Кто ставит новую операцию. */
  source: QueueName
  /** Куда она попадает. */
  queue: QueueName
  note: string
  intro: string
}

const SPAWN_RULES: SpawnRule[] = [
  {
    id: 'task-micro',
    from: 2,
    source: 'task',
    queue: 'microtask',
    note: 'поставит микрозадачу',
    intro: 'Задача может поставить микрозадачу — она выполнится раньше следующей задачи.',
  },
  {
    id: 'micro-micro',
    from: 6,
    source: 'microtask',
    queue: 'microtask',
    note: 'поставит микрозадачу',
    intro: 'Микрозадача может поставить микрозадачу: очередь опустошается целиком, включая новичков.',
  },
  {
    id: 'task-task',
    from: 8,
    source: 'task',
    queue: 'task',
    note: 'поставит задачу',
    intro: 'Задача может поставить задачу — новая встанет в конец очереди.',
  },
]

export const MAX_MICROTASKS = 4
export const MAX_TASKS = 4
export const MAX_SPAWNS = 3

export interface Wave {
  wave: number
  microtasks: EventLoopItem[]
  tasks: EventLoopItem[]
  /** Что нового появилось именно на этой волне. */
  unlocked: string[]
  /** Сколько операций предстоит выполнить, включая порождённые. */
  totalPicks: number
}

/** mulberry32 — одна и та же волна при одном и том же сиде. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function microtaskCount(wave: number): number {
  return Math.min(2 + Math.floor((wave - 1) / 3), MAX_MICROTASKS)
}

export function taskCount(wave: number): number {
  return Math.min(2 + Math.floor((wave - 1) / 4), MAX_TASKS)
}

export function spawnCount(wave: number): number {
  if (wave < SPAWN_RULES[0].from) return 0
  return Math.min(1 + Math.floor((wave - 2) / 4), MAX_SPAWNS)
}

export function flavorsFor(wave: number): string[] {
  return FLAVORS.filter((flavor) => flavor.from <= wave).map((flavor) => flavor.id)
}

/** Подсказки, которые впервые показываются на этой волне. */
export function introsFor(wave: number): string[] {
  return [
    ...FLAVORS.filter((flavor) => flavor.from === wave && flavor.intro).map((f) => f.intro as string),
    ...SPAWN_RULES.filter((rule) => rule.from === wave).map((rule) => rule.intro),
  ]
}

export function generateWave(wave: number, seed = 1): Wave {
  if (wave < 1) throw new Error(`Волна начинается с 1, получено ${wave}`)
  const random = mulberry32(Math.imul(seed, 7919) + Math.imul(wave, 104_729))

  let nextLetter = 0
  const letter = () => String.fromCharCode(65 + (nextLetter++ % 26))
  const choose = <T,>(list: T[]): T => list[Math.floor(random() * list.length)]

  const available = FLAVORS.filter((flavor) => flavor.from <= wave)
  const pools: Record<QueueName, Flavor[]> = {
    microtask: available.filter((flavor) => flavor.queue === 'microtask'),
    task: available.filter((flavor) => flavor.queue === 'task'),
  }

  const make = (id: string, flavor: Flavor): EventLoopItem => {
    const output = letter()
    return { id, label: flavor.label(output), output, note: flavor.note }
  }

  const microtasks = Array.from({ length: microtaskCount(wave) }, (_, index) =>
    make(`w${wave}-m${index + 1}`, choose(pools.microtask)),
  )
  const tasks = Array.from({ length: taskCount(wave) }, (_, index) =>
    make(`w${wave}-t${index + 1}`, choose(pools.task)),
  )

  // Спауны вешаем только на исходные операции: порождённые сами не спаунят,
  // иначе волна может не закончиться.
  const rules = SPAWN_RULES.filter((rule) => rule.from <= wave)
  let spawned = 0
  for (let index = 0; index < spawnCount(wave) && rules.length > 0; index += 1) {
    const rule = choose(rules)
    const hosts = (rule.source === 'task' ? tasks : microtasks).filter((item) => !item.spawns)
    if (hosts.length === 0) continue
    const host = choose(hosts)
    spawned += 1
    host.note = rule.note
    host.spawns = [
      { queue: rule.queue, item: make(`w${wave}-s${spawned}`, choose(pools[rule.queue])) },
    ]
  }

  return {
    wave,
    microtasks,
    tasks,
    unlocked: introsFor(wave),
    totalPicks: microtasks.length + tasks.length + spawned,
  }
}
