import { describe, expect, it } from 'vitest'
import { MAX_LIVES } from '../engine/scoring'
import { legalNextId } from '../engine/validator'
import {
  ENDLESS_POINTS,
  MAX_MULTIPLIER,
  STREAK_PER_MULTIPLIER,
  multiplierFor,
  nextWave,
  pick,
  startRun,
  type EndlessRun,
} from './run'

/** Сделать следующий по правилам ход. */
const legalPick = (run: EndlessRun): EndlessRun =>
  pick(run, legalNextId({ microtasks: run.microtasks, tasks: run.tasks }) as string)

/** Разобрать текущую волну целиком. */
function clearWave(run: EndlessRun): EndlessRun {
  let current = run
  for (let guard = 0; guard < 50 && current.status === 'playing'; guard += 1) {
    current = legalPick(current)
  }
  return current
}

/** Найти ход, который правила запрещают. */
function illegalId(run: EndlessRun): string {
  const legal = legalNextId({ microtasks: run.microtasks, tasks: run.tasks })
  const candidate = [...run.microtasks, ...run.tasks].find((item) => item.id !== legal)
  if (!candidate) throw new Error('В этой волне нет запрещённого хода')
  return candidate.id
}

describe('забег в бесконечном режиме', () => {
  it('начинается с первой волны, полных жизней и нулевого счёта', () => {
    const run = startRun(7)

    expect(run.wave).toBe(1)
    expect(run.lives).toBe(MAX_LIVES)
    expect(run.score).toBe(0)
    expect(run.streak).toBe(0)
    expect(run.status).toBe('playing')
    expect(run.output).toEqual([])
    expect(run.microtasks.length + run.tasks.length).toBeGreaterThan(0)
  })

  it('один и тот же сид даёт один и тот же забег', () => {
    expect(startRun(99)).toEqual(startRun(99))
  })

  describe('верный ход', () => {
    it('снимает операцию с очереди и печатает её строку', () => {
      const run = startRun(7)
      const first = run.microtasks[0]
      const after = pick(run, first.id)

      expect(after.microtasks.map((item) => item.id)).not.toContain(first.id)
      expect(after.output).toEqual([first.output])
      expect(after.event?.ok).toBe(true)
      expect(after.lives).toBe(MAX_LIVES)
    })

    it('приносит очки с учётом множителя серии', () => {
      const run = startRun(7)
      const after = pick(run, run.microtasks[0].id)

      expect(after.score).toBe(ENDLESS_POINTS.pick)
      expect(after.streak).toBe(1)
    })

    it('операция, ставящая новую, добавляет её в конец очереди', () => {
      // Восьмая волна: спауны уже разрешены во всех направлениях.
      let run = startRun(3)
      for (let wave = 1; wave < 8; wave += 1) run = nextWave(clearWave(run))

      const host = [...run.microtasks, ...run.tasks].find((item) => item.spawns?.length)
      expect(host).toBeDefined()

      const before = run.microtasks.length + run.tasks.length
      let current = run
      for (let guard = 0; guard < 20; guard += 1) {
        const next = legalNextId({ microtasks: current.microtasks, tasks: current.tasks })
        if (next === host?.id) break
        current = legalPick(current)
      }
      const after = legalPick(current)
      const spawned = host?.spawns?.[0]

      expect(after.microtasks.concat(after.tasks).map((item) => item.id)).toContain(spawned?.item.id)
      expect(after.event?.text).toMatch(/поставила новую операцию/)
      expect(before).toBeGreaterThan(0)
    })
  })

  describe('множитель серии', () => {
    it('растёт каждые пять верных ходов и упирается в потолок', () => {
      expect(multiplierFor(0)).toBe(1)
      expect(multiplierFor(STREAK_PER_MULTIPLIER - 1)).toBe(1)
      expect(multiplierFor(STREAK_PER_MULTIPLIER)).toBe(2)
      expect(multiplierFor(STREAK_PER_MULTIPLIER * 2)).toBe(3)
      expect(multiplierFor(1000)).toBe(MAX_MULTIPLIER)
    })

    it('длинная серия приносит больше очков за тот же ход', () => {
      let run = startRun(11)
      for (let wave = 1; wave < 4; wave += 1) run = nextWave(clearWave(run))

      expect(run.streak).toBeGreaterThanOrEqual(STREAK_PER_MULTIPLIER)
      const before = run.score
      const after = legalPick(run)
      expect(after.score - before).toBeGreaterThan(ENDLESS_POINTS.pick)
    })
  })

  describe('нарушение правил', () => {
    it('стоит жизни, обнуляет серию и объясняет ошибку', () => {
      const run = startRun(7)
      const after = pick(run, illegalId(run))

      expect(after.lives).toBe(MAX_LIVES - 1)
      expect(after.streak).toBe(0)
      expect(after.event?.ok).toBe(false)
      expect(after.event?.text).toMatch(/EVENT LOOP VIOLATION/)
    })

    it('не двигает очереди и не печатает строку — ход можно переделать', () => {
      const run = startRun(7)
      const after = pick(run, illegalId(run))

      expect(after.microtasks).toEqual(run.microtasks)
      expect(after.tasks).toEqual(run.tasks)
      expect(after.output).toEqual(run.output)
      expect(after.score).toBe(run.score)
    })

    it('сбитая серия обнуляет множитель', () => {
      let run = startRun(11)
      for (let wave = 1; wave < 4; wave += 1) run = nextWave(clearWave(run))

      const broken = pick(run, illegalId(run))
      const after = legalPick(broken)

      expect(after.score - broken.score).toBe(ENDLESS_POINTS.pick)
    })

    it('три нарушения заканчивают забег', () => {
      let run = startRun(7)
      for (let attempt = 0; attempt < MAX_LIVES; attempt += 1) run = pick(run, illegalId(run))

      expect(run.lives).toBe(0)
      expect(run.status).toBe('over')
    })

    it('законченный забег больше не принимает ходов', () => {
      let run = startRun(7)
      for (let attempt = 0; attempt < MAX_LIVES; attempt += 1) run = pick(run, illegalId(run))

      expect(pick(run, run.microtasks[0].id)).toBe(run)
    })
  })

  describe('смена волн', () => {
    it('разобранная волна даёт бонус и подводит итог', () => {
      const run = clearWave(startRun(7))

      expect(run.status).toBe('wave-cleared')
      expect(run.event?.text).toMatch(/Волна 1 разобрана/)
      expect(run.microtasks).toEqual([])
      expect(run.tasks).toEqual([])
    })

    it('бонус за волну растёт с её номером', () => {
      const first = clearWave(startRun(7))
      const pickScore = first.score - ENDLESS_POINTS.waveClear * 1
      expect(pickScore).toBeGreaterThan(0)

      const second = clearWave(nextWave(first))
      expect(second.score - first.score).toBeGreaterThan(ENDLESS_POINTS.waveClear)
    })

    it('следующая волна сохраняет счёт, серию и жизни, но чистит Output', () => {
      const cleared = clearWave(startRun(7))
      const next = nextWave(cleared)

      expect(next.wave).toBe(2)
      expect(next.status).toBe('playing')
      expect(next.score).toBe(cleared.score)
      expect(next.streak).toBe(cleared.streak)
      expect(next.lives).toBe(cleared.lives)
      expect(next.output).toEqual([])
      expect(next.event).toBeNull()
    })

    it('перейти на следующую волну можно только с разобранной', () => {
      const run = startRun(7)
      expect(nextWave(run)).toBe(run)
    })

    it('новые операции объявляются на своей волне', () => {
      let run = startRun(7)
      const intros: string[][] = [run.unlocked]
      for (let wave = 1; wave < 8; wave += 1) {
        run = nextWave(clearWave(run))
        intros.push(run.unlocked)
      }

      expect(intros[0]).toEqual([])
      expect(intros.flat().join(' ')).toMatch(/queueMicrotask/)
      expect(intros.flat().join(' ')).toMatch(/await/)
    })
  })

  it('идеальный забег на двадцать волн не заканчивается и копит счёт', () => {
    let run = startRun(5)
    for (let wave = 1; wave <= 20; wave += 1) {
      run = clearWave(run)
      expect(run.status).toBe('wave-cleared')
      run = nextWave(run)
    }

    expect(run.wave).toBe(21)
    expect(run.lives).toBe(MAX_LIVES)
    expect(run.score).toBeGreaterThan(1000)
  })
})
