import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ClassifyChallenge } from '../engine/types'
import { dragCard, makeHandlers, type MockHandlers } from '../test/helpers'
import { ClassifyBoard } from './ClassifyBoard'

const challenge: ClassifyChallenge = {
  id: 'classify',
  kind: 'classify',
  prompt: 'Разложи операции по очередям',
  items: [
    { id: 'then-c', label: 'then(() => log("C"))', kind: 'promise' },
    { id: 'timeout-b', label: 'timeout(() => log("B"))', kind: 'timer' },
  ],
  buckets: [
    { id: 'microtask', label: 'Microtask Queue', hint: 'промисы' },
    { id: 'task', label: 'Task Queue', hint: 'таймеры' },
  ],
  answer: { 'then-c': 'microtask', 'timeout-b': 'task' },
}

let handlers: MockHandlers

function setup(solved = false) {
  handlers = makeHandlers()
  const user = userEvent.setup()
  const view = render(<ClassifyBoard challenge={challenge} handlers={handlers} solved={solved} />)
  return { user, ...view }
}

const tray = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.classify__tray') as HTMLElement
const bucket = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`.bucket--${id}`) as HTMLElement
const inBucket = (container: HTMLElement, id: string) =>
  Array.from(bucket(container, id).querySelectorAll('.bucket__items .chip')).map((c) => c.textContent)

const checkButton = () => screen.getByRole('button', { name: 'ПРОВЕРИТЬ' })

async function sortInto(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  plan: Array<[string, string]>,
) {
  for (const [label, bucketId] of plan) {
    await user.click(within(tray(container)).getByRole('button', { name: label }))
    await user.click(bucket(container, bucketId))
  }
}

describe('раскладка операций по очередям', () => {
  it('все операции начинают в лотке, проверка недоступна', () => {
    const { container } = setup()

    expect(within(tray(container)).getAllByRole('button')).toHaveLength(2)
    expect(inBucket(container, 'microtask')).toEqual([])
    expect(checkButton()).toBeDisabled()
  })

  it('подсказка очереди видна игроку', () => {
    const { container } = setup()
    expect(within(bucket(container, 'microtask')).getByText('промисы')).toBeInTheDocument()
  })

  it('операция кладётся в очередь кликом', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [['then(() => log("C"))', 'microtask']])

    expect(inBucket(container, 'microtask')).toEqual(['then(() => log("C"))'])
    expect(within(tray(container)).getAllByRole('button')).toHaveLength(1)
  })

  it('операция кладётся в очередь перетаскиванием', () => {
    const { container } = setup()

    dragCard(
      within(tray(container)).getByRole('button', { name: 'timeout(() => log("B"))' }),
      bucket(container, 'task'),
      'timeout-b',
    )

    expect(inBucket(container, 'task')).toEqual(['timeout(() => log("B"))'])
  })

  it('клик по разложенной операции возвращает её в лоток', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [['then(() => log("C"))', 'microtask']])
    await user.click(bucket(container, 'microtask').querySelector('.chip') as Element)

    expect(inBucket(container, 'microtask')).toEqual([])
    expect(within(tray(container)).getAllByRole('button')).toHaveLength(2)
  })

  it('перетаскивание в лоток тоже возвращает операцию', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [['then(() => log("C"))', 'microtask']])
    dragCard(bucket(container, 'microtask').querySelector('.chip') as Element, tray(container), 'then-c')

    expect(inBucket(container, 'microtask')).toEqual([])
  })

  it('когда всё разложено, проверка открывается', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [
      ['then(() => log("C"))', 'microtask'],
      ['timeout(() => log("B"))', 'task'],
    ])

    expect(screen.getByText('все операции разложены')).toBeInTheDocument()
    expect(checkButton()).toBeEnabled()
  })

  it('верная раскладка засчитывается как действие', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [
      ['then(() => log("C"))', 'microtask'],
      ['timeout(() => log("B"))', 'task'],
    ])
    await user.click(checkButton())

    expect(handlers.onCorrect).toHaveBeenCalledExactlyOnceWith('action')
    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('перепутанные очереди подсвечиваются и стоят очков', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [
      ['then(() => log("C"))', 'task'],
      ['timeout(() => log("B"))', 'microtask'],
    ])
    await user.click(checkButton())

    expect(handlers.onWrong).toHaveBeenCalledExactlyOnceWith(false)
    expect(screen.getByText(/лежат не в той очереди/)).toBeInTheDocument()
    expect(container.querySelectorAll('.chip.is-wrong')).toHaveLength(2)
  })

  it('вторая неверная раскладка стоит жизни', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [
      ['then(() => log("C"))', 'task'],
      ['timeout(() => log("B"))', 'microtask'],
    ])
    await user.click(checkButton())
    await user.click(checkButton())

    expect(handlers.onWrong).toHaveBeenNthCalledWith(2, true)
  })

  it('перекладывание снимает подсветку ошибок', async () => {
    const { container, user } = setup()

    await sortInto(user, container, [
      ['then(() => log("C"))', 'task'],
      ['timeout(() => log("B"))', 'microtask'],
    ])
    await user.click(checkButton())
    await user.click(bucket(container, 'task').querySelector('.chip') as Element)

    expect(screen.queryByText(/лежат не в той очереди/)).not.toBeInTheDocument()
  })

  it('решённое задание показывает правильную раскладку', () => {
    const { container } = setup(true)

    expect(inBucket(container, 'microtask')).toEqual([])
    expect(within(bucket(container, 'microtask')).getByText('then(() => log("C"))')).toBeInTheDocument()
    expect(within(bucket(container, 'task')).getByText('timeout(() => log("B"))')).toBeInTheDocument()
    expect(screen.getByText(/Операции разложены верно/)).toBeInTheDocument()
  })
})
