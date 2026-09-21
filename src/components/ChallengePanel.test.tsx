import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Challenge } from '../engine/types'
import { makeHandlers } from '../test/helpers'
import { ChallengePanel } from './ChallengePanel'

const challenges: Record<string, Challenge> = {
  predict: {
    id: 'p',
    kind: 'predict-output',
    prompt: 'Собери Output',
    cards: ['A'],
    answer: ['A'],
  },
  classify: {
    id: 'c',
    kind: 'classify',
    prompt: 'Разложи по очередям',
    items: [{ id: 'i', label: 'then(...)' }],
    buckets: [{ id: 'microtask', label: 'Microtask Queue' }],
    answer: { i: 'microtask' },
  },
  choice: {
    id: 'q',
    kind: 'choice',
    prompt: 'Что дальше?',
    options: [{ id: 'a', label: 'Вариант А' }],
    answer: 'a',
    explanation: 'потому что',
  },
  loop: {
    id: 'l',
    kind: 'event-loop',
    prompt: 'Выбирай операцию',
    microtasks: [{ id: 'm', label: 'then → C', output: 'C' }],
    tasks: [],
  },
  fetchRace: { id: 's1', kind: 'sandbox', prompt: 'Сравни варианты', sandbox: 'fetch-race' },
  freezeLab: { id: 's2', kind: 'sandbox', prompt: 'Заблокируй поток', sandbox: 'freeze-lab' },
  starvation: { id: 's3', kind: 'sandbox', prompt: 'Замори очередь', sandbox: 'starvation-lab' },
  incident: { id: 's4', kind: 'sandbox', prompt: 'Расследуй инцидент', sandbox: 'incident' },
}

function setup(challenge: Challenge, index = 0, total = 3) {
  return render(
    <ChallengePanel
      challenge={challenge}
      handlers={makeHandlers()}
      solved={false}
      index={index}
      total={total}
    />,
  )
}

describe('карточка задания', () => {
  it('показывает формулировку и место задания в уровне', () => {
    setup(challenges.choice, 1, 3)

    expect(screen.getByText('Что дальше?')).toBeInTheDocument()
    expect(screen.getByText('задание 2 / 3')).toBeInTheDocument()
  })

  it.each([
    ['predict', 'PREDICTION', 'перетащи сюда'],
    ['classify', 'CLASSIFY', 'Microtask Queue'],
    ['choice', 'QUESTION', 'Вариант А'],
    ['loop', 'YOU ARE THE EVENT LOOP', 'CALL STACK'],
  ])('задание вида %s подписано «%s» и рисует свой интерфейс', (key, label, marker) => {
    setup(challenges[key])

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(marker)).toBeInTheDocument()
  })

  it.each([
    ['fetchRace', /Вариант A \(await подряд\)/],
    ['freezeLab', /CALCULATE REPORT/],
    ['starvation', /ЗАПУСТИТЬ spawn/],
    ['incident', /PRODUCTION INCIDENT/],
  ])('лаборатория %s запускается из задания', (key, marker) => {
    setup(challenges[key])

    expect(screen.getByText('LAB')).toBeInTheDocument()
    expect(screen.getByText(marker)).toBeInTheDocument()
  })
})
