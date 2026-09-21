import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventLoopChallenge } from '../engine/types'
import { makeHandlers, type MockHandlers } from '../test/helpers'
import { EventLoopPuzzle } from './EventLoopPuzzle'

const challenge: EventLoopChallenge = {
  id: 'loop',
  kind: 'event-loop',
  prompt: 'Выбирай следующую операцию',
  microtasks: [
    { id: 'micro-c', label: 'then → C', output: 'C' },
    { id: 'micro-d', label: 'then → D', output: 'D' },
  ],
  tasks: [
    {
      id: 'task-b',
      label: 'timeout → B',
      output: 'B',
      note: 'внутри создаёт новую микрозадачу',
      spawns: [{ queue: 'microtask', item: { id: 'micro-f', label: 'then → F', output: 'F' } }],
    },
    { id: 'task-e', label: 'timeout → E', output: 'E' },
  ],
}

let handlers: MockHandlers

beforeEach(() => {
  // Карточка «выполняется» гаснет по таймеру — время двигаем сами.
  vi.useFakeTimers()
  handlers = makeHandlers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(solved = false) {
  return render(<EventLoopPuzzle challenge={challenge} handlers={handlers} solved={solved} />)
}

const microQueue = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.loop-queue--micro') as HTMLElement
const taskQueue = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.loop-queue--task') as HTMLElement
const queueLabels = (queue: HTMLElement) =>
  Array.from(queue.querySelectorAll('.loop-queue__items .chip')).map(
    (chip) => chip.textContent?.replace('внутри создаёт новую микрозадачу', '') ?? '',
  )
const output = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.loop-puzzle__output .output-line')).map((l) => l.textContent)
const callStack = (container: HTMLElement) =>
  container.querySelector('.loop-puzzle__stack-value')?.textContent ?? ''

/** Дать таймеру «фрейм выполняется» доработать. */
function settle() {
  act(() => {
    vi.advanceTimersByTime(500)
  })
}

describe('игрок в роли Event Loop', () => {
  it('раунд начинается с непустых очередей и пустого стека', () => {
    const { container } = setup()

    expect(queueLabels(microQueue(container))).toEqual(['then → C', 'then → D'])
    expect(queueLabels(taskQueue(container))).toEqual(['timeout → B', 'timeout → E'])
    expect(output(container)).toEqual([])
    expect(callStack(container)).toMatch(/пусто/)
  })

  it('верный ход: первая микрозадача выполняется и печатает строку', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'then → C' }))

    expect(handlers.onCorrect).toHaveBeenCalledExactlyOnceWith('loop')
    expect(handlers.onViolation).not.toHaveBeenCalled()
    expect(queueLabels(microQueue(container))).toEqual(['then → D'])
    expect(output(container)).toEqual(['C'])
    expect(screen.getByText(/CORRECT — then → C выполнена/)).toBeInTheDocument()
    settle()
  })

  it('операция видна в Call Stack, пока выполняется', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'then → C' }))
    expect(callStack(container)).toBe('then → C')

    settle()
    expect(callStack(container)).toMatch(/пусто/)
  })

  it('task вперёд микрозадач — нарушение, очереди не меняются', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: /timeout → B/ }))

    expect(handlers.onViolation).toHaveBeenCalledOnce()
    expect(handlers.onCorrect).not.toHaveBeenCalled()
    expect(screen.getByText(/EVENT LOOP VIOLATION/)).toHaveTextContent('Microtask Queue не пуста')
    expect(queueLabels(taskQueue(container))).toEqual(['timeout → B', 'timeout → E'])
    expect(output(container)).toEqual([])
  })

  it('нарушение FIFO внутри очереди микрозадач тоже наказуемо', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'then → D' }))

    expect(handlers.onViolation).toHaveBeenCalledOnce()
    expect(screen.getByText(/EVENT LOOP VIOLATION/)).toHaveTextContent('по очереди')
    expect(queueLabels(microQueue(container))).toEqual(['then → C', 'then → D'])
  })

  it('задача порождает микрозадачу — и игра предупреждает, что она пойдёт раньше task', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'then → C' }))
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'then → D' }))
    settle()
    fireEvent.click(screen.getByRole('button', { name: /timeout → B/ }))

    expect(queueLabels(microQueue(container))).toEqual(['then → F'])
    expect(screen.getByText(/CORRECT/)).toHaveTextContent('поставила новую микрозадачу')
    settle()
  })

  it('после порождённой микрозадачи брать следующую task — нарушение', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'then → C' }))
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'then → D' }))
    settle()
    fireEvent.click(screen.getByRole('button', { name: /timeout → B/ }))
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'timeout → E' }))

    expect(handlers.onViolation).toHaveBeenCalledOnce()
    expect(screen.getByText(/EVENT LOOP VIOLATION/)).toBeInTheDocument()
  })

  it('полный правильный цикл даёт порядок C → D → B → F → E и закрывает задание', () => {
    const { container } = setup()

    for (const name of ['then → C', 'then → D', 'timeout → B', 'then → F', 'timeout → E']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
      settle()
    }

    expect(output(container)).toEqual(['C', 'D', 'B', 'F', 'E'])
    expect(handlers.onCorrect).toHaveBeenCalledTimes(5)
    expect(handlers.onViolation).not.toHaveBeenCalled()
    expect(handlers.onSolved).toHaveBeenCalledOnce()
    expect(screen.getByText(/Цикл пройден полностью: C → D → B → F → E/)).toBeInTheDocument()
    expect(within(microQueue(container)).getByText('пусто')).toBeInTheDocument()
    expect(within(taskQueue(container)).getByText('пусто')).toBeInTheDocument()
  })

  it('нарушения не мешают пройти цикл до конца', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'timeout → E' }))
    for (const name of ['then → C', 'then → D', 'timeout → B', 'then → F', 'timeout → E']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
      settle()
    }

    expect(handlers.onViolation).toHaveBeenCalledOnce()
    expect(output(container)).toEqual(['C', 'D', 'B', 'F', 'E'])
    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('решённое задание не принимает новых ходов', () => {
    const { container } = setup(true)

    for (const button of within(microQueue(container)).getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
    fireEvent.click(screen.getByRole('button', { name: 'then → C' }))
    expect(handlers.onCorrect).not.toHaveBeenCalled()
  })
})
