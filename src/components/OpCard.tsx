import type { Operation } from '../engine/types'

const ICONS: Record<string, string> = {
  sync: '▣',
  timer: '⏱',
  promise: '⚡',
  async: '⟳',
  io: '☁',
  frame: '▸',
}

export function OpCard({ op, dim }: { op: Operation; dim?: boolean }) {
  return (
    <div
      className={`op-card kind-${op.kind ?? 'sync'}${dim ? ' is-dim' : ''}`}
      data-flip-id={op.id}
      title={op.note}
    >
      <span className="op-card__icon" aria-hidden="true">
        {ICONS[op.kind ?? 'sync'] ?? '▣'}
      </span>
      <span className="op-card__label">{op.label}</span>
      {op.note ? <span className="op-card__note">{op.note}</span> : null}
    </div>
  )
}
