import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUSY_LOOP_TIMERS, busyLoopClock, makeHandlers, type MockHandlers } from '../../test/helpers'
import { FreezeLab } from './FreezeLab'

const WORK_MS = 1800

/** Воркер считает столько же, но в своём потоке: главный поток остаётся живым. */
class FakeWorker {
  static terminated = 0
  onmessage: ((event: { data: unknown }) => void) | null = null
  url: string

  constructor(url: string) {
    this.url = url
  }

  postMessage(data: number) {
    setTimeout(() => this.onmessage?.({ data: 42 }), data)
  }

  terminate() {
    FakeWorker.terminated += 1
  }
}

let handlers: MockHandlers

beforeEach(() => {
  vi.useFakeTimers({ toFake: [...BUSY_LOOP_TIMERS] })
  busyLoopClock()
  FakeWorker.terminated = 0
  vi.stubGlobal('Worker', FakeWorker)
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:freeze-lab',
    configurable: true,
    writable: true,
  })
  handlers = makeHandlers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function setup() {
  return render(<FreezeLab handlers={handlers} solved={false} />)
}

const syncButton = () => screen.getByRole('button', { name: /CALCULATE REPORT|СЧИТАЮ…/ })
const workerButton = () => screen.getByRole('button', { name: /WEB WORKER|ВОРКЕРЕ/ })
const card = (container: HTMLElement, index: number) =>
  container.querySelectorAll<HTMLElement>('.result-card')[index]

interface Report {
  duration: number
  frames: number
  ticks: number
  /** Сколько тиков таймера должно было пройти за это время. */
  expectedTicks: number
}

function report(container: HTMLElement, index: number): Report {
  const text = card(container, index).textContent ?? ''
  const pick = (pattern: RegExp) => Number(pattern.exec(text)?.[1] ?? Number.NaN)
  return {
    duration: pick(/работа заняла (\d+) ms/),
    frames: pick(/кадров отрисовано: (\d+)/),
    ticks: pick(/тиков таймера \(ожидалось ~\d+\): (\d+)/),
    expectedTicks: pick(/ожидалось ~(\d+)/),
  }
}
const meter = (label: string) =>
  screen.getByText(label).closest('span')?.querySelector('strong')?.textContent ?? ''

function runSync() {
  fireEvent.click(syncButton())
  act(() => {
    vi.advanceTimersByTime(100)
  })
}

function runWorker() {
  fireEvent.click(workerButton())
  act(() => {
    vi.advanceTimersByTime(WORK_MS + 100)
  })
}

describe('лаборатория блокировки: главный поток против Web Worker', () => {
  it('оба эксперимента начинаются незапущенными', () => {
    const { container } = setup()

    expect(within(card(container, 0)).getByText('Синхронный расчёт')).toBeInTheDocument()
    expect(within(card(container, 1)).getByText('Web Worker')).toBeInTheDocument()
    expect(screen.getAllByText('эксперимент не запускался')).toHaveLength(2)
    expect(handlers.onSolved).not.toHaveBeenCalled()
  })

  it('пока ничего не считается, интерфейс отвечает', () => {
    setup()
    expect(screen.getAllByText(/OK$/).length).toBe(3)
  })

  it('клики по кнопке считаются', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: /Кликни меня/ }))
    expect(meter('КЛИКИ')).toBe('1')
  })

  it('во время синхронного расчёта интерфейс помечен как зависший', () => {
    setup()

    fireEvent.click(syncButton())

    expect(syncButton()).toHaveTextContent('СЧИТАЮ…')
    expect(syncButton()).toBeDisabled()
    expect(workerButton()).toBeDisabled()
    expect(screen.getAllByText(/WAITING…$/).length).toBe(3)

    act(() => {
      vi.advanceTimersByTime(100)
    })
  })

  it('синхронный расчёт съедает тики таймера и кадры', () => {
    const { container } = setup()

    runSync()

    const sync = report(container, 0)
    expect(sync.duration).toBeGreaterThanOrEqual(WORK_MS)
    expect(sync.expectedTicks).toBeGreaterThan(10)
    // Таймер должен был тикнуть ~18 раз, а главный поток не отдал ему ни такта.
    expect(sync.ticks).toBeLessThan(sync.expectedTicks / 4)
  })

  it('расчёт в воркере не мешает таймерам и кадрам главного потока', () => {
    const { container } = setup()

    runWorker()

    const worker = report(container, 1)
    expect(worker.duration).toBeGreaterThanOrEqual(WORK_MS)
    expect(worker.ticks).toBeGreaterThan(worker.expectedTicks / 2)
    expect(worker.frames).toBeGreaterThan(0)
  })

  it('разница между потоками видна в цифрах', () => {
    const { container } = setup()

    runSync()
    runWorker()

    const sync = report(container, 0)
    const worker = report(container, 1)

    // Работа одна и та же, а Event Loop свободен только во втором случае.
    expect(worker.duration).toBeGreaterThanOrEqual(WORK_MS)
    expect(sync.duration).toBeGreaterThanOrEqual(WORK_MS)
    expect(worker.ticks).toBeGreaterThan(sync.ticks * 5)
    expect(worker.frames).toBeGreaterThan(sync.frames)
  })

  it('после обоих экспериментов задание закрывается', () => {
    setup()

    runSync()
    expect(handlers.onSolved).not.toHaveBeenCalled()

    runWorker()
    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('пока считает воркер, второй расчёт не запустить', () => {
    setup()

    fireEvent.click(workerButton())
    expect(workerButton()).toHaveTextContent('СЧИТАЮ В ВОРКЕРЕ…')
    expect(syncButton()).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(WORK_MS + 100)
    })
    expect(syncButton()).toBeEnabled()
  })

  it('уход со страницы останавливает воркер', () => {
    const { unmount } = setup()

    runWorker()
    unmount()

    expect(FakeWorker.terminated).toBe(1)
  })
})
