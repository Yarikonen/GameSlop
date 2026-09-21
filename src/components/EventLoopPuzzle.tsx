import { useState } from 'react'
import { validateLoopPick } from '../engine/validator'
import type { EventLoopChallenge, EventLoopItem } from '../engine/types'
import type { ChallengeHandlers } from './challengeTypes'

interface Props {
  challenge: EventLoopChallenge
  handlers: ChallengeHandlers
  solved: boolean
}

export function EventLoopPuzzle({ challenge, handlers, solved }: Props) {
  const [microtasks, setMicrotasks] = useState<EventLoopItem[]>(challenge.microtasks)
  const [tasks, setTasks] = useState<EventLoopItem[]>(challenge.tasks)
  const [output, setOutput] = useState<string[]>([])
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const [running, setRunning] = useState<EventLoopItem | null>(null)

  const finished = microtasks.length === 0 && tasks.length === 0

  function pick(item: EventLoopItem, queue: 'microtask' | 'task') {
    if (solved || finished) return
    const verdictResult = validateLoopPick({ microtasks, tasks }, item.id)

    if (!verdictResult.ok) {
      setVerdict({ ok: false, text: `EVENT LOOP VIOLATION — ${verdictResult.reason}` })
      handlers.onViolation()
      return
    }

    const nextMicro = queue === 'microtask' ? microtasks.slice(1) : [...microtasks]
    const nextTasks = queue === 'task' ? tasks.slice(1) : [...tasks]
    for (const spawn of item.spawns ?? []) {
      if (spawn.queue === 'microtask') nextMicro.push(spawn.item)
      else nextTasks.push(spawn.item)
    }

    setRunning(item)
    window.setTimeout(() => setRunning(null), 400)
    setMicrotasks(nextMicro)
    setTasks(nextTasks)
    if (item.output) setOutput((prev) => [...prev, item.output as string])
    handlers.onCorrect('loop')

    const spawned = item.spawns?.length
      ? ' Обрати внимание: операция поставила новую микрозадачу — она пойдёт раньше следующей task.'
      : ''
    setVerdict({ ok: true, text: `CORRECT — ${item.label} выполнена.${spawned}` })

    if (nextMicro.length === 0 && nextTasks.length === 0) handlers.onSolved()
  }

  return (
    <div className="loop-puzzle">
      <div className="loop-puzzle__stack">
        <span className="loop-puzzle__stack-label">CALL STACK</span>
        <span className={`loop-puzzle__stack-value${running ? ' is-busy' : ''}`}>
          {running ? running.label : 'пусто — выбирай следующую операцию'}
        </span>
      </div>

      <div className="loop-puzzle__queues">
        <div className="loop-queue loop-queue--micro">
          <h4>MICROTASK QUEUE</h4>
          <div className="loop-queue__items">
            {microtasks.length === 0 ? <span className="panel__empty">пусто</span> : null}
            {microtasks.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`chip chip--wide${index === 0 ? ' is-head' : ''}`}
                onClick={() => pick(item, 'microtask')}
                disabled={solved || finished}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="loop-queue loop-queue--task">
          <h4>TASK QUEUE</h4>
          <div className="loop-queue__items">
            {tasks.length === 0 ? <span className="panel__empty">пусто</span> : null}
            {tasks.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`chip chip--wide${index === 0 ? ' is-head' : ''}`}
                onClick={() => pick(item, 'task')}
                disabled={solved || finished}
              >
                {item.label}
                {item.note ? <span className="chip__note">{item.note}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="loop-puzzle__output">
        <span className="loop-puzzle__stack-label">OUTPUT</span>
        <div className="output-list">
          {output.length === 0 ? <span className="panel__empty">пока ничего</span> : null}
          {output.map((line, index) => (
            <span key={`${line}-${index}`} className="output-line">
              {line}
            </span>
          ))}
        </div>
      </div>

      {verdict ? (
        <p className={`challenge__verdict ${verdict.ok ? 'is-ok' : 'is-bad'}`}>
          {verdict.ok ? '✅' : '❌'} {verdict.text}
        </p>
      ) : null}

      {finished ? (
        <p className="challenge__verdict is-ok">Цикл пройден полностью: {output.join(' → ')}</p>
      ) : null}
    </div>
  )
}
