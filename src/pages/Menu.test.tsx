import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { levels } from '../levels'
import { makeRecord, renderWithGame, seedProgress, storedProgress } from '../test/helpers'
import { Menu } from './Menu'

function setup(progress?: Parameters<typeof seedProgress>[0]) {
  if (progress) seedProgress(progress)
  const onOpenLevel = vi.fn()
  const onResults = vi.fn()
  const onEndless = vi.fn()
  const view = renderWithGame(
    <Menu onOpenLevel={onOpenLevel} onResults={onResults} onEndless={onEndless} />,
  )
  return { onOpenLevel, onResults, onEndless, ...view }
}

const stat = (label: string) =>
  screen.getByText(label).closest('span')?.querySelector('strong')?.textContent ?? ''

/** Карточка уровня: у обучения название совпадает с темой, ищем именно заголовок. */
const levelCard = (title: string) => {
  const heading = screen
    .getAllByText(title)
    .find((node) => node.classList.contains('level-card__title'))
  return heading?.closest('button') as HTMLButtonElement
}

describe('главное меню', () => {
  it('первый запуск: пустой счёт, стартовый ранг и кнопка «НАЧАТЬ»', () => {
    setup()

    expect(stat('SCORE')).toBe('0')
    expect(stat('ПРОЙДЕНО')).toBe(`0 / ${levels.length}`)
    expect(stat('РАНГ')).toBe('Event Loop Intern')
    expect(screen.getByRole('button', { name: /НАЧАТЬ/ })).toBeInTheDocument()
  })

  it('показывает все уровни игры как непройденные', () => {
    const { container } = setup()

    const cards = container.querySelectorAll<HTMLElement>('.level-card:not(.is-endless)')
    expect(cards).toHaveLength(levels.length)

    cards.forEach((card, index) => {
      const level = levels[index]
      expect(card.querySelector('.level-card__badge')).toHaveTextContent(level.badge)
      expect(card.querySelector('.level-card__title')).toHaveTextContent(level.title)
      expect(card.querySelector('.level-card__topic')).toHaveTextContent(level.topic)
      expect(within(card).getByText('не пройден')).toBeInTheDocument()
    })
  })

  it('карточка уровня открывает этот уровень', async () => {
    const { onOpenLevel, user } = setup()

    await user.click(levelCard('You Are The Event Loop'))

    expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('level4')
  })

  it('кнопка «НАЧАТЬ» ведёт в обучение', async () => {
    const { onOpenLevel, user } = setup()

    await user.click(screen.getByRole('button', { name: /НАЧАТЬ/ }))

    expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('tutorial')
  })

  it('итоги закрыты, пока не пройден ни один уровень', () => {
    setup()
    expect(screen.getByRole('button', { name: 'ИТОГИ' })).toBeDisabled()
  })

  describe('с сохранённым прогрессом', () => {
    const progress = {
      score: 1600,
      records: {
        tutorial: makeRecord('tutorial', { completed: true, score: 250 }),
      },
    }

    it('счёт, прогресс и ранг подтягиваются из сохранения', () => {
      setup(progress)

      expect(stat('SCORE')).toBe('1600')
      expect(stat('ПРОЙДЕНО')).toBe(`1 / ${levels.length}`)
      expect(stat('РАНГ')).toBe('Async Developer')
    })

    it('пройденный уровень отмечен галочкой и очками', () => {
      setup(progress)

      const card = levelCard('Call Stack')
      expect(card).toHaveClass('is-done')
      expect(within(card).getByText('✓ 250 очков')).toBeInTheDocument()
    })

    it('кнопка превращается в «ПРОДОЛЖИТЬ» и ведёт на первый непройденный уровень', async () => {
      const { onOpenLevel, user } = setup(progress)

      await user.click(screen.getByRole('button', { name: /ПРОДОЛЖИТЬ/ }))

      expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('level1')
    })

    it('итоги открываются', async () => {
      const { onResults, user } = setup(progress)

      await user.click(screen.getByRole('button', { name: 'ИТОГИ' }))

      expect(onResults).toHaveBeenCalledOnce()
    })

    it('текущий ранг подсвечен в списке рангов', () => {
      const { container } = setup(progress)

      const current = container.querySelectorAll('.menu__ranks .is-current')
      expect(current).toHaveLength(1)
      expect(current[0]).toHaveTextContent('Async Developer')
    })
  })

  it('пройдена вся игра — кнопка ведёт на первый уровень', async () => {
    const { onOpenLevel, user } = setup({
      score: 5000,
      records: Object.fromEntries(
        levels.map((level) => [level.id, makeRecord(level.id, { completed: true, score: 500 })]),
      ),
    })

    expect(stat('ПРОЙДЕНО')).toBe(`${levels.length} / ${levels.length}`)
    await user.click(screen.getByRole('button', { name: /ПРОДОЛЖИТЬ/ }))

    expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('tutorial')
  })

  describe('сброс прогресса', () => {
    const progress = {
      score: 900,
      records: { tutorial: makeRecord('tutorial', { completed: true, score: 900 }) },
    }

    it('спрашивает подтверждение и обнуляет игру', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { user } = setup(progress)

      await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ПРОГРЕСС' }))

      expect(confirm).toHaveBeenCalledWith('Сбросить весь прогресс и очки?')
      expect(stat('SCORE')).toBe('0')
      expect(stat('ПРОЙДЕНО')).toBe(`0 / ${levels.length}`)
      expect(screen.getByRole('button', { name: /НАЧАТЬ/ })).toBeInTheDocument()
      expect(storedProgress()?.score).toBe(0)
    })

    it('отказ от подтверждения сохраняет прогресс', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { user } = setup(progress)

      await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ПРОГРЕСС' }))

      expect(stat('SCORE')).toBe('900')
      expect(stat('ПРОЙДЕНО')).toBe(`1 / ${levels.length}`)
    })
  })

  describe('карточка бесконечного режима', () => {
    it('заперта, пока босс не повержен', async () => {
      const { onEndless, user } = setup()

      const card = screen.getByText('Бесконечный Event Loop').closest('button') as HTMLButtonElement
      expect(card).toBeDisabled()
      expect(card).toHaveTextContent('откроется после Final Boss')

      await user.click(card)
      expect(onEndless).not.toHaveBeenCalled()
    })

    it('после победы над боссом открывается', async () => {
      const { onEndless, user } = setup({
        score: 5000,
        records: { boss: makeRecord('boss', { completed: true, score: 900 }) },
      })

      const card = screen.getByText('Бесконечный Event Loop').closest('button') as HTMLButtonElement
      expect(card).toBeEnabled()
      expect(card).toHaveTextContent('режим открыт')

      await user.click(card)
      expect(onEndless).toHaveBeenCalledOnce()
    })

    it('показывает рекорд, когда он есть', () => {
      setup({
        score: 5000,
        records: { boss: makeRecord('boss', { completed: true, score: 900 }) },
        endless: { bestWave: 14, bestScore: 5100 },
      })

      expect(screen.getByText('Бесконечный Event Loop').closest('button')).toHaveTextContent(
        'рекорд: волна 14 · 5100 очков',
      )
    })
  })

  it('объясняет правила игры и таблицу рангов', () => {
    setup()

    expect(screen.getByText('Как играть')).toBeInTheDocument()
    expect(screen.getByText(/Запусти симуляцию: STEP/)).toBeInTheDocument()
    expect(screen.getByText('Ранги')).toBeInTheDocument()
    expect(screen.getByText('Event Loop Wizard')).toBeInTheDocument()
  })
})
