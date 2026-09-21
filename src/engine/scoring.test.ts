import { describe, expect, it } from 'vitest'
import { MAX_LIVES, POINTS, RANKS, rankFor, speedBonus } from './scoring'

describe('очки и ранги', () => {
  it('держит объявленную стоимость действий игрока', () => {
    expect(POINTS).toEqual({
      prediction: 100,
      action: 50,
      explanation: 100,
      loopStep: 100,
      noHintBonus: 50,
      levelClear: 100,
      bossClear: 400,
      wrongChoice: -20,
      hintUsed: -30,
      loopViolation: -30,
    })
    expect(MAX_LIVES).toBe(3)
  })

  it('ошибки, подсказки и нарушения стоят игроку очков', () => {
    expect(POINTS.wrongChoice).toBeLessThan(0)
    expect(POINTS.hintUsed).toBeLessThan(0)
    expect(POINTS.loopViolation).toBeLessThan(0)
  })

  describe('rankFor', () => {
    it('новичок без очков — Event Loop Intern', () => {
      expect(rankFor(0).title).toBe('Event Loop Intern')
    })

    it('ранг повышается ровно на пороге', () => {
      expect(rankFor(1499).title).toBe('Event Loop Intern')
      expect(rankFor(1500).title).toBe('Async Developer')
      expect(rankFor(2499).title).toBe('Async Developer')
      expect(rankFor(2500).title).toBe('Promise Master')
      expect(rankFor(3500).title).toBe('Event Loop Engineer')
      expect(rankFor(4500).title).toBe('Event Loop Wizard')
    })

    it('выше максимального порога ранг не растёт', () => {
      expect(rankFor(999_999).title).toBe('Event Loop Wizard')
    })

    it('отрицательный счёт не ломает выдачу ранга', () => {
      expect(rankFor(-100)).toBe(RANKS[0])
    })

    it('пороги рангов возрастают', () => {
      const mins = RANKS.map((rank) => rank.min)
      expect(mins).toEqual([...mins].sort((a, b) => a - b))
      expect(new Set(mins).size).toBe(mins.length)
    })
  })

  describe('speedBonus', () => {
    it('полный бонус за прохождение в норматив', () => {
      expect(speedBonus(60, 90)).toBe(100)
      expect(speedBonus(90, 90)).toBe(100)
    })

    it('половина бонуса за полтора норматива', () => {
      expect(speedBonus(91, 90)).toBe(50)
      expect(speedBonus(135, 90)).toBe(50)
    })

    it('без бонуса, если игрок сильно затянул', () => {
      expect(speedBonus(136, 90)).toBe(0)
      expect(speedBonus(10_000, 90)).toBe(0)
    })
  })
})
