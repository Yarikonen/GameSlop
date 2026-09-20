import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  subtitle?: string
  tone?: 'stack' | 'runtime' | 'microtask' | 'task' | 'output' | 'neutral'
  active?: boolean
  count?: number
  children: ReactNode
  className?: string
}

export function Panel({ title, subtitle, tone = 'neutral', active, count, children, className }: PanelProps) {
  return (
    <section className={`panel tone-${tone}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}>
      <header className="panel__head">
        <h3 className="panel__title">{title}</h3>
        {subtitle ? <span className="panel__subtitle">{subtitle}</span> : null}
        {count !== undefined ? <span className="panel__count">{count}</span> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  )
}
