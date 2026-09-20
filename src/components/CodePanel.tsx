import { useMemo, type ReactNode } from 'react'

const TOKENS =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|async|await|new|if|else|for|while|=>)\b|\b(console|setTimeout|setInterval|Promise|fetch|queueMicrotask|document|window|app|res|req|db|Worker)\b|\b(\d+)\b/g

function highlight(line: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  TOKENS.lastIndex = 0

  while ((match = TOKENS.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index))
    const [text, comment, string, keyword, builtin, num] = match
    const cls = comment
      ? 'tok-comment'
      : string
        ? 'tok-string'
        : keyword
          ? 'tok-keyword'
          : builtin
            ? 'tok-builtin'
            : num
              ? 'tok-number'
              : ''
    nodes.push(
      <span key={`${match.index}-${text}`} className={cls}>
        {text}
      </span>,
    )
    lastIndex = match.index + text.length
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex))
  return nodes
}

interface CodePanelProps {
  code: string
  activeLines?: number[]
  title?: string
  compact?: boolean
}

export function CodePanel({ code, activeLines = [], title = 'Code', compact }: CodePanelProps) {
  const lines = useMemo(() => code.replace(/\n+$/, '').split('\n'), [code])
  const active = new Set(activeLines)

  return (
    <section className={`panel tone-code code-panel${compact ? ' is-compact' : ''}`}>
      <header className="panel__head">
        <h3 className="panel__title">{title}</h3>
        <span className="panel__subtitle">JavaScript</span>
      </header>
      <pre className="code-panel__body">
        {lines.map((line, index) => (
          <code key={index} className={`code-line${active.has(index + 1) ? ' is-active' : ''}`}>
            <span className="code-line__num">{index + 1}</span>
            <span className="code-line__text">{line === '' ? ' ' : highlight(line)}</span>
          </code>
        ))}
      </pre>
    </section>
  )
}
