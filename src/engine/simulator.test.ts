import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSimulator } from './simulator'
import type { SimulationStep } from './types'

function makeSteps(count: number): SimulationStep[] {
  return Array.from({ length: count }, (_, index) => ({
    stack: [],
    runtime: [],
    microtasks: [],
    tasks: [],
    output: [],
    description: `Шаг ${index}`,
    phase: 'sync' as const,
  }))
}

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Автопрогон ставит новый таймер только после перерисовки, поэтому время
 * двигаем по одному тику: иначе React не успеет запланировать следующий шаг.
 */
async function playTicks(count: number, speed: number) {
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(speed)
    })
  }
}

describe('проигрыватель сценария (STEP / RUN)', () => {
  it('стартует до первого шага и подсказывает, что делать', () => {
    const { result } = renderHook(() => useSimulator(makeSteps(3)))

    expect(result.current.index).toBe(-1)
    expect(result.current.atStart).toBe(true)
    expect(result.current.atEnd).toBe(false)
    expect(result.current.total).toBe(3)
    expect(result.current.step.description).toMatch(/Нажми STEP/)
  })

  it('STEP идёт по одному шагу и останавливается на последнем', () => {
    const { result } = renderHook(() => useSimulator(makeSteps(2)))

    act(() => result.current.next())
    expect(result.current.index).toBe(0)
    expect(result.current.step.description).toBe('Шаг 0')

    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    expect(result.current.atEnd).toBe(true)

    act(() => result.current.next())
    expect(result.current.index).toBe(1)
  })

  it('PREV возвращает назад и не уходит за начало', () => {
    const { result } = renderHook(() => useSimulator(makeSteps(2)))

    act(() => result.current.next())
    act(() => result.current.prev())
    expect(result.current.index).toBe(-1)

    act(() => result.current.prev())
    expect(result.current.index).toBe(-1)
    expect(result.current.atStart).toBe(true)
  })

  it('RESET возвращает симуляцию в начало', () => {
    const { result } = renderHook(() => useSimulator(makeSteps(4)))

    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.reset())

    expect(result.current.index).toBe(-1)
    expect(result.current.playing).toBe(false)
  })

  it('перемотка по таймлайну ограничена доступным диапазоном', () => {
    const { result } = renderHook(() => useSimulator(makeSteps(5)))

    act(() => result.current.goTo(3))
    expect(result.current.index).toBe(3)

    act(() => result.current.goTo(99))
    expect(result.current.index).toBe(4)

    act(() => result.current.goTo(-99))
    expect(result.current.index).toBe(-1)
  })

  describe('автопрогон RUN', () => {
    it('проигрывает сценарий до конца и сам останавливается', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSimulator(makeSteps(3), { speed: 10 }))

      act(() => result.current.toggleRun())
      expect(result.current.playing).toBe(true)

      await playTicks(1, 10)
      expect(result.current.index).toBe(0)

      await playTicks(3, 10)
      expect(result.current.index).toBe(2)
      expect(result.current.playing).toBe(false)
      expect(result.current.atEnd).toBe(true)
    })

    it('PAUSE останавливает автопрогон на текущем шаге', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSimulator(makeSteps(5), { speed: 10 }))

      act(() => result.current.toggleRun())
      await playTicks(2, 10)
      act(() => result.current.toggleRun())
      const paused = result.current.index
      expect(paused).toBe(1)

      await playTicks(5, 10)
      expect(result.current.playing).toBe(false)
      expect(result.current.index).toBe(paused)
    })

    it('RUN после финала прокручивает сценарий заново', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSimulator(makeSteps(2), { speed: 10 }))

      act(() => result.current.goTo(1))
      expect(result.current.atEnd).toBe(true)

      act(() => result.current.toggleRun())
      expect(result.current.index).toBe(-1)

      await playTicks(1, 10)
      expect(result.current.index).toBe(0)
    })

    it('STEP вручную выключает автопрогон', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSimulator(makeSteps(5), { speed: 10 }))

      act(() => result.current.toggleRun())
      act(() => result.current.next())
      expect(result.current.playing).toBe(false)
    })
  })

  describe('блокировка вопросом (blockAt)', () => {
    it('симуляция упирается в шаг с вопросом', () => {
      const { result } = renderHook(() => useSimulator(makeSteps(5), { blockAt: 1 }))

      act(() => result.current.next())
      act(() => result.current.next())
      expect(result.current.index).toBe(1)
      expect(result.current.blocked).toBe(true)

      act(() => result.current.next())
      expect(result.current.index).toBe(1)
    })

    it('снятая блокировка отпускает симуляцию дальше', () => {
      const { rerender, result } = renderHook(
        ({ blockAt }: { blockAt: number | null }) => useSimulator(makeSteps(5), { blockAt }),
        { initialProps: { blockAt: 1 as number | null } },
      )

      act(() => result.current.goTo(4))
      expect(result.current.index).toBe(1)

      rerender({ blockAt: null })
      expect(result.current.blocked).toBe(false)

      act(() => result.current.next())
      expect(result.current.index).toBe(2)
    })

    it('blockAt = -1 не пускает игрока даже на первый шаг', () => {
      const { result } = renderHook(() => useSimulator(makeSteps(3), { blockAt: -1 }))

      act(() => result.current.next())
      expect(result.current.index).toBe(-1)
      expect(result.current.blocked).toBe(true)
    })

    it('на последнем шаге блокировка не включается', () => {
      const { result } = renderHook(() => useSimulator(makeSteps(2), { blockAt: 5 }))

      act(() => result.current.goTo(1))
      expect(result.current.atEnd).toBe(true)
      expect(result.current.blocked).toBe(false)
    })

    it('автопрогон останавливается на заблокированном шаге', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSimulator(makeSteps(6), { blockAt: 2, speed: 10 }))

      act(() => result.current.toggleRun())
      await playTicks(6, 10)

      expect(result.current.index).toBe(2)
      expect(result.current.playing).toBe(false)
      expect(result.current.blocked).toBe(true)
    })
  })

  it('пустой сценарий не ломает управление', () => {
    const { result } = renderHook(() => useSimulator([]))

    expect(result.current.total).toBe(0)
    expect(result.current.atEnd).toBe(true)
    act(() => result.current.next())
    expect(result.current.index).toBe(-1)
  })
})
