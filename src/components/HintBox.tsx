import { useState } from 'react'
import { POINTS } from '../engine/scoring'

interface HintBoxProps {
  hints: [string, string, string]
  learningMode: boolean
  onUse: () => void
}

export function HintBox({ hints, learningMode, onUse }: HintBoxProps) {
  const [opened, setOpened] = useState(0)
  // В Learning Mode подсказки открыты целиком и бесплатно.
  const visible = learningMode ? hints.length : opened

  function openNext() {
    if (!learningMode) onUse()
    setOpened((value) => Math.min(value + 1, hints.length))
  }

  return (
    <div className="hints">
      <div className="hints__head">
        <h3 className="panel__title">Подсказки</h3>
        <span className="hints__cost">{learningMode ? 'в Learning Mode — бесплатно' : `${POINTS.hintUsed} очков за подсказку`}</span>
      </div>
      <ol className="hints__list">
        {hints.map((hint, index) => (
          <li key={index} className={index < visible ? 'is-open' : 'is-closed'}>
            {index < visible ? hint : `Подсказка ${index + 1} скрыта`}
          </li>
        ))}
      </ol>
      {visible < hints.length ? (
        <button type="button" className="btn btn--ghost btn--small" onClick={openNext}>
          Открыть подсказку {visible + 1}
        </button>
      ) : null}
    </div>
  )
}
