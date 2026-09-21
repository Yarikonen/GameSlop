import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { POINTS } from '../engine/scoring'
import type { ChoiceChallenge, PredictOutputChallenge } from '../engine/types'
import { levelById } from '../levels'
import { GameProvider } from '../state/gameStore'
import {
  clickButton,
  currentStep,
  playLevel,
  solveChoice,
  solvePredictOutput,
  storedProgress,
  storedRecord,
  storedScore,
} from '../test/helpers'
import { Game } from './Game'

const tutorial = levelById('tutorial')!
const level1 = levelById('level1')!

// Обучение состоит из двух вопросов по ходу симуляции, первый уровень —
// из прогноза Output и вопроса про стек.
const [tutorialFrameQuestion] = tutorial.challenges as ChoiceChallenge[]
const level1Predict = level1.challenges[0] as PredictOutputChallenge
const level1Question = level1.challenges[1] as ChoiceChallenge

function setup(levelId = 'tutorial') {
  const onExit = vi.fn()
  const onOpenLevel = vi.fn()
  const onFinish = vi.fn()
  const view = render(
    <GameProvider>
      <Game levelId={levelId} onExit={onExit} onOpenLevel={onOpenLevel} onFinish={onFinish} />
    </GameProvider>,
  )
  return { onExit, onOpenLevel, onFinish, ...view }
}

const stepBtn = () => screen.getByRole('button', { name: /STEP/ }) as HTMLButtonElement
const runBtn = () => screen.getByRole('button', { name: /RUN|PAUSE/ }) as HTMLButtonElement
const resetBtn = () => screen.getByRole('button', { name: /RESET/ }) as HTMLButtonElement
const prevBtn = () => screen.getByRole('button', { name: /PREV/ }) as HTMLButtonElement
const scoreValue = (container: HTMLElement) =>
  Number(container.querySelector('.score__number')?.textContent)

