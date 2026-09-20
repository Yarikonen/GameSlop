import { useEffect, useRef, useState } from 'react'
import type { ChallengeHandlers } from '../challengeTypes'
import { useSolvedOnce } from '../useSolvedOnce'

interface Endpoint {
  name: string
  ms: number
}

const ENDPOINTS: Endpoint[] = [
  { name: '/api/users', ms: 1000 },
  { name: '/api/orders', ms: 3000 },
  { name: '/api/profile', ms: 500 },
]

const SPEED = 4 // ускорение времени в лаборатории
const SCALE_MS = 4500

type Mode = 'sequential' | 'concurrent'

interface Bar {
  name: string
  start: number
  end: number
}

function schedule(mode: Mode): Bar[] {
  if (mode === 'concurrent') {
    return ENDPOINTS.map((endpoint) => ({ name: endpoint.name, start: 0, end: endpoint.ms }))
  }
  let cursor = 0
  return ENDPOINTS.map((endpoint) => {
    const bar = { name: endpoint.name, start: cursor, end: cursor + endpoint.ms }
    cursor = bar.end
    return bar
  })
}

const TOTALS: Record<Mode, number> = {
  sequential: Math.max(...schedule('sequential').map((bar) => bar.end)),
  concurrent: Math.max(...schedule('concurrent').map((bar) => bar.end)),
}

function Waterfall({ mode, clock }: { mode: Mode; clock: number }) {
  const bars = schedule(mode)
  const total = TOTALS[mode]
  return (
    <div className="waterfall">
      <div className="waterfall__head">
        <span>{mode === 'sequential' ? 'A — три await подряд' : 'B — Promise.all'}</span>
        <strong className={mode === 'concurrent' ? 'is-fast' : 'is-slow'}>≈ {total} ms</strong>
      </div>
      {bars.map((bar) => {
        const visible = Math.max(0, Math.min(clock, bar.end) - bar.start)
        return (
          <div key={bar.name} className="waterfall__row">
            <span className="waterfall__label">{bar.name}</span>
            <span className="waterfall__track">
              <span
                className={`waterfall__bar${clock >= bar.end ? ' is-done' : ''}`}
                style={{
                  left: `${(bar.start / SCALE_MS) * 100}%`,
                  width: `${(visible / SCALE_MS) * 100}%`,
                }}
              />
            </span>
            <span className="waterfall__ms">{clock >= bar.end ? `${bar.end - bar.start} ms` : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

export function FetchRace({ handlers }: { handlers: ChallengeHandlers; solved: boolean }) {
  const [clock, setClock] = useState(0)
  const [mode, setMode] = useState<Mode | null>(null)
  const [done, setDone] = useState<Record<Mode, boolean>>({ sequential: false, concurrent: false })
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  useSolvedOnce(done.sequential && done.concurrent, handlers.onSolved)

  function run(next: Mode) {
    cancelAnimationFrame(frame.current)
    setMode(next)
    setClock(0)
    const total = TOTALS[next]
    const started = performance.now()
    const tick = () => {
      const elapsed = (performance.now() - started) * SPEED
      if (elapsed >= total) {
        setClock(total)
        setDone((prev) => ({ ...prev, [next]: true }))
        return
      }
      setClock(elapsed)
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  return (
    <div className="sandbox fetch-race">
      <div className="sandbox__controls">
        <button type="button" className="btn" onClick={() => run('sequential')}>
          ▶ Вариант A (await подряд)
        </button>
        <button type="button" className="btn" onClick={() => run('concurrent')}>
          ▶ Вариант B (Promise.all)
        </button>
        <span className="sandbox__clock">t = {Math.round(mode ? clock : 0)} ms</span>
      </div>

      <Waterfall mode="sequential" clock={mode === 'sequential' ? clock : done.sequential ? TOTALS.sequential : 0} />
      <Waterfall mode="concurrent" clock={mode === 'concurrent' ? clock : done.concurrent ? TOTALS.concurrent : 0} />

      {done.sequential && done.concurrent ? (
        <p className="sandbox__note">
          Разница — 1500 мс на ровном месте. Запросы одни и те же, отличается только момент их старта.
        </p>
      ) : (
        <p className="sandbox__note">Запусти оба варианта, чтобы сравнить таймлайны.</p>
      )}
    </div>
  )
}
