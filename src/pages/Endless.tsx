import { useEffect, useState } from 'react'
import { Score } from '../components/Score'
import { multiplierFor, nextWave, pick, startRun, type EndlessRun } from '../endless/run'
import type { EventLoopItem } from '../engine/types'
import { useGame } from '../state/gameStore'

interface EndlessProps {
  onExit: () => void
}

interface QueueProps {
  title: string
  kind: 'micro' | 'task'
  items: EventLoopItem[]
  disabled: boolean
  onPick: (id: string) => void
}

function Queue({ title, kind, items, disabled, onPick }: QueueProps) {
  return (
    <div className={`loop-queue loop-queue--${kind}`}>
      <h4>{title}</h4>
      <div className="loop-queue__items">
        {items.length === 0 ? <span className="panel__empty">пусто</span> : null}
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`chip chip--wide${index === 0 ? ' is-head' : ''}`}
            onClick={() => onPick(item.id)}
            disabled={disabled}
          >
            {item.label}
            {item.note ? <span className="chip__note">{item.note}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Endless({ onExit }: EndlessProps) {
  const { state, dispatch } = useGame()
  const [run, setRun] = useState<EndlessRun>(() => startRun())
  // Рекорд на момент начала забега: с ним сравниваем результат, когда он уже записан.
  const [previousBest, setPreviousBest] = useState(state.endless)

  useEffect(() => {
    if (run.status !== 'over') return
    dispatch({ type: 'endless-result', wave: run.wave, score: run.score })
  }, [run.status, run.wave, run.score, dispatch])

  const finished = run.status === 'over'
  const cleared = run.status === 'wave-cleared'
  const multiplier = multiplierFor(run.streak)
  const beatenRecord =
    finished && (run.wave > previousBest.bestWave || run.score > previousBest.bestScore)

  function restart() {
    setPreviousBest(state.endless)
    setRun(startRun())
  }

  return (
    <main className="screen endless">
      <header className="game__bar">
        <div className="game__title">
          <button type="button" className="btn btn--ghost btn--small" onClick={onExit}>
            ◀ МЕНЮ
          </button>
          <span className="badge">Endless</span>
          <h1>Бесконечный Event Loop</h1>
          <span className="game__topic">волны не кончаются — кончаются жизни</span>
        </div>
        <Score score={run.score} lives={run.lives} />
      </header>

      <div className="menu__stats endless__stats">
        <span>
          ВОЛНА <strong>{run.wave}</strong>
        </span>
        <span>
          СЕРИЯ <strong>×{multiplier}</strong>
        </span>
        <span>
          РЕКОРД <strong>
            волна {state.endless.bestWave} / {state.endless.bestScore} очков
          </strong>
        </span>
      </div>

      {run.unlocked.length > 0 ? (
        <section className="panel tone-neutral">
          <header className="panel__head">
            <h3 className="panel__title">Новое на этой волне</h3>
          </header>
          <div className="panel__body">
            {run.unlocked.map((intro) => (
              <p key={intro} className="key-idea">
                💡 {intro}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="loop-puzzle endless__board">
        <div className="loop-puzzle__stack">
          <span className="loop-puzzle__stack-label">ПРАВИЛО</span>
          <span className="loop-puzzle__stack-value">
            сначала микрозадачи до последней, потом ровно одна задача — и внутри очереди FIFO
          </span>
        </div>

        <div className="loop-puzzle__queues">
          <Queue
            title="MICROTASK QUEUE"
            kind="micro"
            items={run.microtasks}
            disabled={run.status !== 'playing'}
            onPick={(id) => setRun((current) => pick(current, id))}
          />
          <Queue
            title="TASK QUEUE"
            kind="task"
            items={run.tasks}
            disabled={run.status !== 'playing'}
            onPick={(id) => setRun((current) => pick(current, id))}
          />
        </div>

        <div className="loop-puzzle__output">
          <span className="loop-puzzle__stack-label">OUTPUT</span>
          <div className="output-list">
            {run.output.length === 0 ? <span className="panel__empty">пока ничего</span> : null}
            {run.output.map((line, index) => (
              <span key={`${line}-${index}`} className="output-line">
                {line}
              </span>
            ))}
          </div>
        </div>

        {run.event ? (
          <p className={`challenge__verdict ${run.event.ok ? 'is-ok' : 'is-bad'}`}>
            {run.event.ok ? '✅' : '❌'} {run.event.text}
          </p>
        ) : null}
      </div>

      {cleared ? (
        <div className="challenge__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setRun((current) => nextWave(current))}
          >
            ВОЛНА {run.wave + 1} →
          </button>
        </div>
      ) : null}

      {finished ? (
        <section className="panel tone-output debrief">
          <header className="panel__head">
            <h3 className="panel__title">Забег окончен</h3>
          </header>
          <div className="panel__body">
            <p>
              Жизни кончились на волне {run.wave}. Набрано {run.score} очков.
            </p>
            {beatenRecord ? <p className="key-idea">🏆 Новый рекорд!</p> : null}
            <p>
              Нарушение — это не случайность: очередь микрозадач опустошается полностью, и только
              потом Event Loop берёт одну задачу. Всё, что операция поставила во время выполнения,
              тоже считается.
            </p>
            <div className="challenge__actions">
              <button type="button" className="btn btn--primary" onClick={restart}>
                ЕЩЁ РАЗ
              </button>
              <button type="button" className="btn btn--ghost" onClick={onExit}>
                В меню
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}
