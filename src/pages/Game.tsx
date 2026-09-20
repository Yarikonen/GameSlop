import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CallStack } from '../components/CallStack'
import { ChallengePanel } from '../components/ChallengePanel'
import { CodePanel } from '../components/CodePanel'
import { HintBox } from '../components/HintBox'
import { MicrotaskQueue } from '../components/MicrotaskQueue'
import { Output } from '../components/Output'
import { Runtime } from '../components/Runtime'
import { Score } from '../components/Score'
import { TaskQueue } from '../components/TaskQueue'
import { Timeline } from '../components/Timeline'
import type { ChallengeHandlers } from '../components/challengeTypes'
import { useFlip } from '../components/flip'
import { POINTS, speedBonus } from '../engine/scoring'
import { useSimulator } from '../engine/simulator'
import type { Challenge } from '../engine/types'
import { levelById, nextLevelId } from '../levels'
import { useGame, type CorrectKind } from '../state/gameStore'

interface GameProps {
  levelId: string
  onExit: () => void
  onOpenLevel: (levelId: string) => void
  onFinish: () => void
}

export function Game({ levelId, onExit, onOpenLevel, onFinish }: GameProps) {
  const level = levelById(levelId)
  const { state, dispatch, recordFor } = useGame()
  const record = recordFor(levelId)

  const [solvedIds, setSolvedIds] = useState<string[]>([])
  const [cursor, setCursor] = useState(0)
  const startedAt = useRef(0)
  const completed = useRef(false)

  // Компонент монтируется заново на каждый уровень (key в App), поэтому
  // достаточно один раз открыть уровень и засечь время.
  useEffect(() => {
    dispatch({ type: 'open-level', levelId })
    startedAt.current = performance.now()
  }, [levelId, dispatch])

  const challenges = useMemo(() => level?.challenges ?? [], [level])
  const preChallenges = useMemo(
    () => challenges.filter((item) => item.gateStep === undefined),
    [challenges],
  )
  const gatedChallenges = useMemo(
    () => challenges.filter((item) => item.gateStep !== undefined),
    [challenges],
  )

  const unsolvedGate = gatedChallenges
    .filter((item) => !solvedIds.includes(item.id))
    .map((item) => item.gateStep as number)
  const simUnlocked = preChallenges.every((item) => solvedIds.includes(item.id))
  const blockAt = simUnlocked ? (unsolvedGate.length ? Math.min(...unsolvedGate) : null) : -1

  const sim = useSimulator(level?.steps ?? [], { blockAt })
  const flipRef = useFlip<HTMLDivElement>(sim.index)

  const markSolved = useCallback((challengeId: string) => {
    setSolvedIds((prev) => (prev.includes(challengeId) ? prev : [...prev, challengeId]))
  }, [])

  const handlersFor = useCallback(
    (challenge: Challenge): ChallengeHandlers => ({
      onCorrect: (kind: CorrectKind) => dispatch({ type: 'correct', levelId, kind }),
      onWrong: (critical?: boolean) => dispatch({ type: 'wrong', levelId, critical }),
      onViolation: () => dispatch({ type: 'violation', levelId }),
      onPredictionMissed: () => dispatch({ type: 'prediction-missed', levelId }),
      onSolved: () => markSolved(challenge.id),
      learningMode: record.learningMode,
    }),
    [dispatch, levelId, markSolved, record.learningMode],
  )

  const allSolved = challenges.every((item) => solvedIds.includes(item.id))
  const finished = allSolved && sim.atEnd

  useEffect(() => {
    if (!level || !finished || completed.current) return
    completed.current = true
    const elapsed = (performance.now() - startedAt.current) / 1000
    const bonus =
      speedBonus(elapsed, level.parTimeSec) + POINTS.levelClear + (level.boss ? POINTS.bossClear : 0)
    dispatch({ type: 'complete', levelId, bonus })
  }, [finished, level, levelId, dispatch])

  if (!level) {
    return (
      <main className="screen">
        <p>Уровень не найден.</p>
        <button type="button" className="btn" onClick={onExit}>
          В меню
        </button>
      </main>
    )
  }

  const gateChallenge = gatedChallenges.find((item) => item.gateStep === sim.index) ?? null
  const preChallenge = cursor < preChallenges.length ? preChallenges[cursor] : null
  const shown = gateChallenge ?? preChallenge
  const shownSolved = shown ? solvedIds.includes(shown.id) : false
  const shownIndex = shown ? challenges.findIndex((item) => item.id === shown.id) : 0
  const nextId = nextLevelId(levelId)
  const phase = sim.step.phase ?? 'idle'

  return (
    <main className="screen game">
      <header className="game__bar">
        <div className="game__title">
          <button type="button" className="btn btn--ghost btn--small" onClick={onExit}>
            ◀ МЕНЮ
          </button>
          <span className="badge">{level.badge}</span>
          <h1>{level.title}</h1>
          <span className="game__topic">{level.topic}</span>
        </div>
        <Score score={state.score} lives={state.lives} learningMode={record.learningMode} />
      </header>

      <div className="game__grid">
        <div className="game__col game__col--code">
          {level.code ? <CodePanel code={level.code} activeLines={sim.step.codeLines} /> : null}
          <section className="panel tone-neutral">
            <header className="panel__head">
              <h3 className="panel__title">Цель уровня</h3>
            </header>
            <div className="panel__body">
              <p className="goal">{level.goal}</p>
              <p className="key-idea">💡 {level.keyIdea}</p>
            </div>
          </section>
          <HintBox
            hints={level.hints}
            learningMode={record.learningMode}
            onUse={() => dispatch({ type: 'hint', levelId })}
          />
        </div>

        <div className="game__col game__col--machine" ref={flipRef}>
          <div className="machine">
            <CallStack ops={sim.step.stack} active={phase === 'sync'} />
            <Runtime ops={sim.step.runtime} active={phase === 'runtime'} />
            <MicrotaskQueue ops={sim.step.microtasks} active={phase === 'microtask'} />
            <TaskQueue ops={sim.step.tasks} active={phase === 'task'} />
          </div>

          <Output lines={sim.step.output} expected={level.expectedOutput} />

          <Timeline
            index={sim.index}
            total={sim.total}
            phase={phase}
            description={sim.step.description}
            onSeek={sim.goTo}
          />

          <div className="controls">
            <button type="button" className="btn" onClick={sim.prev} disabled={sim.atStart}>
              ◀ PREV
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={sim.next}
              disabled={!simUnlocked || sim.blocked || sim.atEnd}
            >
              ▶ STEP
            </button>
            <button
              type="button"
              className="btn btn--accent"
              onClick={sim.toggleRun}
              disabled={!simUnlocked || sim.blocked}
            >
              {sim.playing ? '⏸ PAUSE' : '⏩ RUN'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={sim.reset} disabled={sim.atStart}>
              ⟲ RESET
            </button>
          </div>

          {!simUnlocked ? (
            <p className="controls__lock">
              🔒 Сначала выполни задание справа — симуляция откроется после прогноза.
            </p>
          ) : null}
          {simUnlocked && sim.blocked && !sim.atEnd ? (
            <p className="controls__lock">⏸ Event Loop ждёт твоего ответа на вопрос справа.</p>
          ) : null}
        </div>

        <div className="game__col game__col--challenge">
          {shown ? (
            <ChallengePanel
              key={shown.id}
              challenge={shown}
              handlers={handlersFor(shown)}
              solved={shownSolved}
              index={shownIndex}
              total={challenges.length}
            />
          ) : null}

          {shown && shownSolved && !gateChallenge && cursor < preChallenges.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={() => setCursor((value) => value + 1)}>
              СЛЕДУЮЩЕЕ ЗАДАНИЕ →
            </button>
          ) : null}

          {allSolved && !sim.atEnd ? (
            <section className="panel tone-neutral">
              <header className="panel__head">
                <h3 className="panel__title">Задания пройдены</h3>
              </header>
              <div className="panel__body">
                <p>Запусти симуляцию (RUN) или пройди её по шагам (STEP) до конца, чтобы закрыть уровень.</p>
              </div>
            </section>
          ) : null}

          {finished ? (
            <section className={`panel tone-output debrief${level.boss ? ' debrief--boss' : ''}`}>
              <header className="panel__head">
                <h3 className="panel__title">{level.boss ? 'BOSS DEFEATED' : 'Разбор уровня'}</h3>
              </header>
              <div className="panel__body">
                {level.boss ? <p className="debrief__boss">🏆 Production restored</p> : null}
                <p className="key-idea">💡 {level.keyIdea}</p>
                {level.debrief.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                <div className="challenge__actions">
                  {nextId ? (
                    <button type="button" className="btn btn--primary" onClick={() => onOpenLevel(nextId)}>
                      СЛЕДУЮЩИЙ УРОВЕНЬ →
                    </button>
                  ) : (
                    <button type="button" className="btn btn--primary" onClick={onFinish}>
                      ИТОГИ ПРОХОЖДЕНИЯ →
                    </button>
                  )}
                  <button type="button" className="btn btn--ghost" onClick={onExit}>
                    К списку уровней
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {record.learningMode ? (
            <p className="learning-note">
              LEARNING MODE: жизни закончились, но уровень не заблокирован. Подсказки открыты бесплатно,
              правильные ответы подсвечиваются — разберись и пройди уровень заново.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
