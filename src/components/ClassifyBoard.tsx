import { useState } from 'react'
import { checkClassify } from '../engine/validator'
import type { ClassifyChallenge } from '../engine/types'
import type { ChallengeHandlers } from './challengeTypes'

interface Props {
  challenge: ClassifyChallenge
  handlers: ChallengeHandlers
  solved: boolean
}

export function ClassifyBoard({ challenge, handlers, solved }: Props) {
  const [placement, setPlacement] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(challenge.items.map((item) => [item.id, null])),
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)

  const tray = challenge.items.filter((item) => placement[item.id] === null)
  const ready = challenge.items.every((item) => placement[item.id] !== null)

  function drop(itemId: string, bucketId: string | null) {
    setWrongIds([])
    setSelected(null)
    setPlacement((prev) => ({ ...prev, [itemId]: bucketId }))
  }

  function check() {
    const result = checkClassify(challenge, placement)
    if (result.correct) {
      handlers.onCorrect('action')
      handlers.onSolved()
      return
    }
    setWrongIds(result.wrongItemIds)
    handlers.onWrong(attempts >= 1)
    setAttempts((value) => value + 1)
  }

  const labelFor = (itemId: string) => challenge.items.find((item) => item.id === itemId)?.label ?? ''

  if (solved) {
    return (
      <div className="classify">
        <div className="classify__buckets">
          {challenge.buckets.map((bucket) => (
            <div key={bucket.id} className={`bucket bucket--${bucket.id} is-correct`}>
              <h4>{bucket.label}</h4>
              {challenge.items
                .filter((item) => challenge.answer[item.id] === bucket.id)
                .map((item) => (
                  <span key={item.id} className="chip chip--static">
                    {item.label}
                  </span>
                ))}
            </div>
          ))}
        </div>
        <p className="challenge__verdict is-ok">✅ Операции разложены верно</p>
      </div>
    )
  }

  return (
    <div className="classify">
      <div
        className="classify__tray"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const id = event.dataTransfer.getData('text/plain')
          if (id) drop(id, null)
        }}
      >
        {tray.length === 0 ? (
          <span className="predict__tray-empty">все операции разложены</span>
        ) : (
          tray.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
              onClick={() => setSelected(selected === item.id ? null : item.id)}
              className={`chip chip--wide${selected === item.id ? ' is-selected' : ''}`}
            >
              {item.label}
            </button>
          ))
        )}
      </div>

      <div className="classify__buckets">
        {challenge.buckets.map((bucket) => (
          <div
            key={bucket.id}
            className={`bucket bucket--${bucket.id}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('text/plain')
              if (id) drop(id, bucket.id)
            }}
            onClick={() => selected && drop(selected, bucket.id)}
          >
            <h4>{bucket.label}</h4>
            {bucket.hint ? <p className="bucket__hint">{bucket.hint}</p> : null}
            <div className="bucket__items">
              {Object.entries(placement)
                .filter(([, value]) => value === bucket.id)
                .map(([itemId]) => (
                  <span
                    key={itemId}
                    className={`chip chip--placed${wrongIds.includes(itemId) ? ' is-wrong' : ''}`}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', itemId)}
                    onClick={(event) => {
                      event.stopPropagation()
                      drop(itemId, null)
                    }}
                  >
                    {labelFor(itemId)}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      {wrongIds.length > 0 ? (
        <p className="challenge__verdict is-bad">❌ Подсвеченные операции лежат не в той очереди.</p>
      ) : null}

      <div className="challenge__actions">
        <button type="button" className="btn btn--primary" disabled={!ready} onClick={check}>
          ПРОВЕРИТЬ
        </button>
      </div>
    </div>
  )
}
