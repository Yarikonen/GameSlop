import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LIVES } from '../engine/scoring'
import { makeRecord, renderWithGame, seedProgress, storedProgress } from '../test/helpers'
import { Endless } from './Endless'

function setup(progress?: Parameters<typeof seedProgress>[0]) {
  if (progress) seedProgress(progress)
  const onExit = vi.fn()
  const view = renderWithGame(<Endless onExit={onExit} />)
  return { onExit, ...view }
}

beforeEach(() => {
  // Сид забега берётся из Math.random — фиксируем, чтобы волны повторялись.
  vi.spyOn(Math, 'random').mockReturnValue(0.4242)
})

const queue = (container: HTMLElement, kind: 'micro' | 'task') =>
  container.querySelector<HTMLElement>(`.loop-queue--${kind}`) as HTMLElement
const chips = (container: HTMLElement, kind: 'micro' | 'task') =>
  Array.from(queue(container, kind).querySelectorAll<HTMLButtonElement>('button.chip'))
const output = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.loop-puzzle__output .output-line')).map((l) => l.textContent)
const stat = (label: string) =>
  screen.getByText(label).closest('span')?.querySelector('strong')?.textContent ?? ''

/** Ход по правилам: голова очереди микрозадач, а если она пуста — голова задач. */
function playLegal(container: HTMLElement) {
  const [head] = chips(container, 'micro').length ? chips(container, 'micro') : chips(container, 'task')
  fireEvent.click(head)
}

/** Ход, который правила запрещают: задача при непустой очереди микрозадач. */
function playIllegal(container: HTMLElement) {
  const micro = chips(container, 'micro')
  if (micro.length > 0) {
    fireEvent.click(chips(container, 'task')[0])
    return
  }
  fireEvent.click(chips(container, 'task')[1])
}

/** Разобрать волну целиком. */
function clearWave(container: HTMLElement) {
  for (let guard = 0; guard < 30; guard += 1) {
    if (chips(container, 'micro').length + chips(container, 'task').length === 0) return
    playLegal(container)
  }
}

function endRun(container: HTMLElement) {
  for (let life = 0; life < MAX_LIVES; life += 1) playIllegal(container)
}

