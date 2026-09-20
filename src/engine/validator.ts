import type {
  ChoiceChallenge,
  ClassifyChallenge,
  EventLoopItem,
  PredictOutputChallenge,
} from './types'

export interface PredictResult {
  correct: boolean
  /** Индексы позиций, в которых ответ расходится с правильным. */
  wrongIndexes: number[]
}

export function checkPredictOutput(
  challenge: PredictOutputChallenge,
  slots: Array<string | null>,
): PredictResult {
  const wrongIndexes: number[] = []
  challenge.answer.forEach((expected, index) => {
    if (slots[index] !== expected) wrongIndexes.push(index)
  })
  return { correct: wrongIndexes.length === 0, wrongIndexes }
}

export interface ClassifyResult {
  correct: boolean
  wrongItemIds: string[]
}

export function checkClassify(
  challenge: ClassifyChallenge,
  placement: Record<string, string | null>,
): ClassifyResult {
  const wrongItemIds: string[] = []
  for (const item of challenge.items) {
    if (placement[item.id] !== challenge.answer[item.id]) wrongItemIds.push(item.id)
  }
  return { correct: wrongItemIds.length === 0, wrongItemIds }
}

export function checkChoice(challenge: ChoiceChallenge, optionId: string | null): boolean {
  return optionId !== null && optionId === challenge.answer
}

export interface LoopState {
  microtasks: EventLoopItem[]
  tasks: EventLoopItem[]
}

/**
 * Правило Event Loop: пока Microtask Queue не пуста, задачи не берутся.
 * Возвращает id единственной легальной следующей операции.
 */
export function legalNextId(state: LoopState): string | null {
  if (state.microtasks.length > 0) return state.microtasks[0].id
  if (state.tasks.length > 0) return state.tasks[0].id
  return null
}

export type LoopVerdict =
  | { ok: true }
  | { ok: false; reason: string }

export function validateLoopPick(state: LoopState, pickedId: string): LoopVerdict {
  const legal = legalNextId(state)
  if (legal === pickedId) return { ok: true }

  const isTask = state.tasks.some((item) => item.id === pickedId)
  if (isTask && state.microtasks.length > 0) {
    return {
      ok: false,
      reason:
        'Microtask Queue не пуста. Event Loop берёт следующую task только после полной очистки очереди микрозадач.',
    }
  }
  if (isTask) {
    return { ok: false, reason: 'Задачи берутся по очереди (FIFO): первой выполняется самая ранняя.' }
  }
  return {
    ok: false,
    reason: 'Микрозадачи тоже выполняются по очереди (FIFO): сначала та, что встала в очередь раньше.',
  }
}
