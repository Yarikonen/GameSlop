import { render, screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PredictOutputChallenge } from '../engine/types'
import { dragCard, makeHandlers, type MockHandlers } from '../test/helpers'
import { PredictOutput } from './PredictOutput'

const challenge: PredictOutputChallenge = {
  id: 'predict',
  kind: 'predict-output',
  prompt: 'Собери Output программы',
  cards: ['C', 'A', 'B'],
  answer: ['A', 'B', 'C'],
}

let handlers: MockHandlers

beforeEach(() => {
  handlers = makeHandlers()
})

function setup(solved = false, learningMode = false) {
  handlers = makeHandlers(learningMode)
  const user = userEvent.setup()
  const view = render(
    <PredictOutput challenge={challenge} handlers={handlers} solved={solved} />,
  )
  return { user, ...view }
}

const slots = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.predict__slots .slot'))
const tray = (container: HTMLElement) => container.querySelector<HTMLElement>('.predict__tray') as HTMLElement
const trayLabels = (container: HTMLElement) =>
  Array.from(tray(container).querySelectorAll('.chip')).map((chip) => chip.textContent)
const slotLabels = (container: HTMLElement) =>
  slots(container).map((slot) => slot.querySelector('.chip')?.textContent ?? null)

/** Разложить карточки кликами: карточка → слот (одинаковые берём по очереди). */
async function placeByClick(user: UserEvent, container: HTMLElement, order: string[]) {
  for (const [index, label] of order.entries()) {
    const [card] = within(tray(container)).getAllByRole('button', { name: label })
    await user.click(card)
    await user.click(slots(container)[index])
  }
}

const checkButton = () => screen.getByRole('button', { name: /ПРОВЕРИТЬ ПРОГНОЗ/ })

