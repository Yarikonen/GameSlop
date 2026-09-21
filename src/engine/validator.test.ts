import { describe, expect, it } from 'vitest'
import type {
  ChoiceChallenge,
  ClassifyChallenge,
  EventLoopItem,
  PredictOutputChallenge,
} from './types'
import {
  checkChoice,
  checkClassify,
  checkPredictOutput,
  legalNextId,
  validateLoopPick,
} from './validator'

const predict: PredictOutputChallenge = {
  id: 'p',
  kind: 'predict-output',
  prompt: 'Собери Output',
  cards: ['B', 'A', 'C'],
  answer: ['A', 'B', 'C'],
}

const classify: ClassifyChallenge = {
  id: 'c',
  kind: 'classify',
  prompt: 'Разложи по очередям',
  items: [
    { id: 'then', label: 'then(...)' },
    { id: 'timeout', label: 'setTimeout(...)' },
  ],
  buckets: [
    { id: 'microtask', label: 'Microtask Queue' },
    { id: 'task', label: 'Task Queue' },
  ],
  answer: { then: 'microtask', timeout: 'task' },
}

const choice: ChoiceChallenge = {
  id: 'q',
  kind: 'choice',
  prompt: 'Что дальше?',
  options: [
    { id: 'right', label: 'Верно' },
    { id: 'wrong', label: 'Неверно' },
  ],
  answer: 'right',
  explanation: 'потому что',
}

describe('проверка прогноза Output', () => {
  it('принимает точный порядок', () => {
    expect(checkPredictOutput(predict, ['A', 'B', 'C'])).toEqual({ correct: true, wrongIndexes: [] })
  })

  it('указывает все позиции, которые стоят не на своём месте', () => {
    expect(checkPredictOutput(predict, ['B', 'A', 'C'])).toEqual({
      correct: false,
      wrongIndexes: [0, 1],
    })
  })

  it('не заполненные слоты считаются ошибкой', () => {
    expect(checkPredictOutput(predict, [null, null, null])).toEqual({
      correct: false,
      wrongIndexes: [0, 1, 2],
    })
  })

  it('лишние карточки за пределами ответа игнорируются', () => {
    expect(checkPredictOutput(predict, ['A', 'B', 'C', 'D']).correct).toBe(true)
  })

  it('повторяющиеся строки сравниваются по позиции', () => {
    const repeated: PredictOutputChallenge = { ...predict, answer: ['A', 'A', 'B'] }
    expect(checkPredictOutput(repeated, ['A', 'B', 'A']).wrongIndexes).toEqual([1, 2])
    expect(checkPredictOutput(repeated, ['A', 'A', 'B']).correct).toBe(true)
  })
})

describe('проверка раскладки по очередям', () => {
  it('принимает верную раскладку', () => {
    expect(checkClassify(classify, { then: 'microtask', timeout: 'task' })).toEqual({
      correct: true,
      wrongItemIds: [],
    })
  })

  it('называет операции, попавшие не в ту очередь', () => {
    expect(checkClassify(classify, { then: 'task', timeout: 'microtask' }).wrongItemIds).toEqual([
      'then',
      'timeout',
    ])
  })

  it('неразложенная операция считается ошибкой', () => {
    expect(checkClassify(classify, { then: 'microtask', timeout: null }).wrongItemIds).toEqual([
      'timeout',
    ])
  })
})

describe('проверка вопроса с вариантами', () => {
  it('принимает только правильный вариант', () => {
    expect(checkChoice(choice, 'right')).toBe(true)
    expect(checkChoice(choice, 'wrong')).toBe(false)
  })

  it('пустой ответ не засчитывается', () => {
    expect(checkChoice(choice, null)).toBe(false)
  })
})

describe('правила Event Loop', () => {
  const micro = (id: string): EventLoopItem => ({ id, label: `micro ${id}` })
  const task = (id: string): EventLoopItem => ({ id, label: `task ${id}` })

  it('следующая легальная операция — голова очереди микрозадач', () => {
    expect(legalNextId({ microtasks: [micro('m1'), micro('m2')], tasks: [task('t1')] })).toBe('m1')
  })

  it('задача берётся только при пустой очереди микрозадач', () => {
    expect(legalNextId({ microtasks: [], tasks: [task('t1'), task('t2')] })).toBe('t1')
  })

  it('пустые очереди — ходить нечем', () => {
    expect(legalNextId({ microtasks: [], tasks: [] })).toBeNull()
  })

  it('верный выбор проходит без замечаний', () => {
    const verdict = validateLoopPick({ microtasks: [micro('m1')], tasks: [task('t1')] }, 'm1')
    expect(verdict).toEqual({ ok: true })
  })

  it('task вперёд микрозадач — нарушение с объяснением про приоритет', () => {
    const verdict = validateLoopPick({ microtasks: [micro('m1')], tasks: [task('t1')] }, 't1')
    expect(verdict.ok).toBe(false)
    expect(verdict.ok === false && verdict.reason).toMatch(/Microtask Queue не пуста/)
  })

  it('нарушение FIFO в очереди задач объясняется порядком', () => {
    const verdict = validateLoopPick({ microtasks: [], tasks: [task('t1'), task('t2')] }, 't2')
    expect(verdict.ok).toBe(false)
    expect(verdict.ok === false && verdict.reason).toMatch(/FIFO/)
  })

  it('нарушение FIFO в очереди микрозадач объясняется порядком', () => {
    const verdict = validateLoopPick({ microtasks: [micro('m1'), micro('m2')], tasks: [] }, 'm2')
    expect(verdict.ok).toBe(false)
    expect(verdict.ok === false && verdict.reason).toMatch(/Микрозадачи тоже выполняются по очереди/)
  })
})
