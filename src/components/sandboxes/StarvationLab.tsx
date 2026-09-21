import { useEffect, useRef, useState } from 'react'
import type { ChallengeHandlers } from '../challengeTypes'
import { useSolvedOnce } from '../useSolvedOnce'

const LIMIT_MS = 1200
const SAMPLES = 8

interface RunResult {
  mode: 'starve' | 'fixed'
  units: number
  helloDelay: number
  frames: number
  samples: number[]
}

export function StarvationLab({ handlers }: { handlers: ChallengeHandlers; solved: boolean }) {
  const framesRef = useRef(0)
  const [busy, setBusy] = useState<'starve' | 'fixed' | null>(null)
  const [results, setResults] = useState<Record<'starve' | 'fixed', RunResult | null>>({
    starve: null,
    fixed: null,
  })

  useEffect(() => {
    let raf = 0
    const loop = () => {
      framesRef.current += 1
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useSolvedOnce(results.starve !== null, handlers.onSolved)

  function publish(result: RunResult) {
    setResults((prev) => ({ ...prev, [result.mode]: result }))
    setBusy(null)
  }

  /** Настоящая цепочка микрозадач — с аварийным стопом по времени. */
  function runStarvation() {
    if (busy) return
    setBusy('starve')
    window.setTimeout(() => {
      const started = performance.now()
      const frames0 = framesRef.current
      const samples: number[] = []
      let units = 0
      let helloDelay = -1
      let nextSample = LIMIT_MS / SAMPLES

      window.setTimeout(() => {
        helloDelay = Math.round(performance.now() - started)
      }, 0)

      const step = () => {
        units += 1
        const elapsed = performance.now() - started
        if (elapsed >= nextSample && samples.length < SAMPLES) {
          samples.push(units)
          nextSample += LIMIT_MS / SAMPLES
        }
        if (elapsed < LIMIT_MS) {
          Promise.resolve().then(step)
          return
        }
        // Цепочка оборвана: теперь очередь задач наконец получает управление.
        window.setTimeout(() => {
          publish({
            mode: 'starve',
            units,
            helloDelay: helloDelay < 0 ? Math.round(performance.now() - started) : helloDelay,
            frames: framesRef.current - frames0,
            samples,
          })
        }, 0)
      }

      Promise.resolve().then(step)
    }, 80)
  }

  /** Та же работа, но порциями через очередь задач. */
  function runFixed() {
    if (busy) return
    setBusy('fixed')
    const started = performance.now()
    const frames0 = framesRef.current
    const samples: number[] = []
    let units = 0
    let helloDelay = -1
    let nextSample = LIMIT_MS / SAMPLES

    window.setTimeout(() => {
      helloDelay = Math.round(performance.now() - started)
    }, 0)

    const step = () => {
      const chunkEnd = performance.now() + 4
      while (performance.now() < chunkEnd) units += 1
      const elapsed = performance.now() - started
      if (elapsed >= nextSample && samples.length < SAMPLES) {
        samples.push(units)
        nextSample += LIMIT_MS / SAMPLES
      }
      if (elapsed < LIMIT_MS) {
        window.setTimeout(step, 0)
        return
      }
      publish({
        mode: 'fixed',
        units,
        helloDelay: helloDelay < 0 ? Math.round(performance.now() - started) : helloDelay,
        frames: framesRef.current - frames0,
        samples,
      })
    }

    window.setTimeout(step, 0)
  }

  const starve = results.starve
  const peak = starve ? Math.max(...starve.samples, 1) : 1

  return (
    <div className="sandbox starvation-lab">
      <div className="sandbox__controls">
        <button type="button" className="btn btn--danger" onClick={runStarvation} disabled={busy !== null}>
          {busy === 'starve' ? 'ЦЕПОЧКА КРУТИТСЯ…' : 'ЗАПУСТИТЬ spawn() (1.2 c)'}
        </button>
        <button type="button" className="btn btn--primary" onClick={runFixed} disabled={busy !== null}>
          {busy === 'fixed' ? 'РАБОТАЮ ПОРЦИЯМИ…' : 'ПОЧИНЕННАЯ ВЕРСИЯ (setTimeout)'}
        </button>
      </div>

      {starve ? (
        <div className="starvation-lab__growth">
          <h4>MICROTASKS</h4>
          {starve.samples.map((value, index) => (
            <div key={index} className="growth-row">
              <span className="growth-bar" style={{ width: `${Math.max(6, (value / peak) * 100)}%` }} />
              <span className="growth-value">{value.toLocaleString('ru-RU')}</span>
            </div>
          ))}
          <div className="starvation-lab__starving">
            TASK QUEUE: [ HELLO ] ← STARVING всё это время
          </div>
        </div>
      ) : (
        <p className="sandbox__note">
          Вкладка честно уйдёт в микрозадачи на 1.2 секунды: интерфейс замрёт, а колбэк setTimeout будет ждать.
        </p>
      )}

      <div className="freeze-lab__results">
        {(['starve', 'fixed'] as const).map((mode) => {
          const value = results[mode]
          return (
            <div key={mode} className={`result-card${mode === 'fixed' ? ' is-good' : ' is-bad'}`}>
              <h4>{mode === 'starve' ? 'Цепочка микрозадач' : 'Порции через Task Queue'}</h4>
              {value ? (
                <ul>
                  <li>HELLO выполнился через {value.helloDelay} ms</li>
                  <li>единиц работы: {value.units.toLocaleString('ru-RU')}</li>
                  <li>кадров отрисовано: {value.frames}</li>
                </ul>
              ) : (
                <p className="panel__empty">эксперимент не запускался</p>
              )}
            </div>
          )
        })}
      </div>

      {results.starve && results.fixed ? (
        <p className="sandbox__note">
          Работа сопоставима, разница — в очереди: микрозадачи не отдают управление вообще, порции через
          setTimeout пропускают и таймеры, и рендер.
        </p>
      ) : null}
    </div>
  )
}