describe('экран уровня', () => {
  it('несуществующий уровень не ломает игру, а возвращает в меню', async () => {
    const { onExit } = setup('нет-такого-уровня')

    expect(screen.getByText('Уровень не найден.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'В меню' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('показывает код, цель, ключевую идею и все панели машины', () => {
    const { container } = setup()

    expect(screen.getByText(tutorial.badge)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: tutorial.title })).toBeInTheDocument()
    expect(screen.getByText(tutorial.goal)).toBeInTheDocument()
    expect(screen.getByText(`💡 ${tutorial.keyIdea}`)).toBeInTheDocument()
    expect(container.querySelector('.code-panel')).toHaveTextContent('function hello()')

    const machine = container.querySelector('.machine') as HTMLElement
    expect(within(machine).getByText('Call Stack')).toBeInTheDocument()
    expect(screen.getByText('Web APIs / Runtime')).toBeInTheDocument()
    expect(screen.getByText('Microtask Queue')).toBeInTheDocument()
    expect(screen.getByText('Task Queue')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
  })

  it('до первого шага симуляция стоит на нуле, назад идти некуда', () => {
    setup()

    expect(currentStep()).toEqual({ index: 0, total: tutorial.steps.length })
    expect(screen.getByText(/Нажми STEP/)).toBeInTheDocument()
    expect(prevBtn()).toBeDisabled()
    expect(resetBtn()).toBeDisabled()
    expect(screen.getByText('EVENT LOOP FREE')).toBeInTheDocument()
  })

  it('вход в уровень возвращает полные жизни и запоминает уровень', () => {
    setup()

    expect(screen.getByLabelText('Жизни: 3 из 3')).toBeInTheDocument()
    expect(storedProgress()?.currentLevelId).toBe('tutorial')
  })

  describe('шаги симуляции', () => {
    it('STEP выполняет операции по одной и показывает разбор шага', () => {
      const { container } = setup()

      fireEvent.click(stepBtn())

      expect(currentStep().index).toBe(1)
      expect(screen.getByText(tutorial.steps[0].description)).toBeInTheDocument()
      expect(container.querySelector('.stack-list')).toHaveTextContent('main()')
    })

    it('PREV и RESET отматывают симуляцию назад', () => {
      setup()

      fireEvent.click(stepBtn())
      fireEvent.click(prevBtn())
      expect(currentStep().index).toBe(0)

      fireEvent.click(stepBtn())
      fireEvent.click(resetBtn())
      expect(currentStep().index).toBe(0)
      expect(resetBtn()).toBeDisabled()
    })

    it('клик по таймлайну перематывает на выбранный шаг', () => {
      setup()

      fireEvent.click(screen.getByRole('button', { name: 'Шаг 2' }))

      expect(currentStep().index).toBe(2)
    })

    it('Output печатается по ходу симуляции', () => {
      const { container } = setup()

      fireEvent.click(stepBtn())
      fireEvent.click(stepBtn())
      solveChoice(tutorialFrameQuestion)
      while (!stepBtn().disabled) fireEvent.click(stepBtn())

      expect(container.querySelector('.output-list')).toHaveTextContent('Hello')
      expect(currentStep().index).toBe(5)
    })
  })

  describe('вопрос во время симуляции', () => {
    it('симуляция упирается в вопрос и объясняет, почему стоит', () => {
      setup()

      fireEvent.click(stepBtn())
      fireEvent.click(stepBtn())

      expect(currentStep().index).toBe(2)
      expect(stepBtn()).toBeDisabled()
      expect(runBtn()).toBeDisabled()
      expect(screen.getByText(/Event Loop ждёт твоего ответа/)).toBeInTheDocument()
      expect(screen.getByText(tutorialFrameQuestion.prompt)).toBeInTheDocument()
    })

    it('правильный ответ отпускает симуляцию дальше', () => {
      setup()

      fireEvent.click(stepBtn())
      fireEvent.click(stepBtn())
      solveChoice(tutorialFrameQuestion)

      expect(screen.queryByText(/Event Loop ждёт твоего ответа/)).not.toBeInTheDocument()
      expect(stepBtn()).toBeEnabled()

      fireEvent.click(stepBtn())
      expect(currentStep().index).toBe(3)
    })

    it('ошибка в ответе стоит очков', () => {
      const { container } = setup()

      fireEvent.click(stepBtn())
      fireEvent.click(stepBtn())
      clickButton('main()')

      expect(scoreValue(container)).toBe(0)
      expect(storedRecord('tutorial').wrongAnswers).toBe(1)
      expect(storedRecord('tutorial').score).toBe(POINTS.wrongChoice)
      expect(stepBtn()).toBeDisabled()
    })
  })

  describe('уровень с заданиями до запуска', () => {
    it('симуляция закрыта, пока не сделан прогноз', () => {
      setup('level1')

      expect(stepBtn()).toBeDisabled()
      expect(runBtn()).toBeDisabled()
      expect(screen.getByText(/Сначала выполни задание справа/)).toBeInTheDocument()
    })

    it('задания идут по одному, счётчик показывает прогресс', async () => {
      const { container } = setup('level1')

      expect(screen.getByText(`задание 1 / ${level1.challenges.length}`)).toBeInTheDocument()
      expect(screen.getByText('PREDICTION')).toBeInTheDocument()

      solvePredictOutput(level1Predict, container)
      clickButton(/СЛЕДУЮЩЕЕ ЗАДАНИЕ/)

      expect(screen.getByText(`задание 2 / ${level1.challenges.length}`)).toBeInTheDocument()
      expect(screen.getByText('QUESTION')).toBeInTheDocument()
    })

    it('после всех заданий симуляция открывается', async () => {
      const { container } = setup('level1')

      await playLevel(level1, container)

      expect(screen.queryByText(/Сначала выполни задание справа/)).not.toBeInTheDocument()
    })
  })

  describe('подсказки', () => {
    it('подсказка списывает очки и попадает в статистику', () => {
      const { container } = setup()

      fireEvent.click(stepBtn())
      fireEvent.click(stepBtn())
      solveChoice(tutorialFrameQuestion)
      const before = scoreValue(container)

      clickButton('Открыть подсказку 1')

      expect(scoreValue(container)).toBe(before + POINTS.hintUsed)
      expect(storedRecord('tutorial').hintsUsed).toBe(1)
      expect(screen.getByText(tutorial.hints[0])).toBeInTheDocument()
    })
  })

  describe('Learning Mode', () => {
    /** Потратить все жизни: на одном вопросе больше двух не теряется. */
    function loseAllLives() {
      fireEvent.click(stepBtn())
      fireEvent.click(stepBtn())
      clickButton('main()')
      clickButton('console.log("Hello")')
      clickButton('Ничего, стек начнёт разбираться')
      solveChoice(tutorialFrameQuestion)

      while (!stepBtn().disabled) fireEvent.click(stepBtn())
      clickButton('main() снимется со стека')
      clickButton('start() вызовется ещё раз')
    }

    it('после потери всех жизней уровень не блокируется, а переходит в режим разбора', () => {
      setup()

      loseAllLives()

      expect(screen.getByLabelText('Жизни: 0 из 3')).toBeInTheDocument()
      expect(screen.getByText('LEARNING MODE')).toBeInTheDocument()
      expect(screen.getByText(/жизни закончились, но уровень не заблокирован/)).toBeInTheDocument()
      expect(storedRecord('tutorial').learningMode).toBe(true)
    })

    it('в Learning Mode подсказки бесплатны', () => {
      const { container } = setup()

      loseAllLives()
      const before = scoreValue(container)

      expect(screen.getByText('в Learning Mode — бесплатно')).toBeInTheDocument()
      for (const hint of tutorial.hints) expect(screen.getByText(hint)).toBeInTheDocument()
      expect(scoreValue(container)).toBe(before)
    })
  })

  describe('завершение уровня', () => {
    it('после всех заданий игра просит доиграть симуляцию', async () => {
      const { container } = setup('level1')

      solvePredictOutput(level1Predict, container)
      clickButton(/СЛЕДУЮЩЕЕ ЗАДАНИЕ/)
      solveChoice(level1Question)

      expect(screen.getByText('Задания пройдены')).toBeInTheDocument()
      expect(screen.getByText(/Запусти симуляцию \(RUN\)/)).toBeInTheDocument()
    })

    it('пройденный уровень показывает разбор и ведёт дальше', async () => {
      const { container, onOpenLevel } = setup()

      await playLevel(tutorial, container)

      expect(screen.getByText('Разбор уровня')).toBeInTheDocument()
      for (const paragraph of tutorial.debrief) {
        expect(screen.getByText(paragraph)).toBeInTheDocument()
      }

      clickButton(/СЛЕДУЮЩИЙ УРОВЕНЬ/)
      expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('level1')
    })

    it('за пройденный уровень начисляются очки и бонусы', async () => {
      const { container } = setup()

      await playLevel(tutorial, container)

      // 2 вопроса по 50 + бонус за скорость 100 + прохождение 100 + «без подсказок» 50.
      expect(storedScore()).toBe(POINTS.action * 2 + 100 + POINTS.levelClear + POINTS.noHintBonus)
      expect(storedRecord('tutorial').completed).toBe(true)
    })

    it('уровень закрывается один раз, даже если отмотать симуляцию назад', async () => {
      const { container } = setup()

      await playLevel(tutorial, container)
      const score = storedScore()

      fireEvent.click(prevBtn())
      fireEvent.click(stepBtn())

      expect(storedScore()).toBe(score)
    })

    it('кнопка «МЕНЮ» возвращает в список уровней', () => {
      const { onExit } = setup()

      clickButton(/МЕНЮ/)

      expect(onExit).toHaveBeenCalledOnce()
    })
  })

  it('счёт и жизни видны в шапке уровня', () => {
    const { container } = setup()

    const score = container.querySelector('.score') as HTMLElement
    expect(within(score).getByText('SCORE')).toBeInTheDocument()
    expect(within(score).getByLabelText('Жизни: 3 из 3')).toBeInTheDocument()
  })
})
