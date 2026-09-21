import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUSY_LOOP_TIMERS, busyLoopClock, makeHandlers, type MockHandlers } from '../../test/helpers'
import { StarvationLab } from './StarvationLab'

const LIMIT_MS = 1200

let handlers: MockHandlers

beforeEach(() => {
  vi.useFakeTimers({ toFake: [...BUSY_LOOP_TIMERS] })
  busyLoopClock()
  handlers = makeHandlers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  return render(<StarvationLab handlers={handlers} solved={false} />)
}

const starveButton = () => screen.getByRole('button', { name: /spawn\(\)|ЦЕПОЧКА КРУТИТСЯ/ })
const fixedButton = () => screen.getByRole('button', { name: /ПОЧИНЕННАЯ ВЕРСИЯ|ПОРЦИЯМИ/ })

/** Дать поработать и таймерам, и цепочке микрозадач. */
async function letItRun(ms = 500) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const card = (container: HTMLElement, index: number) =>
  container.querySelectorAll<HTMLElement>('.result-card')[index]

function report(container: HTMLElement, index: number) {
  const text = card(container, index).textContent ?? ''
  const pick = (pattern: RegExp) => Number(pattern.exec(text)?.[1]?.replace(/\s| /g, '') ?? Number.NaN)
  return {
    helloDelay: pick(/HELLO выполнился через (\d+) ms/),
    units: pick(/единиц работы: ([\d\s ]+)/),
    frames: pick(/кадров отрисовано: (\d+)/),
  }
}

describe('лаборатория голодания очереди задач', () => {
  it('до запуска предупреждает, что вкладка замрёт', () => {
    setup()

    expect(screen.getByText(/Вкладка честно уйдёт в микрозадачи на 1.2 секунды/)).toBeInTheDocument()
    expect(screen.getAllByText('эксперимент не запускался')).toHaveLength(2)
  })

  it('во время цепочки микрозадач кнопки заблокированы', async () => {
    setup()

    fireEvent.click(starveButton())
    expect(starveButton()).toHaveTextContent('ЦЕПОЧКА КРУТИТСЯ…')
    expect(fixedButton()).toBeDisabled()

    await letItRun()
    expect(starveButton()).toBeEnabled()
  })

  it('цепочка микрозадач держит setTimeout в очереди всё время работы', async () => {
    const { container } = setup()

    fireEvent.click(starveButton())
    await letItRun()

    const starve = report(container, 0)
    expect(starve.helloDelay).toBeGreaterThanOrEqual(LIMIT_MS)
    expect(starve.units).toBeGreaterThan(0)
    expect(screen.getByText(/TASK QUEUE: \[ HELLO \] ← STARVING/)).toBeInTheDocument()
  })

  it('рост очереди микрозадач показывается графиком', async () => {
    const { container } = setup()

    fireEvent.click(starveButton())
    await letItRun()

    const rows = container.querySelectorAll('.starvation-lab__growth .growth-row')
    expect(rows.length).toBeGreaterThan(0)
    const values = Array.from(rows).map((row) =>
      Number(row.querySelector('.growth-value')?.textContent?.replace(/\s| /g, '')),
    )
    // Очередь микрозадач только растёт — в этом и беда.
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  it('эксперимента с голоданием достаточно, чтобы закрыть задание', async () => {
    setup()

    fireEvent.click(starveButton())
    await letItRun()

    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('починенная версия отдаёт управление: HELLO больше не ждёт', async () => {
    const { container } = setup()

    fireEvent.click(starveButton())
    await letItRun()
    fireEvent.click(fixedButton())
    await letItRun()

    const starve = report(container, 0)
    const fixed = report(container, 1)

    expect(fixed.helloDelay).toBeLessThan(starve.helloDelay)
    expect(fixed.units).toBeGreaterThan(0)
  })

  it('после обоих прогонов игра формулирует мораль', async () => {
    setup()

    fireEvent.click(starveButton())
    await letItRun()
    fireEvent.click(fixedButton())
    await letItRun()

    expect(screen.getByText(/Работа сопоставима, разница — в очереди/)).toBeInTheDocument()
  })

  it('уход со страницы во время эксперимента не роняет игру', async () => {
    const { unmount } = setup()

    fireEvent.click(starveButton())
    expect(() => unmount()).not.toThrow()
    await expect(letItRun()).resolves.not.toThrow()
  })
})
