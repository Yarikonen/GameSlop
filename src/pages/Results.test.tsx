import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { levels } from '../levels'
import { makeRecord, renderWithGame, seedProgress } from '../test/helpers'
import { Results } from './Results'

function setup(progress?: Parameters<typeof seedProgress>[0]) {
  if (progress) seedProgress(progress)
  const onMenu = vi.fn()
  const onRestart = vi.fn()
  const view = renderWithGame(<Results onMenu={onMenu} onRestart={onRestart} />)
  return { onMenu, onRestart, ...view }
}

/** Значение из сводки: «Final Boss» встречается ещё и в списке уровней. */
const value = (label: string) => {
  const list = document.querySelector('.results__list') as HTMLElement
  return within(list).getByText(label).closest('div')?.querySelector('dd')?.textContent ?? ''
}

describe('итоги прохождения', () => {
  it('без прогресса показывает нули и живого босса', () => {
    setup()

    expect(value('Пройдено уровней')).toBe(`0 / ${levels.length}`)
    expect(value('Верных прогнозов')).toBe('0 / 0')
    expect(value('Ошибок в ответах')).toBe('0')
    expect(value('Event Loop violations')).toBe('0')
    expect(value('Использовано подсказок')).toBe('0')
    expect(value('Final Boss')).toBe('жив')
  })

  it('собирает статистику по всем уровням', () => {
    setup({
      score: 3000,
      records: {
        level1: makeRecord('level1', {
          completed: true,
          score: 250,
          predictionsCorrect: 1,
          predictionsTotal: 1,
          wrongAnswers: 2,
          hintsUsed: 1,
        }),
        level4: makeRecord('level4', {
          completed: true,
          score: 500,
          violations: 3,
          wrongAnswers: 1,
        }),
      },
    })

    expect(value('Пройдено уровней')).toBe(`2 / ${levels.length}`)
    expect(value('Верных прогнозов')).toBe('1 / 1')
    expect(value('Ошибок в ответах')).toBe('3')
    expect(value('Event Loop violations')).toBe('3')
    expect(value('Использовано подсказок')).toBe('1')
  })

  it('показывает итоговый счёт и ранг с подписью', () => {
    const { container } = setup({ score: 4500, records: {} })

    expect(container.querySelector('.results__score')).toHaveTextContent('4500')
    expect(container.querySelector('.results__rank')).toHaveTextContent('Event Loop Wizard')
    expect(screen.getByText(/Диагностируешь production по одному графику CPU/)).toBeInTheDocument()
  })

  it('побеждённый босс отмечен отдельно', () => {
    setup({ score: 5000, records: { boss: makeRecord('boss', { completed: true, score: 900 }) } })

    expect(value('Final Boss')).toBe('DEFEATED')
  })

  it('перечисляет уровни с набранными очками', () => {
    const { container } = setup({
      score: 250,
      records: { tutorial: makeRecord('tutorial', { completed: true, score: 250 }) },
    })

    const rows = container.querySelectorAll('.results__level')
    expect(rows).toHaveLength(levels.length)
    expect(rows[0]).toHaveClass('is-done')
    expect(within(rows[0] as HTMLElement).getByText('250 очков')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('—')).toBeInTheDocument()
  })

  it('возвращает в меню', async () => {
    const { onMenu, user } = setup()

    await user.click(screen.getByRole('button', { name: 'В МЕНЮ' }))

    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('предлагает пройти игру заново', async () => {
    const { onRestart, user } = setup()

    await user.click(screen.getByRole('button', { name: 'ПРОЙТИ ЗАНОВО' }))

    expect(onRestart).toHaveBeenCalledOnce()
  })
})
