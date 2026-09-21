import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { POINTS } from '../engine/scoring'
import { HintBox } from './HintBox'

const hints: [string, string, string] = [
  'Одна из очередей всегда имеет приоритет.',
  'Task берётся только при пустой Microtask Queue.',
  'Задача может породить новую микрозадачу.',
]

function setup(learningMode = false) {
  const onUse = vi.fn()
  const user = userEvent.setup()
  const view = render(<HintBox hints={hints} learningMode={learningMode} onUse={onUse} />)
  return { onUse, user, ...view }
}

describe('подсказки уровня', () => {
  it('сначала все подсказки закрыты, цена названа', () => {
    setup()

    expect(screen.getByText(`${POINTS.hintUsed} очков за подсказку`)).toBeInTheDocument()
    expect(screen.getByText('Подсказка 1 скрыта')).toBeInTheDocument()
    expect(screen.queryByText(hints[0])).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть подсказку 1' })).toBeInTheDocument()
  })

  it('подсказки открываются по одной и списывают очки', async () => {
    const { onUse, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Открыть подсказку 1' }))

    expect(onUse).toHaveBeenCalledOnce()
    expect(screen.getByText(hints[0])).toBeInTheDocument()
    expect(screen.queryByText(hints[1])).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть подсказку 2' })).toBeInTheDocument()
  })

  it('после третьей подсказки открывать больше нечего', async () => {
    const { onUse, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Открыть подсказку 1' }))
    await user.click(screen.getByRole('button', { name: 'Открыть подсказку 2' }))
    await user.click(screen.getByRole('button', { name: 'Открыть подсказку 3' }))

    expect(onUse).toHaveBeenCalledTimes(3)
    for (const hint of hints) expect(screen.getByText(hint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Открыть подсказку/ })).not.toBeInTheDocument()
  })

  it('в Learning Mode все подсказки открыты и бесплатны', () => {
    const { onUse } = setup(true)

    expect(screen.getByText('в Learning Mode — бесплатно')).toBeInTheDocument()
    for (const hint of hints) expect(screen.getByText(hint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Открыть подсказку/ })).not.toBeInTheDocument()
    expect(onUse).not.toHaveBeenCalled()
  })
})
