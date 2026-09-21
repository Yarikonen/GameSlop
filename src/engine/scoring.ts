/** Очки за действия игрока (раздел «Система очков»). */
export const POINTS = {
  prediction: 100,
  action: 50,
  explanation: 100,
  /** Корректный шаг в роли Event Loop (Level 4). */
  loopStep: 100,
  noHintBonus: 50,
  levelClear: 100,
  bossClear: 400,
  wrongChoice: -20,
  hintUsed: -30,
  loopViolation: -30,
} as const

export const MAX_LIVES = 3

export interface Rank {
  min: number
  title: string
  caption: string
}

export const RANKS: Rank[] = [
  { min: 0, title: 'Event Loop Intern', caption: 'Стек уже не страшен — впереди очереди.' },
  { min: 1500, title: 'Async Developer', caption: 'Таймеры и промисы больше не удивляют.' },
  { min: 2500, title: 'Promise Master', caption: 'Микрозадачи под контролем.' },
  { min: 3500, title: 'Event Loop Engineer', caption: 'Видишь модель выполнения в реальном коде.' },
  { min: 4500, title: 'Event Loop Wizard', caption: 'Диагностируешь production по одному графику CPU.' },
]

export function rankFor(score: number): Rank {
  let current = RANKS[0]
  for (const rank of RANKS) if (score >= rank.min) current = rank
  return current
}

/** Бонус за скорость: полный за укладывание в норматив, половина — за полтора норматива. */
export function speedBonus(elapsedSec: number, parTimeSec: number): number {
  if (elapsedSec <= parTimeSec) return 100
  if (elapsedSec <= parTimeSec * 1.5) return 50
  return 0
}
