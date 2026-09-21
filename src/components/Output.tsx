import { Panel } from './Panel'

export function Output({ lines, expected }: { lines: string[]; expected?: string[] }) {
  return (
    <Panel title="Output" subtitle="console" tone="output" count={lines.length}>
      {lines.length === 0 ? (
        <p className="panel__empty">консоль пуста</p>
      ) : (
        <div className="output-list">
          {lines.map((line, index) => (
            <span
              key={`${line}-${index}`}
              className={`output-line${expected && expected[index] !== line ? ' is-unexpected' : ''}`}
              data-flip-id={`out-${index}-${line}`}
            >
              <span className="output-line__index">{index + 1}</span>
              {line}
            </span>
          ))}
        </div>
      )}
    </Panel>
  )
}
