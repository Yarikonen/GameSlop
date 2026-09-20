import { useState } from 'react'
import { checkChoice } from '../engine/validator'
import type { ChoiceChallenge } from '../engine/types'
import { CodePanel } from './CodePanel'
import type { ChallengeHandlers } from './challengeTypes'

interface Props {
  challenge: ChoiceChallenge
  handlers: ChallengeHandlers
  solved: boolean
}

export function ChoiceQuestion({ challenge, handlers, solved }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)

  const answerOption = challenge.options.find((option) => option.id === challenge.answer)

  function pick(optionId: string) {
    if (solved) return
    setPicked(optionId)
    if (checkChoice(challenge, optionId)) {
      handlers.onCorrect(attempts === 0 ? (challenge.weight === 'explanation' ? 'explanation' : 'action') : 'action')
      handlers.onSolved()
      return
    }
    setWrongIds((prev) => (prev.includes(optionId) ? prev : [...prev, optionId]))
    handlers.onWrong(attempts >= 1)
    setAttempts((value) => value + 1)
  }

  const wrongPick = picked && wrongIds.includes(picked)
    ? challenge.options.find((option) => option.id === picked)
    : null

  return (
    <div className="choice">
      {challenge.code ? <CodePanel code={challenge.code} title="Варианты" compact /> : null}
      <ul className="choice__list">
        {challenge.options.map((option) => {
          const isAnswer = solved && option.id === challenge.answer
          const isWrong = wrongIds.includes(option.id)
          return (
            <li key={option.id}>
              <button
                type="button"
                className={`choice__option${isAnswer ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                onClick={() => pick(option.id)}
                disabled={solved || isWrong}
              >
                <span className="choice__label">{option.label}</span>
                {option.detail && (isAnswer || handlers.learningMode) ? (
                  <span className="choice__detail">{option.detail}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      {wrongPick ? (
        <p className="challenge__verdict is-bad">
          ❌ {wrongPick.why ?? 'Неверно.'}
        </p>
      ) : null}

      {solved ? (
        <div className="challenge__explanation">
          <p className="challenge__verdict is-ok">✅ Верно: {answerOption?.label}</p>
          <p>{challenge.explanation}</p>
        </div>
      ) : null}

      {!solved && (attempts >= 2 || handlers.learningMode) ? (
        <p className="challenge__nudge">
          LEARNING MODE: правильный ответ — «{answerOption?.label}». Выбери его, чтобы прочитать разбор.
        </p>
      ) : null}
    </div>
  )
}
