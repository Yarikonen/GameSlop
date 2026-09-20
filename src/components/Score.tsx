import { MAX_LIVES } from '../engine/scoring'

interface ScoreProps {
  score: number
  lives: number
  learningMode?: boolean
}

export function Score({ score, lives, learningMode }: ScoreProps) {
  return (
    <div className="score">
      <div className="score__value">
        <span className="score__label">SCORE</span>
        <strong key={score} className="score__number">
          {score}
        </strong>
      </div>
      <div className="score__lives" aria-label={`Жизни: ${lives} из ${MAX_LIVES}`}>
        {Array.from({ length: MAX_LIVES }, (_, index) => (
          <span key={index} className={`heart${index < lives ? '' : ' is-lost'}`} aria-hidden="true">
            {index < lives ? '❤️' : '🖤'}
          </span>
        ))}
      </div>
      {learningMode ? <span className="badge badge--learning">LEARNING MODE</span> : null}
    </div>
  )
}
