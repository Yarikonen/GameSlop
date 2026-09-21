import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SimulationStep } from './types'

const EMPTY_STEP: SimulationStep = {
  stack: [],
  runtime: [],
  microtasks: [],
  tasks: [],
  output: [],
  description: 'Нажми STEP, чтобы выполнить первую операцию.',
  phase: 'idle',
}

export interface SimulatorOptions {
  /**
   * Индекс шага, дальше которого нельзя идти, пока на нём висит вопрос.
   * Симуляция останавливается ровно на этом шаге.
   */
  blockAt?: number | null
  /** Интервал автопрогона, мс. */
  speed?: number
}

export interface SimulatorApi {
  index: number
  step: SimulationStep
  total: number
  playing: boolean
  atStart: boolean
  atEnd: boolean
  blocked: boolean
  next: () => void
  prev: () => void
  reset: () => void
  toggleRun: () => void
  goTo: (index: number) => void
}

/** Воспроизведение заранее описанного сценария: режимы STEP и RUN. */
export function useSimulator(steps: SimulationStep[], options: SimulatorOptions = {}): SimulatorApi {
  const { blockAt = null, speed = 950 } = options
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)

  const total = steps.length
  const limit = blockAt === null ? total - 1 : Math.min(blockAt, total - 1)
  const blocked = index >= limit && index < total - 1

  useEffect(() => {
    if (!playing) return
    if (index >= limit) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => setIndex((value) => Math.min(value + 1, limit)), speed)
    return () => window.clearTimeout(timer)
  }, [playing, index, limit, speed])

  const next = useCallback(() => {
    setPlaying(false)
    setIndex((value) => Math.min(value + 1, limit))
  }, [limit])

  const prev = useCallback(() => {
    setPlaying(false)
    setIndex((value) => Math.max(value - 1, -1))
  }, [])

  const reset = useCallback(() => {
    setPlaying(false)
    setIndex(-1)
  }, [])

  const goTo = useCallback(
    (value: number) => {
      setPlaying(false)
      setIndex(Math.max(-1, Math.min(value, limit)))
    },
    [limit],
  )

  const toggleRun = useCallback(() => {
    setPlaying((value) => {
      if (value) return false
      setIndex((current) => (current >= total - 1 ? -1 : current))
      return true
    })
  }, [total])

  const step = useMemo(() => (index < 0 ? EMPTY_STEP : steps[index] ?? EMPTY_STEP), [index, steps])

  return {
    index,
    step,
    total,
    playing,
    atStart: index < 0,
    atEnd: index >= total - 1,
    blocked,
    next,
    prev,
    reset,
    toggleRun,
    goTo,
  }
}
