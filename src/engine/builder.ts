import type { LoopPhase, Operation, OperationKind, SimulationStep } from './types'

interface OpInit {
  id: string
  label: string
  kind?: OperationKind
  note?: string
}

interface Meta {
  lines?: number[]
  phase?: LoopPhase
}

/**
 * Маленький конструктор сценариев.
 *
 * Каждая мутация машины сразу записывает снимок состояния, поэтому
 * уровень описывается почти как обычный псевдокод:
 *
 *   const t = new Timeline()
 *   t.push({ id: 'main', label: 'main()' }, 'Скрипт запущен', { lines: [1] })
 */
export class Timeline {
  private stack: Operation[] = []
  private runtime: Operation[] = []
  private microtasks: Operation[] = []
  private tasks: Operation[] = []
  private output: string[] = []
  private recorded: SimulationStep[] = []

  /** Снимок текущего состояния с описанием шага. */
  snap(description: string, meta: Meta = {}): this {
    this.recorded.push({
      stack: this.stack.map(clone),
      runtime: this.runtime.map(clone),
      microtasks: this.microtasks.map(clone),
      tasks: this.tasks.map(clone),
      output: [...this.output],
      description,
      codeLines: meta.lines,
      phase: meta.phase ?? 'sync',
    })
    return this
  }

  push(op: OpInit, description: string, meta: Meta = {}): this {
    this.stack.push(make(op, 'stack'))
    return this.snap(description, meta)
  }

  /** Снять верхний фрейм со стека (опционально напечатав строку). */
  pop(description: string, meta: Meta & { log?: string } = {}): this {
    this.stack.pop()
    if (meta.log !== undefined) this.output.push(meta.log)
    return this.snap(description, meta)
  }

  /** Вызов console.log: фрейм заходит в стек, печатает и выходит. */
  log(text: string, description: string, meta: Meta & { after?: string } = {}): this {
    this.push({ id: `log-${text}-${this.recorded.length}`, label: `console.log("${text}")`, kind: 'sync' }, description, meta)
    this.stack.pop()
    this.output.push(text)
    return this.snap(meta.after ?? `Строка "${text}" напечатана, фрейм снят со стека.`, meta)
  }

  /** Передать работу в Web API / Runtime (таймер, сетевой запрос). */
  toRuntime(op: OpInit, description: string, meta: Meta = {}): this {
    this.runtime.push(make(op, 'runtime'))
    return this.snap(description, { phase: 'runtime', ...meta })
  }

  private takeRuntime(id: string): Operation | undefined {
    const index = this.runtime.findIndex((op) => op.id === id)
    if (index < 0) return undefined
    return this.runtime.splice(index, 1)[0]
  }

  /** Web API закончил работу → колбэк уходит в Task Queue. */
  runtimeToTask(id: string, label: string, description: string, meta: Meta = {}): this {
    const op = this.takeRuntime(id)
    this.tasks.push(make({ id, label, kind: op?.kind ?? 'timer' }, 'task'))
    return this.snap(description, { phase: 'runtime', ...meta })
  }

  /** Web API закончил работу → реакция промиса уходит в Microtask Queue. */
  runtimeToMicro(id: string, label: string, description: string, meta: Meta = {}): this {
    const op = this.takeRuntime(id)
    this.microtasks.push(make({ id, label, kind: op?.kind ?? 'promise' }, 'microtask'))
    return this.snap(description, { phase: 'runtime', ...meta })
  }

  enqueueMicro(op: OpInit, description: string, meta: Meta = {}): this {
    this.microtasks.push(make(op, 'microtask'))
    return this.snap(description, meta)
  }

  enqueueTask(op: OpInit, description: string, meta: Meta = {}): this {
    this.tasks.push(make(op, 'task'))
    return this.snap(description, meta)
  }

  /** Event Loop забирает первую микрозадачу в стек. */
  microToStack(description: string, meta: Meta = {}): this {
    const op = this.microtasks.shift()
    if (op) this.stack.push({ ...op, type: 'stack' })
    return this.snap(description, { phase: 'microtask', ...meta })
  }

  /** Event Loop забирает первую задачу в стек. */
  taskToStack(description: string, meta: Meta = {}): this {
    const op = this.tasks.shift()
    if (op) this.stack.push({ ...op, type: 'stack' })
    return this.snap(description, { phase: 'task', ...meta })
  }

  steps(): SimulationStep[] {
    return this.recorded
  }
}

function make(op: OpInit, type: Operation['type']): Operation {
  return { id: op.id, label: op.label, kind: op.kind ?? 'sync', note: op.note, type }
}

function clone(op: Operation): Operation {
  return { ...op }
}
