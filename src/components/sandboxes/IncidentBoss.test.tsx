import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeHandlers, type MockHandlers } from '../../test/helpers'
import { IncidentBoss } from './IncidentBoss'

const PROBE_MS = 600

let handlers: MockHandlers

beforeEach(() => {
  vi.useFakeTimers()
  handlers = makeHandlers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  return render(<IncidentBoss handlers={handlers} solved={false} />)
}

const probeButton = (label: string) => screen.getByRole('button', { name: new RegExp(label) })

function runProbe(label: string) {
  fireEvent.click(probeButton(label))
  act(() => {
    vi.advanceTimersByTime(PROBE_MS)
  })
}

const ALL_PROBES = ['DATABASE', 'NETWORK', 'MEMORY', 'EVENT LOOP', 'CPU']

describe('финальный босс: расследование инцидента', () => {
  it('показывает алерт, метрики и очередь запросов', () => {
    setup()

    expect(screen.getByText(/PRODUCTION INCIDENT/)).toBeInTheDocument()
    expect(screen.getByText('p95 latency')).toBeInTheDocument()
    expect(screen.getByText('7.8 sec')).toBeInTheDocument()
    expect(screen.getByText('GET /report')).toBeInTheDocument()
    expect(screen.getAllByText('WAITING')).toHaveLength(4)
  })

  it('сначала ничего не проверено', () => {
    setup()

    expect(screen.getByText('Проверено 0 из 5 компонентов.')).toBeInTheDocument()
    expect(screen.getAllByText('проверить')).toHaveLength(5)
  })

  it('проверка компонента занимает время и выдаёт вердикт с деталями', () => {
    setup()

    fireEvent.click(probeButton('DATABASE'))
    expect(screen.getByText('проверяю…')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(PROBE_MS)
    })

    expect(probeButton('DATABASE')).toHaveTextContent('OK')
    expect(screen.getByText(/db.getData\(\) отвечает за 38–45 мс/)).toBeInTheDocument()
    expect(screen.getByText('Проверено 1 из 5 компонентов.')).toBeInTheDocument()
  })

  it('пока идёт одна проверка, другие недоступны', () => {
    setup()

    fireEvent.click(probeButton('DATABASE'))
    expect(probeButton('CPU')).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(PROBE_MS)
    })
    expect(probeButton('CPU')).toBeEnabled()
  })

  it('проверенный компонент повторно не проверяется', () => {
    setup()

    runProbe('DATABASE')
    expect(probeButton('DATABASE')).toBeDisabled()

    fireEvent.click(probeButton('DATABASE'))
    expect(screen.getByText('Проверено 1 из 5 компонентов.')).toBeInTheDocument()
  })

  it('Event Loop и CPU — единственные красные вердикты', () => {
    setup()

    runProbe('EVENT LOOP')
    runProbe('CPU')

    expect(screen.getByText('BLOCKED')).toBeInTheDocument()
    expect(screen.getByText(/Event loop lag: 6400 мс/)).toBeInTheDocument()
    expect(screen.getByText(/94% времени внутри calculateReport\(\)/)).toBeInTheDocument()
  })

  it('полное расследование закрывает задание и подводит итог', () => {
    setup()

    for (const probe of ALL_PROBES) runProbe(probe)

    expect(handlers.onSolved).toHaveBeenCalledOnce()
    expect(
      screen.getByText(/БД, сеть и память здоровы, Event Loop заблокирован, CPU в полке/),
    ).toBeInTheDocument()
    expect(screen.queryByText('проверить')).not.toBeInTheDocument()
  })

  it('незавершённая проверка не мешает размонтированию', () => {
    const { unmount } = setup()

    fireEvent.click(probeButton('CPU'))
    expect(() => unmount()).not.toThrow()
    expect(() => vi.advanceTimersByTime(PROBE_MS)).not.toThrow()
  })
})