describe('прогноз Output', () => {
  it('до прогноза слоты пусты и проверить нельзя', () => {
    const { container } = setup()

    expect(slotLabels(container)).toEqual([null, null, null])
    expect(screen.getAllByText('перетащи сюда')).toHaveLength(3)
    expect(checkButton()).toBeDisabled()
  })

  it('карточка ставится в слот кликом и уходит из лотка', async () => {
    const { container, user } = setup()

    await user.click(within(tray(container)).getByRole('button', { name: 'A' }))
    await user.click(slots(container)[0])

    expect(slotLabels(container)[0]).toBe('A')
    expect(trayLabels(container)).toEqual(['C', 'B'])
  })

  it('клик по занятому слоту возвращает карточку в лоток', async () => {
    const { container, user } = setup()

    await user.click(within(tray(container)).getByRole('button', { name: 'A' }))
    await user.click(slots(container)[0])
    await user.click(slots(container)[0])

    expect(slotLabels(container)[0]).toBeNull()
    expect(trayLabels(container)).toContain('A')
  })

  it('карточки меняются местами при перестановке в занятый слот', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['A', 'B', 'C'])
    expect(slotLabels(container)).toEqual(['A', 'B', 'C'])

    // Переносим карточку из первого слота в третий — карточки меняются местами.
    dragCard(
      slots(container)[0].querySelector('.chip') as Element,
      slots(container)[2],
      'card-1',
    )

    expect(slotLabels(container)).toEqual(['C', 'B', 'A'])
  })

  it('карточка перетаскивается в слот мышью', async () => {
    const { container } = setup()

    dragCard(within(tray(container)).getByRole('button', { name: 'C' }), slots(container)[2], 'card-0')

    expect(slotLabels(container)[2]).toBe('C')
  })

  it('перетаскивание из слота обратно в лоток освобождает слот', async () => {
    const { container, user } = setup()

    await user.click(within(tray(container)).getByRole('button', { name: 'A' }))
    await user.click(slots(container)[0])
    dragCard(slots(container)[0].querySelector('.chip') as Element, tray(container), 'card-1')

    expect(slotLabels(container)[0]).toBeNull()
    expect(trayLabels(container)).toContain('A')
  })

  it('когда все карточки расставлены, лоток сообщает об этом', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['A', 'B', 'C'])

    expect(screen.getByText('все карточки расставлены')).toBeInTheDocument()
    expect(checkButton()).toBeEnabled()
  })

  it('верный прогноз с первой попытки приносит очки за прогноз', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['A', 'B', 'C'])
    await user.click(checkButton())

    expect(handlers.onCorrect).toHaveBeenCalledExactlyOnceWith('prediction')
    expect(handlers.onSolved).toHaveBeenCalledOnce()
    expect(handlers.onWrong).not.toHaveBeenCalled()
  })

  it('неверный прогноз подсвечивает позиции и стоит очков', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['B', 'A', 'C'])
    await user.click(checkButton())

    expect(handlers.onWrong).toHaveBeenCalledExactlyOnceWith(false)
    expect(handlers.onSolved).not.toHaveBeenCalled()
    expect(screen.getByText(/Порядок неверный/)).toBeInTheDocument()
    expect(slots(container)[0]).toHaveClass('is-wrong')
    expect(slots(container)[1]).toHaveClass('is-wrong')
    expect(slots(container)[2]).not.toHaveClass('is-wrong')
  })

  it('вторая ошибка подряд стоит жизни', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['B', 'A', 'C'])
    await user.click(checkButton())
    await user.click(checkButton())

    expect(handlers.onWrong).toHaveBeenNthCalledWith(1, false)
    expect(handlers.onWrong).toHaveBeenNthCalledWith(2, true)
  })

  it('перестановка карточки снимает подсветку ошибок', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['B', 'A', 'C'])
    await user.click(checkButton())
    await user.click(slots(container)[0])

    expect(screen.queryByText(/Порядок неверный/)).not.toBeInTheDocument()
  })

  it('исправленный прогноз засчитывается как «не с первой попытки»', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['B', 'A', 'C'])
    await user.click(checkButton())

    await user.click(slots(container)[0])
    await user.click(slots(container)[1])
    await placeByClick(user, container, ['A', 'B'])
    await user.click(checkButton())

    expect(handlers.onPredictionMissed).toHaveBeenCalledOnce()
    expect(handlers.onCorrect).not.toHaveBeenCalled()
    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('ответ показывается только после двух ошибок', async () => {
    const { container, user } = setup()

    expect(screen.queryByRole('button', { name: /Показать правильный порядок/ })).not.toBeInTheDocument()

    await placeByClick(user, container, ['B', 'A', 'C'])
    await user.click(checkButton())
    expect(screen.queryByRole('button', { name: /Показать правильный порядок/ })).not.toBeInTheDocument()

    await user.click(checkButton())
    expect(screen.getByRole('button', { name: /Показать правильный порядок/ })).toBeInTheDocument()
  })

  it('показанный ответ закрывает задание без очков', async () => {
    const { container, user } = setup()

    await placeByClick(user, container, ['B', 'A', 'C'])
    await user.click(checkButton())
    await user.click(checkButton())
    await user.click(screen.getByRole('button', { name: /Показать правильный порядок/ }))

    expect(slotLabels(container)).toEqual(['A', 'B', 'C'])
    expect(handlers.onCorrect).not.toHaveBeenCalled()
    expect(handlers.onPredictionMissed).toHaveBeenCalledOnce()
    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('в Learning Mode ответ доступен сразу', async () => {
    setup(false, true)
    expect(screen.getByRole('button', { name: /Показать правильный порядок/ })).toBeInTheDocument()
  })

  it('решённое задание показывает правильный порядок и вердикт', () => {
    const { container } = setup(true)

    expect(slotLabels(container)).toEqual(['A', 'B', 'C'])
    expect(screen.getByText(/Прогноз принят/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ПРОВЕРИТЬ ПРОГНОЗ/ })).not.toBeInTheDocument()
  })

  it('повторяющиеся строки раскладываются по всем позициям', async () => {
    const repeated: PredictOutputChallenge = {
      ...challenge,
      id: 'repeated',
      cards: ['A', 'B', 'A'],
      answer: ['A', 'A', 'B'],
    }
    const localHandlers = makeHandlers()
    const user = userEvent.setup()
    const { container } = render(
      <PredictOutput challenge={repeated} handlers={localHandlers} solved={false} />,
    )

    await placeByClick(user, container, ['A', 'A', 'B'])
    await user.click(checkButton())

    expect(localHandlers.onCorrect).toHaveBeenCalledExactlyOnceWith('prediction')
  })
})
