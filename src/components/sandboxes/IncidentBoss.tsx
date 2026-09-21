import { useEffect, useRef, useState } from 'react'
import type { ChallengeHandlers } from '../challengeTypes'
import { useSolvedOnce } from '../useSolvedOnce'

interface Metric {
  label: string
  value: string
  state: 'ok' | 'bad'
}

const METRICS: Metric[] = [
  { label: 'Requests/sec', value: '184', state: 'ok' },
  { label: 'p95 latency', value: '7.8 sec', state: 'bad' },
  { label: 'CPU', value: '100%', state: 'bad' },
  { label: 'RAM', value: '43%', state: 'ok' },
  { label: 'Database', value: 'OK', state: 'ok' },
  { label: 'Network', value: 'OK', state: 'ok' },
]

const REQUESTS = [
  { path: 'GET /report', state: 'RUNNING' },
  { path: 'GET /users', state: 'WAITING' },
  { path: 'GET /profile', state: 'WAITING' },
  { path: 'GET /orders', state: 'WAITING' },
  { path: 'GET /health', state: 'WAITING' },
]

interface Probe {
  id: string
  label: string
  verdict: string
  state: 'ok' | 'bad'
  detail: string
}

const PROBES: Probe[] = [
  {
    id: 'database',
    label: 'DATABASE',
    verdict: 'OK',
    state: 'ok',
    detail: 'db.getData() отвечает за 38–45 мс, пул соединений свободен на 80%.',
  },
  {
    id: 'network',
    label: 'NETWORK',
    verdict: 'OK',
    state: 'ok',
    detail: 'Потерь пакетов нет, RTT до балансировщика 3 мс.',
  },
  {
    id: 'memory',
    label: 'MEMORY',
    verdict: 'OK',
    state: 'ok',
    detail: 'Heap 43%, GC-паузы < 12 мс, роста между деплоями нет.',
  },
  {
    id: 'event-loop',
    label: 'EVENT LOOP',
    verdict: 'BLOCKED',
    state: 'bad',
    detail: 'Event loop lag: 6400 мс. Между итерациями цикла проходит больше 6 секунд.',
  },
  {
    id: 'cpu',
    label: 'CPU',
    verdict: '100%',
    state: 'bad',
    detail: 'Профиль: 94% времени внутри calculateReport() — синхронный вызов в хендлере /report.',
  },
]

export function IncidentBoss({ handlers }: { handlers: ChallengeHandlers; solved: boolean }) {
  const [checked, setChecked] = useState<string[]>([])
  const [probing, setProbing] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  useSolvedOnce(checked.length === PROBES.length, handlers.onSolved)

  useEffect(() => {
    const list = timers.current
    return () => list.forEach((id) => window.clearTimeout(id))
  }, [])

  function probe(id: string) {
    if (probing || checked.includes(id)) return
    setProbing(id)
    const timer = window.setTimeout(() => {
      setProbing(null)
      setChecked((prev) => (prev.includes(id) ? prev : [...prev, id]))
    }, 550)
    timers.current.push(timer)
  }

  return (
    <div className="sandbox incident">
      <div className="incident__banner">🚨 PRODUCTION INCIDENT — /report деградирует, алерты горят</div>

      <div className="incident__metrics">
        {METRICS.map((metric) => (
          <div key={metric.label} className={`metric is-${metric.state}`}>
            <span className="metric__label">{metric.label}</span>
            <strong className="metric__value">{metric.value}</strong>
            <span className="metric__dot" aria-hidden="true">
              {metric.state === 'ok' ? '🟢' : '🔴'}
            </span>
          </div>
        ))}
      </div>

      <div className="incident__requests">
        {REQUESTS.map((request) => (
          <div key={request.path} className={`incident__request is-${request.state.toLowerCase()}`}>
            <span>{request.path}</span>
            <span>{request.state}</span>
          </div>
        ))}
      </div>

      <div className="incident__probes">
        {PROBES.map((item) => {
          const done = checked.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              className={`probe${done ? ` is-done is-${item.state}` : ''}`}
              onClick={() => probe(item.id)}
              disabled={done || probing !== null}
            >
              <span className="probe__label">{item.label}</span>
              <span className="probe__verdict">
                {probing === item.id ? 'проверяю…' : done ? item.verdict : 'проверить'}
              </span>
              {done ? <span className="probe__detail">{item.detail}</span> : null}
            </button>
          )
        })}
      </div>

      <p className="sandbox__note">
        {checked.length < PROBES.length
          ? `Проверено ${checked.length} из ${PROBES.length} компонентов.`
          : 'Расследование завершено: БД, сеть и память здоровы, Event Loop заблокирован, CPU в полке.'}
      </p>
    </div>
  )
}
