import type { CorrectKind } from '../state/gameStore'

export interface ChallengeHandlers {
  /** Правильный ответ: начисляем очки по типу задания. */
  onCorrect: (kind: CorrectKind) => void
  /** Ошибка. critical = true снимает жизнь. */
  onWrong: (critical?: boolean) => void
  /** Нарушение правил Event Loop. */
  onViolation: () => void
  /** Прогноз собран правильно, но не с первой попытки. */
  onPredictionMissed: () => void
  /** Задание закрыто — можно идти дальше. */
  onSolved: () => void
  learningMode: boolean
}
