import { RANKS, rankFor } from '../engine/scoring'
import { levels } from '../levels'
import { useGame } from '../state/gameStore'

interface ResultsProps {
  onMenu: () => void
  onRestart: () => void
}

export function Results({ onMenu, onRestart }: ResultsProps) {
  const { state, recordFor } = useGame()
  const records = levels.map((level) => recordFor(level.id))

  const completed = records.filter((record) => record.completed).length
  const predictionsCorrect = records.reduce((sum, record) => sum + record.predictionsCorrect, 0)
  const predictionsTotal = records.reduce((sum, record) => sum + record.predictionsTotal, 0)
  const violations = records.reduce((sum, record) => sum + record.violations, 0)
  const hints = records.reduce((sum, record) => sum + record.hintsUsed, 0)
  const wrong = records.reduce((sum, record) => sum + record.wrongAnswers, 0)
  const bossDone = recordFor('boss').completed
  const rank = rankFor(state.score)

  return (
    <main className="screen results">
      <h1 className="results__title">EVENT LOOP ARENA</h1>

      <section className="results__card">
        <dl className="results__list">
          <div>
            <dt>Пройдено уровней</dt>
            <dd>
              {completed} / {levels.length}
            </dd>
          </div>
          <div>
            <dt>Верных прогнозов</dt>
            <dd>
              {predictionsCorrect} / {predictionsTotal || 0}
            </dd>
          </div>
          <div>
            <dt>Ошибок в ответах</dt>
            <dd>{wrong}</dd>
          </div>
          <div>
            <dt>Event Loop violations</dt>
            <dd>{violations}</dd>
          </div>
          <div>
            <dt>Использовано подсказок</dt>
            <dd>{hints}</dd>
          </div>
          <div>
            <dt>Final Boss</dt>
            <dd className={bossDone ? 'is-good' : ''}>{bossDone ? 'DEFEATED' : 'жив'}</dd>
          </div>
        </dl>

        <div className="results__score">
          <span>SCORE</span>
          <strong>{state.score}</strong>
        </div>

        <div className="results__rank">
          <span>RANK</span>
          <strong>{rank.title}</strong>
          <p>{rank.caption}</p>
        </div>

        <ul className="menu__ranks results__ranks">
          {RANKS.map((item) => (
            <li key={item.title} className={item.title === rank.title ? 'is-current' : ''}>
              <strong>{item.title}</strong>
              <span>от {item.min}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="results__levels">
        {levels.map((level) => {
          const record = recordFor(level.id)
          return (
            <div key={level.id} className={`results__level${record.completed ? ' is-done' : ''}`}>
              <span>{level.badge}</span>
              <span>{level.title}</span>
              <span>{record.completed ? `${record.score} очков` : '—'}</span>
            </div>
          )
        })}
      </section>

      <div className="challenge__actions">
        <button type="button" className="btn btn--primary" onClick={onMenu}>
          В МЕНЮ
        </button>
        <button type="button" className="btn btn--ghost" onClick={onRestart}>
          ПРОЙТИ ЗАНОВО
        </button>
      </div>
    </main>
  )
}
