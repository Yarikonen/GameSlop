import { cleanup, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { levels } from '../levels'
import {
  clickButton,
  playLevel,
  renderApp,
  storedProgress,
  storedRecord,
} from '../test/helpers'

const tutorial = levels[0]
const level1 = levels[1]

const menuStat = (label: string) =>
  screen.getByText(label).closest('span')?.querySelector('strong')?.textContent ?? ''

describe('сквозной сценарий: первая сессия новичка', () => {
  it('меню → обучение → следующий уровень → меню, прогресс сохранён', async () => {
    const { container } = renderApp()

    // 1. Игрок открывает игру и нажимает «НАЧАТЬ».
    expect(menuStat('SCORE')).toBe('0')
    clickButton(/НАЧАТЬ/)

    // 2. Попадает в обучение и проходит его целиком.
    expect(screen.getByRole('heading', { level: 1, name: tutorial.title })).toBeInTheDocument()
    await playLevel(tutorial, container)
    expect(screen.getByText('Разбор уровня')).toBeInTheDocument()

    // 3. Переходит на следующий уровень прямо из разбора.
    clickButton(/СЛЕДУЮЩИЙ УРОВЕНЬ/)
    expect(screen.getByRole('heading', { level: 1, name: level1.title })).toBeInTheDocument()

    // 4. Возвращается в меню — обучение отмечено пройденным.
    clickButton(/МЕНЮ/)
    expect(menuStat('ПРОЙДЕНО')).toBe(`1 / ${levels.length}`)
    expect(screen.getByRole('button', { name: /ПРОДОЛЖИТЬ/ })).toBeInTheDocument()
    expect(storedRecord('tutorial').completed).toBe(true)
  })

  it('«ПРОДОЛЖИТЬ» ведёт на первый непройденный уровень', async () => {
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)
    await playLevel(tutorial, container)
    clickButton('К списку уровней')

    clickButton(/ПРОДОЛЖИТЬ/)

    expect(screen.getByRole('heading', { level: 1, name: level1.title })).toBeInTheDocument()
  })

  it('прогресс переживает перезапуск игры', async () => {
    const first = renderApp()

    clickButton(/НАЧАТЬ/)
    await playLevel(tutorial, first.container)
    clickButton('К списку уровней')
    const score = menuStat('SCORE')
    cleanup()

    // Новая сессия: приложение поднимается с нуля и читает сохранение.
    renderApp()

    expect(menuStat('SCORE')).toBe(score)
    expect(menuStat('ПРОЙДЕНО')).toBe(`1 / ${levels.length}`)
  })

  it('уровень можно выбрать из списка, минуя порядок', async () => {
    const { container } = renderApp()

    fireEvent.click(
      screen
        .getAllByText('You Are The Event Loop')
        .find((node) => node.classList.contains('level-card__title'))
        ?.closest('button') as Element,
    )

    expect(screen.getByText('YOU ARE THE EVENT LOOP')).toBeInTheDocument()
    await playLevel(levels[4], container)

    expect(screen.getByText('Разбор уровня')).toBeInTheDocument()
    expect(storedRecord('level4').completed).toBe(true)
  })
})

describe('сквозной сценарий: игрок ошибается', () => {
  it('нарушение правил Event Loop стоит жизни и попадает в итоги', async () => {
    const { container } = renderApp()

    fireEvent.click(
      screen
        .getAllByText('You Are The Event Loop')
        .find((node) => node.classList.contains('level-card__title'))
        ?.closest('button') as Element,
    )

    // Берём task, пока очередь микрозадач не пуста.
    clickButton(/timeout → B/)
    expect(screen.getByText(/EVENT LOOP VIOLATION/)).toBeInTheDocument()
    expect(screen.getByLabelText('Жизни: 2 из 3')).toBeInTheDocument()

    await playLevel(levels[4], container)
    clickButton('К списку уровней')
    clickButton('ИТОГИ')

    const list = document.querySelector('.results__list') as HTMLElement
    const violations = Array.from(list.querySelectorAll('div')).find((row) =>
      row.textContent?.includes('Event Loop violations'),
    )
    expect(violations).toHaveTextContent('1')
  })

  it('подсказки и ошибки видны в итоговой статистике', async () => {
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)
    fireEvent.click(screen.getByRole('button', { name: /STEP/ }))
    fireEvent.click(screen.getByRole('button', { name: /STEP/ }))
    clickButton('main()')
    clickButton('Открыть подсказку 1')

    await playLevel(tutorial, container)
    clickButton('К списку уровней')
    clickButton('ИТОГИ')

    const list = document.querySelector('.results__list') as HTMLElement
    expect(list).toHaveTextContent('Ошибок в ответах')
    const record = storedRecord('tutorial')
    expect(record.wrongAnswers).toBe(1)
    expect(record.hintsUsed).toBe(1)
  })
})

describe('сквозной сценарий: итоги и рестарт', () => {
  it('итоги открываются из меню и возвращают обратно', async () => {
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)
    await playLevel(tutorial, container)
    clickButton('К списку уровней')

    clickButton('ИТОГИ')
    expect(screen.getByText('Пройдено уровней')).toBeInTheDocument()

    clickButton('В МЕНЮ')
    expect(screen.getByRole('button', { name: /ПРОДОЛЖИТЬ/ })).toBeInTheDocument()
  })

  it('«ПРОЙТИ ЗАНОВО» обнуляет прогресс и возвращает в меню', async () => {
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)
    await playLevel(tutorial, container)
    clickButton('К списку уровней')
    clickButton('ИТОГИ')

    clickButton('ПРОЙТИ ЗАНОВО')

    expect(menuStat('SCORE')).toBe('0')
    expect(menuStat('ПРОЙДЕНО')).toBe(`0 / ${levels.length}`)
    expect(screen.getByRole('button', { name: /НАЧАТЬ/ })).toBeInTheDocument()
    expect(storedProgress()?.records).toEqual({})
  })

  it('сброс прогресса из меню подтверждается вопросом', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = renderApp()

    clickButton(/НАЧАТЬ/)
    await playLevel(tutorial, container)
    clickButton('К списку уровней')

    clickButton('СБРОСИТЬ ПРОГРЕСС')

    expect(confirm).toHaveBeenCalledOnce()
    expect(menuStat('SCORE')).toBe('0')
  })
})
