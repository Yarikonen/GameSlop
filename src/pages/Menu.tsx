import { RANKS, rankFor } from '../engine/scoring'
import { levels } from '../levels'
import { useGame } from '../state/gameStore'

interface MenuProps {
  onOpenLevel: (levelId: string) => void
  onResults: () => void
}

export function Menu({ onOpenLevel, onResults }: MenuProps) {
  const { state, dispatch, recordFor } = useGame()
  const rank = rankFor(state.score)
  const firstUnfinished = levels.find((level) => !recordFor(level.id).completed) ?? levels[0]
  const completedCount = levels.filter((level) => recordFor(level.id).completed).length

  return (
    <main className="screen menu">
      <header className="menu__hero">
        <h1 className="menu__title">
          EVENT <span>LOOP</span> ARENA
        </h1>
        <p className="menu__subtitle">
          Интерактивный тренажёр модели выполнения JavaScript: Call Stack, Web APIs, Microtask Queue,
          Task Queue и сам Event Loop. 30–40 минут, 10 уровней, один финальный инцидент в production.
        </p>
        <div className="menu__stats">
          <span>
            SCORE <strong>{state.score}</strong>
          </span>
          <span>
            ПРОЙДЕНО <strong>{completedCount} / {levels.length}</strong>
          </span>
          <span>
            РАНГ <strong>{rank.title}</strong>
          </span>
        </div>
        <div className="menu__actions">
          <button type="button" className="btn btn--primary btn--big" onClick={() => onOpenLevel(firstUnfinished.id)}>
            {completedCount === 0 ? '▶ НАЧАТЬ' : '▶ ПРОДОЛЖИТЬ'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onResults} disabled={completedCount === 0}>
            ИТОГИ
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (window.confirm('Сбросить весь прогресс и очки?')) dispatch({ type: 'reset' })
            }}
          >
            СБРОСИТЬ ПРОГРЕСС
          </button>
        </div>
      </header>

      <section className="menu__levels">
        {levels.map((level) => {
          const record = recordFor(level.id)
          return (
            <button
              key={level.id}
              type="button"
              className={`level-card${record.completed ? ' is-done' : ''}${level.boss ? ' is-boss' : ''}`}
              onClick={() => onOpenLevel(level.id)}
            >
              <span className="level-card__badge">{level.badge}</span>
              <span className="level-card__title">{level.title}</span>
              <span className="level-card__topic">{level.topic}</span>
              <span className="level-card__status">
                {record.completed ? `✓ ${record.score} очков` : 'не пройден'}
              </span>
            </button>
          )
        })}
      </section>

      <section className="menu__howto">
        <div>
          <h3>Как играть</h3>
          <ol>
            <li>Прочитай код уровня и сделай прогноз — Output собирается перетаскиванием карточек.</li>
            <li>Разложи операции по очередям или сам выполни алгоритм Event Loop.</li>
            <li>Запусти симуляцию: STEP — по одной операции, RUN — целиком.</li>
            <li>Сравни свой прогноз с реальным порядком выполнения и прочитай разбор.</li>
          </ol>
        </div>
        <div>
          <h3>Ранги</h3>
          <ul className="menu__ranks">
            {RANKS.map((item) => (
              <li key={item.title} className={item.title === rank.title ? 'is-current' : ''}>
                <strong>{item.title}</strong>
                <span>от {item.min}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
