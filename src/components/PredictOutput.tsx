import { useMemo, useState } from 'react'
import { checkPredictOutput } from '../engine/validator'
import type { PredictOutputChallenge } from '../engine/types'
import type { ChallengeHandlers } from './challengeTypes'

interface Props {
  challenge: PredictOutputChallenge
  handlers: ChallengeHandlers
  solved: boolean
}

export function PredictOutput({ challenge, handlers, solved }: Props) {
  const cards = useMemo(
    () => challenge.cards.map((label, index) => ({ id: `card-${index}`, label })),
    [challenge],
  )
  const [slots, setSlots] = useState<Array<string | null>>(() => challenge.answer.map(() => null))
  const [selected, setSelected] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [wrongIndexes, setWrongIndexes] = useState<number[]>([])

  const labelOf = (id: string | null) => cards.find((card) => card.id === id)?.label ?? null
  const tray = cards.filter((card) => !slots.includes(card.id))
  const filled = slots.every((slot) => slot !== null)

  function place(cardId: string, index: number) {
    setWrongIndexes([])
    setSlots((prev) => {
      const next = [...prev]
      const from = next.indexOf(cardId)
      const occupant = next[index]
      next[index] = cardId
      if (from >= 0 && from !== index) next[from] = occupant
      return next
    })
    setSelected(null)
  }

  function removeAt(index: number) {
    setWrongIndexes([])
    setSlots((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }

  function check() {
    const result = checkPredictOutput(challenge, slots.map(labelOf))
    if (result.correct) {
      if (attempts === 0) handlers.onCorrect('prediction')
      else handlers.onPredictionMissed()
      handlers.onSolved()
      return
    }
    setWrongIndexes(result.wrongIndexes)
    handlers.onWrong(attempts >= 1)
    setAttempts((value) => value + 1)
  }

  function reveal() {
    const byLabel = new Map<string, string[]>()
    for (const card of cards) {
      const list = byLabel.get(card.label) ?? []
      list.push(card.id)
      byLabel.set(card.label, list)
    }
    setSlots(challenge.answer.map((label) => byLabel.get(label)?.shift() ?? null))
    setWrongIndexes([])
    handlers.onPredictionMissed()
    handlers.onSolved()
  }

  if (solved) {
    return (
      <div className="predict predict--solved">
        <div className="predict__slots">
          {challenge.answer.map((label, index) => (
            <div key={index} className="slot is-correct">
              <span className="slot__index">{index + 1}</span>
              <span className="chip chip--static">{label}</span>
            </div>
          ))}
        </div>
        <p className="challenge__verdict is-ok">✅ Прогноз принят</p>
      </div>
    )
  }

  return (
    <div className="predict">
      <div
        className="predict__tray"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const id = event.dataTransfer.getData('text/plain')
          const index = slots.indexOf(id)
          if (index >= 0) removeAt(index)
        }}
      >
        {tray.length === 0 ? (
          <span className="predict__tray-empty">все карточки расставлены</span>
        ) : (
          tray.map((card) => (
            <button
              key={card.id}
              type="button"
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', card.id)}
              onClick={() => setSelected(selected === card.id ? null : card.id)}
              className={`chip${selected === card.id ? ' is-selected' : ''}`}
            >
              {card.label}
            </button>
          ))
        )}
      </div>

      <div className="predict__slots">
        {slots.map((slot, index) => (
          <div
            key={index}
            className={`slot${wrongIndexes.includes(index) ? ' is-wrong' : ''}${slot ? ' is-filled' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('text/plain')
              if (id) place(id, index)
            }}
            onClick={() => {
              if (selected) place(selected, index)
              else if (slot) removeAt(index)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              if (selected) place(selected, index)
              else if (slot) removeAt(index)
            }}
          >
            <span className="slot__index">{index + 1}</span>
            {slot ? (
              <span
                className="chip chip--placed"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', slot)}
              >
                {labelOf(slot)}
              </span>
            ) : (
              <span className="slot__hint">перетащи сюда</span>
            )}
          </div>
        ))}
      </div>

      {wrongIndexes.length > 0 ? (
        <p className="challenge__verdict is-bad">
          ❌ Порядок неверный. Подсвечены позиции, которые стоят не на своём месте.
        </p>
      ) : null}

      <div className="challenge__actions">
        <button type="button" className="btn btn--primary" disabled={!filled} onClick={check}>
          ПРОВЕРИТЬ ПРОГНОЗ
        </button>
        {attempts >= 2 || handlers.learningMode ? (
          <button type="button" className="btn btn--ghost" onClick={reveal}>
            Показать правильный порядок
          </button>
        ) : null}
      </div>
    </div>
  )
}
