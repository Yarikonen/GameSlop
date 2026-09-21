import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MAX_LIVES } from '../engine/scoring'
import type { LoopPhase, Operation, OperationKind } from '../engine/types'
import { CallStack } from './CallStack'
import { CodePanel } from './CodePanel'
import { MicrotaskQueue } from './MicrotaskQueue'
import { OpCard } from './OpCard'
import { Output } from './Output'
import { Panel } from './Panel'
import { Runtime } from './Runtime'
import { Score } from './Score'
import { TaskQueue } from './TaskQueue'
import { Timeline } from './Timeline'

const op = (id: string, patch: Partial<Operation> = {}): Operation => ({
  id,
  label: id,
  type: 'stack',
  kind: 'sync',
  ...patch,
})

describe('панель машины', () => {
  it('показывает заголовок, подпись и счётчик', () => {
    render(
      <Panel title="Call Stack" subtitle="один поток" count={2} tone="stack">
        <span>тело</span>
      </Panel>,
    )

    expect(screen.getByText('Call Stack')).toBeInTheDocument()
    expect(screen.getByText('один поток')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('подсвечивается, когда Event Loop работает именно с ней', () => {
    const { container } = render(
      <Panel title="Task Queue" tone="task" active>
        <span />
      </Panel>,
    )

    expect(container.querySelector('.panel')).toHaveClass('tone-task', 'is-active')
  })
})

describe('карточка операции', () => {
  it('у каждого вида операции свой значок', () => {
    const kinds: Record<OperationKind, string> = {
      sync: '▣',
      timer: '⏱',
      promise: '⚡',
      async: '⟳',
      io: '☁',
      frame: '▸',
    }

    for (const [kind, icon] of Object.entries(kinds) as Array<[OperationKind, string]>) {
      const { container, unmount } = render(<OpCard op={op('x', { kind })} />)
      expect(container.querySelector('.op-card__icon')).toHaveTextContent(icon)
      expect(container.querySelector('.op-card')).toHaveClass(`kind-${kind}`)
      unmount()
    }
  })

  it('показывает пояснение к операции и участвует в анимации перелёта', () => {
    const { container } = render(<OpCard op={op('timer-b', { note: 'держит callback B' })} />)

    expect(screen.getByText('держит callback B')).toBeInTheDocument()
    expect(container.querySelector('[data-flip-id="timer-b"]')).toBeInTheDocument()
  })
})

describe('Call Stack', () => {
  it('пустой стек сообщает, что Event Loop свободен', () => {
    render(<CallStack ops={[]} />)
    expect(screen.getByText('пусто — Event Loop может работать')).toBeInTheDocument()
  })

  it('верхний фрейм рисуется первым, нижние приглушены', () => {
    const { container } = render(
      <CallStack ops={[op('main', { label: 'main()' }), op('hello', { label: 'hello()' })]} />,
    )

    const cards = container.querySelectorAll('.op-card')
    expect(cards[0]).toHaveTextContent('hello()')
    expect(cards[0]).not.toHaveClass('is-dim')
    expect(cards[1]).toHaveTextContent('main()')
    expect(cards[1]).toHaveClass('is-dim')
  })
})

describe('очереди и Web API', () => {
  it('пустой рантайм сообщает, что браузер не занят', () => {
    render(<Runtime ops={[]} />)
    expect(screen.getByText('браузер ничем не занят')).toBeInTheDocument()
  })

  it('очереди показывают порядок операций и их количество', () => {
    const { container } = render(
      <MicrotaskQueue ops={[op('m1', { label: 'then → C' }), op('m2', { label: 'then → D' })]} />,
    )

    expect(container.querySelector('.panel__count')).toHaveTextContent('2')
    const cards = container.querySelectorAll('.op-card__label')
    expect([...cards].map((card) => card.textContent)).toEqual(['then → C', 'then → D'])
  })

  it('пустые очереди так и подписаны', () => {
    const { container: micro } = render(<MicrotaskQueue ops={[]} />)
    const { container: task } = render(<TaskQueue ops={[]} />)

    expect(within(micro).getByText('пусто')).toBeInTheDocument()
    expect(within(task).getByText('пусто')).toBeInTheDocument()
  })
})

describe('Output', () => {
  it('пустая консоль так и подписана', () => {
    render(<Output lines={[]} />)
    expect(screen.getByText('консоль пуста')).toBeInTheDocument()
  })

  it('нумерует напечатанные строки', () => {
    const { container } = render(<Output lines={['A', 'B']} />)

    const indexes = container.querySelectorAll('.output-line__index')
    expect([...indexes].map((node) => node.textContent)).toEqual(['1', '2'])
    expect(container.querySelector('.panel__count')).toHaveTextContent('2')
  })

  it('строка, разошедшаяся с ожидаемым выводом, помечается', () => {
    const { container } = render(<Output lines={['A', 'C']} expected={['A', 'B']} />)

    const lines = container.querySelectorAll('.output-line')
    expect(lines[0]).not.toHaveClass('is-unexpected')
    expect(lines[1]).toHaveClass('is-unexpected')
  })
})

describe('счёт и жизни', () => {
  it('показывает счёт и полный запас жизней', () => {
    const { container } = render(<Score score={1200} lives={MAX_LIVES} />)

    expect(container.querySelector('.score__number')).toHaveTextContent('1200')
    expect(screen.getByLabelText(`Жизни: ${MAX_LIVES} из ${MAX_LIVES}`)).toBeInTheDocument()
    expect(container.querySelectorAll('.heart.is-lost')).toHaveLength(0)
  })

  it('потерянные жизни гаснут', () => {
    const { container } = render(<Score score={0} lives={1} />)

    expect(container.querySelectorAll('.heart.is-lost')).toHaveLength(MAX_LIVES - 1)
  })

  it('в Learning Mode висит бейдж', () => {
    render(<Score score={0} lives={0} learningMode />)
    expect(screen.getByText('LEARNING MODE')).toBeInTheDocument()
  })
})

describe('таймлайн симуляции', () => {
  const setup = (index: number, phase: LoopPhase = 'sync') => {
    const onSeek = vi.fn()
    const user = userEvent.setup()
    const view = render(
      <Timeline index={index} total={4} phase={phase} description="Шаг выполняется" onSeek={onSeek} />,
    )
    return { onSeek, user, ...view }
  }

  it('показывает текущий шаг, фазу и описание', () => {
    setup(1, 'microtask')

    expect(screen.getByText('шаг 2 / 4')).toBeInTheDocument()
    expect(screen.getByText('MICROTASKS')).toBeInTheDocument()
    expect(screen.getByText('Шаг выполняется')).toBeInTheDocument()
  })

  it('называет все фазы Event Loop по-человечески', () => {
    const phases: Record<LoopPhase, string> = {
      sync: 'СИНХРОННЫЙ КОД',
      microtask: 'MICROTASKS',
      task: 'TASK',
      runtime: 'WEB API',
      idle: 'EVENT LOOP FREE',
    }

    for (const [phase, label] of Object.entries(phases) as Array<[LoopPhase, string]>) {
      const { unmount } = setup(0, phase)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('пройденные шаги отмечены, текущий выделен', () => {
    const { container } = setup(1)

    const ticks = container.querySelectorAll('.timeline__tick')
    expect(ticks[0]).toHaveClass('is-done')
    expect(ticks[1]).toHaveClass('is-done', 'is-current')
    expect(ticks[2]).not.toHaveClass('is-done')
  })

  it('по клику перематывает симуляцию на выбранный шаг', async () => {
    const { onSeek, user } = setup(0)

    await user.click(screen.getByRole('button', { name: 'Шаг 3' }))

    expect(onSeek).toHaveBeenCalledExactlyOnceWith(2)
  })
})

describe('панель кода', () => {
  const code = `const timer = 0; // комментарий\nconsole.log("A");\n\nawait fetch(url);`

  it('нумерует строки и подсвечивает текущую', () => {
    const { container } = render(<CodePanel code={code} activeLines={[2]} />)

    const lines = container.querySelectorAll('.code-line')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toHaveClass('is-active')
    expect(lines[0]).not.toHaveClass('is-active')
    expect(lines[3].querySelector('.code-line__num')).toHaveTextContent('4')
  })

  it('раскрашивает ключевые слова, строки, числа, комментарии и встроенные объекты', () => {
    const { container } = render(<CodePanel code={code} />)

    expect(container.querySelector('.tok-keyword')).toHaveTextContent('const')
    expect(container.querySelector('.tok-comment')).toHaveTextContent('// комментарий')
    expect(container.querySelector('.tok-string')).toHaveTextContent('"A"')
    expect(container.querySelector('.tok-number')).toHaveTextContent('0')
    expect(container.querySelector('.tok-builtin')).toHaveTextContent('console')
  })

  it('заголовок и компактный режим настраиваются', () => {
    const { container } = render(<CodePanel code={code} title="Варианты" compact />)

    expect(screen.getByText('Варианты')).toBeInTheDocument()
    expect(container.querySelector('.code-panel')).toHaveClass('is-compact')
  })

  it('пустые строки не схлопываются', () => {
    const { container } = render(<CodePanel code={'a\n\nb'} />)
    expect(container.querySelectorAll('.code-line')).toHaveLength(3)
  })
})