describe('экран бесконечного режима', () => {
  it('забег начинается с первой волны и полных жизней', () => {
    const { container } = setup()

    expect(stat('ВОЛНА')).toBe('1')
    expect(stat('СЕРИЯ')).toBe('×1')
    expect(screen.getByLabelText(`Жизни: ${MAX_LIVES} из ${MAX_LIVES}`)).toBeInTheDocument()
    expect(output(container)).toEqual([])
    expect(chips(container, 'micro').length).toBeGreaterThan(0)
    expect(chips(container, 'task').length).toBeGreaterThan(0)
  })

  it('правило написано прямо на экране', () => {
    setup()
    expect(screen.getByText(/сначала микрозадачи до последней, потом ровно одна задача/)).toBeInTheDocument()
  })

  it('показывает рекорд из сохранения', () => {
    setup({ endless: { bestWave: 9, bestScore: 1234 } })
    expect(stat('РЕКОРД')).toBe('волна 9 / 1234 очков')
  })

  describe('ход по правилам', () => {
    it('убирает операцию из очереди и печатает её строку', () => {
      const { container } = setup()
      const [head] = chips(container, 'micro')
      const label = head.textContent

      fireEvent.click(head)

      expect(chips(container, 'micro').map((chip) => chip.textContent)).not.toContain(label)
      expect(output(container)).toHaveLength(1)
      expect(screen.getByText(/верно/)).toBeInTheDocument()
    })

    it('жизни не тратятся', () => {
      const { container } = setup()
      playLegal(container)
      expect(screen.getByLabelText(`Жизни: ${MAX_LIVES} из ${MAX_LIVES}`)).toBeInTheDocument()
    })
  })

  describe('нарушение правил', () => {
    it('объясняет ошибку и снимает жизнь', () => {
      const { container } = setup()

      playIllegal(container)

      expect(screen.getByText(/EVENT LOOP VIOLATION/)).toHaveTextContent('Microtask Queue не пуста')
      expect(screen.getByLabelText(`Жизни: ${MAX_LIVES - 1} из ${MAX_LIVES}`)).toBeInTheDocument()
    })

    it('очереди и Output не меняются — ход можно переделать', () => {
      const { container } = setup()
      const before = chips(container, 'micro').map((chip) => chip.textContent)

      playIllegal(container)

      expect(chips(container, 'micro').map((chip) => chip.textContent)).toEqual(before)
      expect(output(container)).toEqual([])
    })

    it('сбивает серию', () => {
      const { container } = setup()

      // Пять верных ходов подряд — это вся первая волна и ход на второй.
      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 2 →' }))
      playLegal(container)
      const grown = stat('СЕРИЯ')

      playIllegal(container)

      expect(grown).toBe('×2')
      expect(stat('СЕРИЯ')).toBe('×1')
    })
  })

  describe('смена волн', () => {
    it('разобранная волна предлагает следующую', () => {
      const { container } = setup()

      clearWave(container)

      expect(screen.getByText(/Волна 1 разобрана/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'ВОЛНА 2 →' })).toBeInTheDocument()
    })

    it('следующая волна начинается с чистым Output и новым набором операций', () => {
      const { container } = setup()

      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 2 →' }))

      expect(stat('ВОЛНА')).toBe('2')
      expect(output(container)).toEqual([])
      expect(chips(container, 'micro').length).toBeGreaterThan(0)
    })

    it('новые виды операций объясняются при появлении', () => {
      const { container } = setup()

      // До третьей волны доходим, разбирая каждую по правилам.
      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 2 →' }))
      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 3 →' }))

      const intro = screen.getByText('Новое на этой волне').closest('.panel') as HTMLElement
      expect(intro).toHaveTextContent('queueMicrotask кладёт колбэк в ту же очередь микрозадач')
    })
  })

  describe('конец забега', () => {
    it('три нарушения заканчивают забег и подводят итог', () => {
      const { container } = setup()

      endRun(container)

      expect(screen.getByText('Забег окончен')).toBeInTheDocument()
      expect(screen.getByText(/Жизни кончились на волне 1/)).toBeInTheDocument()
      expect(screen.getByLabelText(`Жизни: 0 из ${MAX_LIVES}`)).toBeInTheDocument()
    })

    it('после конца забега ходить нельзя', () => {
      const { container } = setup()

      endRun(container)

      for (const chip of [...chips(container, 'micro'), ...chips(container, 'task')]) {
        expect(chip).toBeDisabled()
      }
    })

    it('результат сохраняется как рекорд', () => {
      const { container } = setup()

      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 2 →' }))
      endRun(container)

      const record = storedProgress()?.endless
      expect(record?.bestWave).toBe(2)
      expect(record?.bestScore).toBeGreaterThan(0)
      expect(screen.getByText(/Новый рекорд/)).toBeInTheDocument()
    })

    it('забег слабее прежнего рекорд не трогает и не хвалится', () => {
      const { container } = setup({ endless: { bestWave: 25, bestScore: 9000 } })

      endRun(container)

      expect(storedProgress()?.endless).toEqual({ bestWave: 25, bestScore: 9000 })
      expect(screen.queryByText(/Новый рекорд/)).not.toBeInTheDocument()
    })

    it('очки курса от забега не меняются', () => {
      const { container } = setup({
        score: 4000,
        records: { boss: makeRecord('boss', { completed: true, score: 900 }) },
      })

      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 2 →' }))
      endRun(container)

      expect(storedProgress()?.score).toBe(4000)
    })

    it('«ЕЩЁ РАЗ» начинает забег заново', () => {
      const { container } = setup()

      endRun(container)
      fireEvent.click(screen.getByRole('button', { name: 'ЕЩЁ РАЗ' }))

      expect(stat('ВОЛНА')).toBe('1')
      expect(screen.getByLabelText(`Жизни: ${MAX_LIVES} из ${MAX_LIVES}`)).toBeInTheDocument()
      expect(screen.queryByText('Забег окончен')).not.toBeInTheDocument()
      expect(output(container)).toEqual([])
    })

    it('рекорд на экране обновляется после забега', () => {
      const { container } = setup()

      clearWave(container)
      fireEvent.click(screen.getByRole('button', { name: 'ВОЛНА 2 →' }))
      endRun(container)

      expect(stat('РЕКОРД')).toMatch(/волна 2/)
    })
  })

  it('из режима можно выйти в меню', () => {
    const { onExit } = setup()

    fireEvent.click(screen.getByRole('button', { name: /МЕНЮ/ }))

    expect(onExit).toHaveBeenCalledOnce()
  })
})
