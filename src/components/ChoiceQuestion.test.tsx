import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ChoiceChallenge } from '../engine/types'
import { makeHandlers, type MockHandlers } from '../test/helpers'
import { ChoiceQuestion } from './ChoiceQuestion'

const challenge: ChoiceChallenge = {
  id: 'why',
  kind: 'choice',
  prompt: 'Почему B печатается последним?',
  options: [
    { id: 'queue', label: 'Колбэк ушёл в очередь', detail: 'и ждёт пустого стека' },
    { id: 'clamp', label: 'setTimeout(0) — это не 0 мс', why: 'Дело не в миллисекундах, а в очереди.' },
    { id: 'slow', label: 'console.log медленный', why: 'Скорость печати ни при чём.' },
  ],
  answer: 'queue',
  explanation: 'Колбэк попадает в Task Queue и ждёт, пока Call Stack опустеет.',
}

let handlers: MockHandlers

function setup(options: { solved?: boolean; learningMode?: boolean; challenge?: ChoiceChallenge } = {}) {
  handlers = makeHandlers(options.learningMode ?? false)
  const user = userEvent.setup()
  const view = render(
    <ChoiceQuestion
      challenge={options.challenge ?? challenge}
      handlers={handlers}
      solved={options.solved ?? false}
    />,
  )
  return { user, ...view }
}

describe('вопрос с вариантами ответа', () => {
  it('показывает все варианты и прячет разбор до ответа', () => {
    setup()

    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByText(challenge.explanation)).not.toBeInTheDocument()
    expect(screen.queryByText('и ждёт пустого стека')).not.toBeInTheDocument()
  })

  it('верный ответ с первой попытки засчитывается как действие', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: /Колбэк ушёл в очередь/ }))

    expect(handlers.onCorrect).toHaveBeenCalledExactlyOnceWith('action')
    expect(handlers.onSolved).toHaveBeenCalledOnce()
  })

  it('вопрос «на объяснение» стоит дороже', async () => {
    const { user } = setup({ challenge: { ...challenge, weight: 'explanation' } })

    await user.click(screen.getByRole('button', { name: /Колбэк ушёл в очередь/ }))

    expect(handlers.onCorrect).toHaveBeenCalledExactlyOnceWith('explanation')
  })

  it('неверный ответ объясняет, почему он неверный, и закрывает вариант', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: /это не 0 мс/ }))

    expect(handlers.onWrong).toHaveBeenCalledExactlyOnceWith(false)
    expect(screen.getByText(/Дело не в миллисекундах/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /это не 0 мс/ })).toBeDisabled()
    expect(handlers.onSolved).not.toHaveBeenCalled()
  })

  it('вторая ошибка стоит жизни', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: /это не 0 мс/ }))
    await user.click(screen.getByRole('button', { name: /console.log медленный/ }))

    expect(handlers.onWrong).toHaveBeenNthCalledWith(1, false)
    expect(handlers.onWrong).toHaveBeenNthCalledWith(2, true)
  })

  it('верный ответ после ошибки засчитывается по обычной ставке', async () => {
    const { user } = setup({ challenge: { ...challenge, weight: 'explanation' } })

    await user.click(screen.getByRole('button', { name: /это не 0 мс/ }))
    await user.click(screen.getByRole('button', { name: /Колбэк ушёл в очередь/ }))

    expect(handlers.onCorrect).toHaveBeenCalledExactlyOnceWith('action')
  })

  it('после двух ошибок игра подсказывает правильный вариант', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: /это не 0 мс/ }))
    expect(screen.queryByText(/LEARNING MODE/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /console.log медленный/ }))
    expect(screen.getByText(/LEARNING MODE: правильный ответ/)).toHaveTextContent(
      'Колбэк ушёл в очередь',
    )
  })

  it('в Learning Mode правильный ответ и пояснения видны сразу', () => {
    setup({ learningMode: true })

    expect(screen.getByText(/LEARNING MODE: правильный ответ/)).toBeInTheDocument()
    expect(screen.getByText('и ждёт пустого стека')).toBeInTheDocument()
  })

  it('решённое задание показывает разбор и запрещает переголосовать', async () => {
    const { user } = setup({ solved: true })

    expect(screen.getByText(/Верно: Колбэк ушёл в очередь/)).toBeInTheDocument()
    expect(screen.getByText(challenge.explanation)).toBeInTheDocument()
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Колбэк ушёл в очередь/ }))
    expect(handlers.onCorrect).not.toHaveBeenCalled()
  })

  it('вопрос с кодом показывает варианты кода', () => {
    const { container } = setup({ challenge: { ...challenge, code: 'setTimeout(fn, 0)' } })
    const code = container.querySelector('.code-panel') as HTMLElement

    expect(screen.getByText('Варианты')).toBeInTheDocument()
    expect(code).toHaveTextContent('setTimeout(fn, 0)')
  })
})
