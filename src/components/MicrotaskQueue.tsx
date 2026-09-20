import type { Operation } from '../engine/types'
import { OpCard } from './OpCard'
import { Panel } from './Panel'

export function MicrotaskQueue({ ops, active }: { ops: Operation[]; active?: boolean }) {
  return (
    <Panel
      title="Microtask Queue"
      subtitle="приоритет выше task"
      tone="microtask"
      active={active}
      count={ops.length}
    >
      {ops.length === 0 ? (
        <p className="panel__empty">пусто</p>
      ) : (
        <div className="queue-list">
          {ops.map((op) => (
            <OpCard key={op.id} op={op} />
          ))}
        </div>
      )}
    </Panel>
  )
}
