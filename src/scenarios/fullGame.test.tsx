import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rankFor } from '../engine/scoring'
import { levels } from '../levels'
import {
  BUSY_LOOP_TIMERS,
  busyLoopClock,
  clickButton,
  playLevel,
  renderApp,
  storedProgress,
} from '../test/helpers'

/** Воркер уровня 7: та же работа, но в своём потоке. */
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null

  postMessage(data: number) {
    setTimeout(() => this.onmessage?.({ data: 42 }), data)
  }

  terminate() {}
}

beforeEach(() => {
  // Лаборатории 6–8 и босс живут на таймерах, кадрах и CPU-циклах.
  vi.useFakeTimers({ toFake: [...BUSY_LOOP_TIMERS] })
  busyLoopClock(0.2)
  vi.stubGlobal('Worker', FakeWorker)
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:the-loop-arena',
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const summary = (label: string) => {
  const list = document.querySelector('.results__list') as HTMLElement
  return within(list).getByText(label).closest('div')?.querySelector('dd')?.textContent ?? ''
}

describe('сквозной сценарий: полное прохождение игры', () => {
  it('десять уровней подряд — от Call Stack до победы над production-инцидентом', async () => {
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)

    for (const [index, level] of levels.entries()) {
      expect(screen.getByRole('heading', { level: 1, name: level.title })).toBeInTheDocument()
      expect(screen.getByText(level.goal)).toBeInTheDocument()

      await playLevel(level, container)

      const isLast = index === levels.length - 1
      expect(screen.getByText(isLast ? 'BOSS DEFEATED' : 'Разбор уровня')).toBeInTheDocument()
      if (!isLast) clickButton(/СЛЕДУЮЩИЙ УРОВЕНЬ/)
    }

    // Финал: босс повержен, игра ведёт на экран итогов.
    expect(screen.getByText(/Production restored/)).toBeInTheDocument()
    clickButton(/ИТОГИ ПРОХОЖДЕНИЯ/)

    expect(summary('Пройдено уровней')).toBe(`${levels.length} / ${levels.length}`)
    expect(summary('Final Boss')).toBe('DEFEATED')
    expect(summary('Ошибок в ответах')).toBe('0')
    expect(summary('Event Loop violations')).toBe('0')
    expect(summary('Использовано подсказок')).toBe('0')

    const progress = storedProgress()
    expect(progress).not.toBeNull()
    for (const level of levels) {
      expect(progress?.records[level.id].completed).toBe(true)
      expect(progress?.records[level.id].score).toBeGreaterThan(0)
    }

    // Безошибочное прохождение выводит игрока на высший ранг.
    expect(progress?.score).toBeGreaterThanOrEqual(4500)
    expect(rankFor(progress?.score ?? 0).title).toBe('Event Loop Wizard')
    expect(document.querySelector('.results__rank')).toHaveTextContent('Event Loop Wizard')
  }, 30_000)

  it('все прогнозы безошибочного прохождения засчитаны с первой попытки', async () => {
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)
    for (const [index, level] of levels.entries()) {
      await playLevel(level, container)
      if (index < levels.length - 1) clickButton(/СЛЕДУЮЩИЙ УРОВЕНЬ/)
    }
    clickButton(/ИТОГИ ПРОХОЖДЕНИЯ/)

    const predictions = levels.flatMap((level) =>
      level.challenges.filter((challenge) => challenge.kind === 'predict-output'),
    ).length
    expect(summary('Верных прогнозов')).toBe(`${predictions} / ${predictions}`)
  }, 30_000)
})
