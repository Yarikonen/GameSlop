/**
 * Модель симуляции Event Loop Arena.
 *
 * Полноценный интерпретатор JavaScript не нужен: каждый уровень —
 * заранее описанный сценарий из снимков состояния машины (SimulationStep[]).
 */

export type QueueType = 'stack' | 'runtime' | 'microtask' | 'task'

/** Вид операции — влияет только на цвет и иконку карточки. */
export type OperationKind = 'sync' | 'timer' | 'promise' | 'async' | 'io' | 'frame'

export interface Operation {
  id: string
  label: string
  type: QueueType
  kind?: OperationKind
  /** Короткая подпись внутри карточки. */
  note?: string
}

/** Фаза работы Event Loop — подсвечивается в визуализации. */
export type LoopPhase = 'sync' | 'microtask' | 'task' | 'runtime' | 'idle'

export interface SimulationStep {
  stack: Operation[]
  runtime: Operation[]
  microtasks: Operation[]
  tasks: Operation[]
  output: string[]
  description: string
  /** Подсвечиваемые строки кода (нумерация с 1). */
  codeLines?: number[]
  phase?: LoopPhase
}

/* ------------------------------------------------------------------ */
/*  Задания                                                            */
/* ------------------------------------------------------------------ */

export interface ChallengeBase {
  id: string
  prompt: string
  /**
   * Если задан — задание появляется во время симуляции, когда игрок
   * доходит до этого шага, и блокирует дальнейшие шаги до ответа.
   * Если не задан — задание нужно выполнить до запуска симуляции.
   */
  gateStep?: number
}

/** Собрать предполагаемый Output из перемешанных карточек (Drag&Drop). */
export interface PredictOutputChallenge extends ChallengeBase {
  kind: 'predict-output'
  cards: string[]
  answer: string[]
}

export interface ClassifyBucket {
  id: string
  label: string
  hint?: string
}

export interface ClassifyItem {
  id: string
  label: string
  kind?: OperationKind
}

/** Разложить операции по очередям (Drag&Drop). */
export interface ClassifyChallenge extends ChallengeBase {
  kind: 'classify'
  items: ClassifyItem[]
  buckets: ClassifyBucket[]
  /** itemId -> bucketId */
  answer: Record<string, string>
}

export interface ChoiceOption {
  id: string
  label: string
  detail?: string
  /** Объяснение, почему вариант неверный. */
  why?: string
}

/** Вопрос с вариантами ответа. */
export interface ChoiceChallenge extends ChallengeBase {
  kind: 'choice'
  options: ChoiceOption[]
  answer: string
  explanation: string
  /** Вопрос «на объяснение» стоит дороже, чем обычное действие. */
  weight?: 'action' | 'explanation'
  code?: string
}

export interface EventLoopItem {
  id: string
  label: string
  /** Что попадёт в Output при выполнении. */
  output?: string
  /** Что операция поставит в очереди во время выполнения. */
  spawns?: Array<{ queue: 'microtask' | 'task'; item: EventLoopItem }>
  note?: string
}

/** Игрок сам исполняет алгоритм Event Loop. */
export interface EventLoopChallenge extends ChallengeBase {
  kind: 'event-loop'
  microtasks: EventLoopItem[]
  tasks: EventLoopItem[]
}

export type SandboxId = 'fetch-race' | 'freeze-lab' | 'starvation-lab' | 'incident'

/** Интерактивная «лаборатория» уровня (реальный код в браузере). */
export interface SandboxChallenge extends ChallengeBase {
  kind: 'sandbox'
  sandbox: SandboxId
}

export type Challenge =
  | PredictOutputChallenge
  | ClassifyChallenge
  | ChoiceChallenge
  | EventLoopChallenge
  | SandboxChallenge

/* ------------------------------------------------------------------ */
/*  Уровень                                                            */
/* ------------------------------------------------------------------ */

export interface Level {
  id: string
  /** Подпись в меню: Tutorial, Level 1, ... Final Boss. */
  badge: string
  title: string
  topic: string
  goal: string
  code?: string
  expectedOutput?: string[]
  steps: SimulationStep[]
  challenges: Challenge[]
  hints: [string, string, string]
  keyIdea: string
  /** Разбор уровня после прохождения. */
  debrief: string[]
  /** Ориентир по времени для бонуса за скорость, сек. */
  parTimeSec: number
  boss?: boolean
}
