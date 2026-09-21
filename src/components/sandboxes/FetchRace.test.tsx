import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeHandlers, type MockHandlers } from '../../test/helpers'
import { FetchRace } from './FetchRace'

// Лаборатория ускоряет время в 4 раза: 4500 мс сценария ≈ 1125 мс на часах.
const SEQUENTIAL_MS = 1200
const CONCURRENT_MS = 800

let handlers: MockHandlers

beforeEach(() => {
  vi.useFakeTimers()
  handlers = makeHandlers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  return render(<FetchRace handlers={handlers} solved={false} />)
}

const runA = () => screen.getByRole('button', { name: /Вариант A/ })
const runB = () => screen.getByRole('button', { name: /Вариант B/ })

function play(button: HTMLElement, ms: number) {
  fireEvent.click(button)
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

const waterfall = (container: HTMLElement, index: number) =>
  container.querySelectorAll<HTMLElement>('.waterfall')[index]

describe('лаборатория fetch: последовательно против Promise.all', () => {
  it('показывает оба таймлайна с итоговым временем', () => {
    const { container } = setup()

    expect(within(waterfall(container, 0)).getByText('A — три await подряд')).toBeInTheDocument()
    expect(within(waterfall(container, 0)).getByText('≈ 4500 ms')).toBeInTheDocument()
    expect(within(waterfall(container, 1)).getByText('B — Promise.all')).toBeInTheDocument()
    expect(within(waterfall(container, 1)).getByText('≈ 3000 ms')).toBeInTheDocument()
    expect(screen.getByText(/Запусти оба варианта/)).toBeInTheDocument()
  })

  it('перечисляет три запроса в каждом варианте', () => {
    setup()

    for (const endpoint of ['/api/users', '/api/orders', '/api/profile']) {
      expect(screen.getAllByText(endpoint)).toHaveLength(2)
    }
  })

  it('вариант A проигрывается до конца и показывает длительности запросов', () => {
    const { container } = setup()

    play(runA(), SEQUENTIAL_MS)

    expect(screen.getByText('t = 4500 ms')).toBeInTheDocument()
    const rows = within(waterfall(container, 0)).getAllByText(/ ms$/)
    expect(rows.map((row) => row.textContent)).toEqual(
      expect.arrayContaining(['1000 ms', '3000 ms', '500 ms']),
    )
  })

  it('вариант B укладывается в самый долгий запрос', () => {
    setup()

    play(runB(), CONCURRENT_MS)

    expect(screen.getByText('t = 3000 ms')).toBeInTheDocument()
  })

  it('оба прогона закрывают задание и показывают разницу', () => {
    setup()

    play(runA(), SEQUENTIAL_MS)
    expect(handlers.onSolved).not.toHaveBeenCalled()
    expect(screen.getByText(/Запусти оба варианта/)).toBeInTheDocument()

    play(runB(), CONCURRENT_MS)

    expect(handlers.onSolved).toHaveBeenCalledOnce()
    expect(screen.getByText(/Разница — 1500 мс на ровном месте/)).toBeInTheDocument()
  })

  it('результат прошлого прогона остаётся на экране при запуске второго', () => {
    const { container } = setup()

    play(runA(), SEQUENTIAL_MS)
    play(runB(), CONCURRENT_MS)

    // Полоски первого варианта по-прежнему дорисованы до конца.
    expect(within(waterfall(container, 0)).getAllByText(/ ms$/).length).toBeGreaterThanOrEqual(3)
  })

  it('повторный запуск того же варианта не ломает лабораторию', () => {
    setup()

    play(runA(), SEQUENTIAL_MS)
    play(runA(), SEQUENTIAL_MS)

    expect(screen.getByText('t = 4500 ms')).toBeInTheDocument()
  })

  it('уход со страницы во время прогона не роняет игру', () => {
    const { unmount } = setup()

    fireEvent.click(runA())
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(() => unmount()).not.toThrow()
    expect(() => vi.advanceTimersByTime(SEQUENTIAL_MS)).not.toThrow()
  })
})
