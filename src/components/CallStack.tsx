import type { Operation } from '../engine/types'
import { OpCard } from './OpCard'
import { Panel } from './Panel'

export function CallStack({ ops, active }: { ops: Operation[]; active?: boolean }) {
  // Стек рисуем сверху вниз: верхний фрейм — самый новый.
  const top = [...ops].reverse()
  return (
    <Panel title="Call Stack" subtitle="один поток" tone="stack" active={active} count={ops.length}>
      {ops.length === 0 ? (
        <p className="panel__empty">пусто — Event Loop может работать</p>
      ) : (
        <div className="stack-list">
          {top.map((op, index) => (
            <OpCard key={op.id} op={op} dim={index > 0} />
          ))}
        </div>
      )}
    </Panel>
  )
}
