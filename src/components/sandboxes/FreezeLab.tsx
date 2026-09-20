import { useEffect, useRef, useState } from 'react'
import type { ChallengeHandlers } from '../challengeTypes'
import { useSolvedOnce } from '../useSolvedOnce'

const WORK_MS = 1800

/** Честная CPU-bound нагрузка: крутится ровно WORK_MS миллисекунд. */
const WORKER_SOURCE = `
self.onmessage = (event) => {
  const end = performance.now() + event.data
  let acc = 0
  while (performance.now() < end) acc += Math.sqrt(acc + 1)
  self.postMessage(acc)
}
`

function blockFor(ms: number): number {
  const end = performance.now() + ms
  let acc = 0
  while (performance.now() < end) acc += Math.sqrt(acc + 1)
  return acc
}

interface Stats {
  mode: 'sync' | 'worker'
  duration: number
  frames: number
  ticks: number
  clicks: number
}

export function FreezeLab({ handlers }: { handlers: ChallengeHandlers; solved: boolean }) {
  const framesRef = useRef(0)
  const ticksRef = useRef(0)
  const clicksRef = useRef(0)
  const robotRef = useRef<HTMLSpanElement | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const [meters, setMeters] = useState({ frames: 0, ticks: 0, clicks: 0 })
  const [busy, setBusy] = useState<'sync' | 'worker' | null>(null)
  const [stats, setStats] = useState<Record<'sync' | 'worker', Stats | null>>({ sync: null, worker: null })

  useEffect(() => {
    let raf = 0
    const loop = (time: number) => {
      framesRef.current += 1
      if (robotRef.current) {
        robotRef.current.style.transform = `translateX(${Math.round((time / 9) % 240)}px)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const interval = window.setInterval(() => {
      ticksRef.current += 1
      setMeters({ frames: framesRef.current, ticks: ticksRef.current, clicks: clicksRef.current })
    }, 100)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(interval)
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useSolvedOnce(stats.sync !== null && stats.worker !== null, handlers.onSolved)

  function finish(mode: 'sync' | 'worker', duration: number, base: { f: number; t: number; c: number }) {
    setStats((prev) => ({
      ...prev,
      [mode]: {
        mode,
        duration: Math.round(duration),
        frames: framesRef.current - base.f,
        ticks: ticksRef.current - base.t,
        clicks: clicksRef.current - base.c,
      },
    }))
    setBusy(null)
  }

  function runSync() {
    if (busy) return
    setBusy('sync')
    // Даём браузеру отрисовать состояние «идёт расчёт» до того, как всё встанет.
    window.setTimeout(() => {
      const base = { f: framesRef.current, t: ticksRef.current, c: clicksRef.current }
      const started = performance.now()
      blockFor(WORK_MS)
      finish('sync', performance.now() - started, base)
    }, 80)
  }

  function runWorker() {
    if (busy) return
    setBusy('worker')
    if (!workerRef.current) {
      const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' })
      workerRef.current = new Worker(URL.createObjectURL(blob))
    }
    const worker = workerRef.current
    const base = { f: framesRef.current, t: ticksRef.current, c: clicksRef.current }
    const started = performance.now()
    worker.onmessage = () => finish('worker', performance.now() - started, base)
    worker.postMessage(WORK_MS)
  }

  const status = busy === 'sync' ? 'WAITING…' : 'OK'

  return (
    <div className="sandbox freeze-lab">
      <div className="freeze-lab__stage">
        <span ref={robotRef} className="freeze-lab__robot" aria-hidden="true">
          🤖
        </span>
      </div>

      <div className="freeze-lab__meters">
        <span>
          КАДРЫ <strong>{meters.frames}</strong>
        </span>
        <span>
          ТИКИ ТАЙМЕРА <strong>{meters.ticks}</strong>
        </span>
        <span>
          КЛИКИ <strong>{meters.clicks}</strong>
        </span>
      </div>

      <div className="sandbox__controls">
        <button type="button" className="btn btn--danger" onClick={runSync} disabled={busy !== null}>
          {busy === 'sync' ? 'СЧИТАЮ…' : 'CALCULATE REPORT (sync)'}
        </button>
        <button type="button" className="btn btn--primary" onClick={runWorker} disabled={busy !== null}>
          {busy === 'worker' ? 'СЧИТАЮ В ВОРКЕРЕ…' : 'CALCULATE IN WEB WORKER'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            clicksRef.current += 1
            setMeters((prev) => ({ ...prev, clicks: clicksRef.current }))
          }}
        >
          Кликни меня во время расчёта
        </button>
      </div>

      <div className="freeze-lab__status">
        <span>CLICK EVENTS · {status}</span>
        <span>TIMERS · {status}</span>
        <span>RENDER · {status}</span>
      </div>

      <div className="freeze-lab__results">
        {(['sync', 'worker'] as const).map((mode) => {
          const value = stats[mode]
          return (
            <div key={mode} className={`result-card${mode === 'worker' ? ' is-good' : ' is-bad'}`}>
              <h4>{mode === 'sync' ? 'Синхронный расчёт' : 'Web Worker'}</h4>
              {value ? (
                <ul>
                  <li>работа заняла {value.duration} ms</li>
                  <li>кадров отрисовано: {value.frames}</li>
                  <li>тиков таймера (ожидалось ~{Math.round(value.duration / 100)}): {value.ticks}</li>
                </ul>
              ) : (
                <p className="panel__empty">эксперимент не запускался</p>
              )}
            </div>
          )
        })}
      </div>

      <p className="sandbox__note">
        Одна и та же нагрузка. В первом случае она выполняется в главном потоке и убивает кадры и таймеры,
        во втором — в отдельном потоке, и Event Loop остаётся свободным.
      </p>
    </div>
  )
}
