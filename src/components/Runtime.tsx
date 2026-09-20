import type { Operation } from '../engine/types'
import { OpCard } from './OpCard'
import { Panel } from './Panel'

export function Runtime({ ops, active }: { ops: Operation[]; active?: boolean }) {
  return (
    <Panel
      title="Web APIs / Runtime"
      subtitle="таймеры, сеть, I/O"
      tone="runtime"
      active={active}
      count={ops.length}
    >
      {ops.length === 0 ? (
        <p className="panel__empty">браузер ничем не занят</p>
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
