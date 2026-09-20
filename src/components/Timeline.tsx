import type { LoopPhase } from '../engine/types'

const PHASE_LABEL: Record<LoopPhase, string> = {
  sync: 'СИНХРОННЫЙ КОД',
  microtask: 'MICROTASKS',
  task: 'TASK',
  runtime: 'WEB API',
  idle: 'EVENT LOOP FREE',
}

interface TimelineProps {
  index: number
  total: number
  phase: LoopPhase
  description: string
  onSeek: (index: number) => void
}

export function Timeline({ index, total, phase, description, onSeek }: TimelineProps) {
  return (
    <div className="timeline">
      <div className="timeline__head">
        <span className={`timeline__phase phase-${phase}`}>{PHASE_LABEL[phase]}</span>
        <span className="timeline__counter">
          шаг {Math.max(0, index + 1)} / {total}
        </span>
      </div>
      <div className="timeline__track" role="group" aria-label="Шаги симуляции">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`timeline__tick${i <= index ? ' is-done' : ''}${i === index ? ' is-current' : ''}`}
            onClick={() => onSeek(i)}
            aria-label={`Шаг ${i + 1}`}
          />
        ))}
      </div>
      <p className="timeline__description">{description}</p>
    </div>
  )
}
