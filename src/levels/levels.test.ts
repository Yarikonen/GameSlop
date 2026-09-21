import { describe, expect, it } from 'vitest'
import { legalNextId } from '../engine/validator'
import type { EventLoopItem, Level, SandboxId } from '../engine/types'
import { levels, levelById, nextLevelId } from './index'

const SANDBOXES: SandboxId[] = ['fetch-race', 'freeze-lab', 'starvation-lab', 'incident']

function lineCount(code: string): number {
  return code.replace(/\n+$/, '').split('\n').length
}

/** Прогон задания «ты — Event Loop» строго по правилам движка. */
function playByTheRules(microtasks: EventLoopItem[], tasks: EventLoopItem[]): string[] {
  const micro = [...microtasks]
  const macro = [...tasks]
  const output: string[] = []

  for (let guard = 0; guard < 100; guard += 1) {
    const nextId = legalNextId({ microtasks: micro, tasks: macro })
    if (nextId === null) break
    const fromMicro = micro[0]?.id === nextId
    const item = fromMicro ? (micro.shift() as EventLoopItem) : (macro.shift() as EventLoopItem)
    if (item.output) output.push(item.output)
    for (const spawn of item.spawns ?? []) {
      if (spawn.queue === 'microtask') micro.push(spawn.item)
      else macro.push(spawn.item)
    }
  }
  return output
}

describe('каталог уровней', () => {
  it('в игре 10 уровней: обучение, восемь тем и финальный босс', () => {
    expect(levels).toHaveLength(10)
    expect(levels[0].id).toBe('tutorial')
    expect(levels.at(-1)?.id).toBe('boss')
  })

  it('идентификаторы уровней уникальны', () => {
    const ids = levels.map((level) => level.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('боссом помечен ровно один уровень', () => {
    expect(levels.filter((level) => level.boss)).toHaveLength(1)
    expect(levels.find((level) => level.boss)?.id).toBe('boss')
  })

  it('уровень находится по идентификатору', () => {
    expect(levelById('level4')?.title).toBe('You Are The Event Loop')
    expect(levelById('нет-такого')).toBeUndefined()
  })

  it('следующий уровень выдаётся по порядку, после последнего — ничего', () => {
    expect(nextLevelId('tutorial')).toBe('level1')
    expect(nextLevelId('level8')).toBe('boss')
    expect(nextLevelId('boss')).toBeNull()
    expect(nextLevelId('нет-такого')).toBeNull()
  })

  it('путь «следующий уровень» проходит через все уровни', () => {
    const visited: string[] = []
    let id: string | null = levels[0].id
    while (id) {
      visited.push(id)
      id = nextLevelId(id)
    }
    expect(visited).toEqual(levels.map((level) => level.id))
  })

  it('каждая лаборатория используется в игре ровно один раз', () => {
    const used = levels.flatMap((level) =>
      level.challenges.flatMap((challenge) =>
        challenge.kind === 'sandbox' ? [challenge.sandbox] : [],
      ),
    )
    expect([...used].sort()).toEqual([...SANDBOXES].sort())
  })

  it('идентификаторы заданий уникальны во всей игре', () => {
    const ids = levels.flatMap((level) => level.challenges.map((challenge) => challenge.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('норматив времени: обучение — самое быстрое, босс — самый долгий', () => {
    const times = levels.map((level) => level.parTimeSec)
    expect(Math.min(...times)).toBe(levels[0].parTimeSec)
    expect(Math.max(...times)).toBe(levels.at(-1)?.parTimeSec)
    expect(times.every((time) => time > 0)).toBe(true)
  })

  it('на всю игру заложено 30–40 минут, как обещает описание', () => {
    const totalMinutes = levels.reduce((sum, level) => sum + level.parTimeSec, 0) / 60
    expect(totalMinutes).toBeGreaterThanOrEqual(30)
    expect(totalMinutes).toBeLessThanOrEqual(40)
  })
})

describe.each(levels.map((level) => [level.id, level] as const))('уровень %s', (_id, level: Level) => {
  it('описан для игрока полностью', () => {
    expect(level.badge).not.toBe('')
    expect(level.title).not.toBe('')
    expect(level.topic).not.toBe('')
    expect(level.goal).not.toBe('')
    expect(level.keyIdea).not.toBe('')
    expect(level.debrief.length).toBeGreaterThan(0)
    expect(level.debrief.every((paragraph) => paragraph.trim().length > 0)).toBe(true)
    expect(level.parTimeSec).toBeGreaterThan(0)
  })

  it('даёт ровно три подсказки', () => {
    expect(level.hints).toHaveLength(3)
    expect(level.hints.every((hint) => hint.trim().length > 0)).toBe(true)
  })

  it('сценарий симуляции не пустой и каждый шаг объяснён', () => {
    expect(level.steps.length).toBeGreaterThan(0)
    expect(level.steps.every((step) => step.description.trim().length > 0)).toBe(true)
  })

  it('подсвеченные строки существуют в коде уровня', () => {
    const total = level.code ? lineCount(level.code) : 0
    for (const step of level.steps) {
      for (const line of step.codeLines ?? []) {
        expect(line).toBeGreaterThanOrEqual(1)
        expect(line).toBeLessThanOrEqual(total)
      }
    }
  })

  it('финальный шаг печатает ровно ожидаемый Output', () => {
    expect(level.steps.at(-1)?.output).toEqual(level.expectedOutput ?? [])
  })

  it('Output только растёт по ходу симуляции', () => {
    let previous: string[] = []
    for (const step of level.steps) {
      expect(step.output.slice(0, previous.length)).toEqual(previous)
      previous = step.output
    }
  })

  it('есть хотя бы одно задание', () => {
    expect(level.challenges.length).toBeGreaterThan(0)
    expect(level.challenges.every((challenge) => challenge.prompt.trim().length > 0)).toBe(true)
  })

  it('задания-ворота привязаны к существующему шагу', () => {
    for (const challenge of level.challenges) {
      if (challenge.gateStep === undefined) continue
      expect(challenge.gateStep).toBeGreaterThanOrEqual(0)
      expect(challenge.gateStep).toBeLessThan(level.steps.length - 1)
    }
  })

  it('задания решаемы и согласованы с уровнем', () => {
    for (const challenge of level.challenges) {
      if (challenge.kind === 'predict-output') {
        expect(challenge.answer.length).toBeGreaterThan(0)
        expect([...challenge.cards].sort()).toEqual([...challenge.answer].sort())
        // Прогноз — это и есть настоящий Output уровня.
        expect(challenge.answer).toEqual(level.expectedOutput)
      }

      if (challenge.kind === 'classify') {
        const bucketIds = challenge.buckets.map((bucket) => bucket.id)
        expect(new Set(bucketIds).size).toBe(bucketIds.length)
        for (const item of challenge.items) {
          expect(bucketIds).toContain(challenge.answer[item.id])
        }
        expect(Object.keys(challenge.answer).sort()).toEqual(
          challenge.items.map((item) => item.id).sort(),
        )
      }

      if (challenge.kind === 'choice') {
        const optionIds = challenge.options.map((option) => option.id)
        expect(optionIds.length).toBeGreaterThanOrEqual(2)
        expect(new Set(optionIds).size).toBe(optionIds.length)
        expect(optionIds).toContain(challenge.answer)
        expect(challenge.explanation.trim().length).toBeGreaterThan(0)
        // У каждого неверного варианта есть разбор «почему нет».
        for (const option of challenge.options) {
          if (option.id === challenge.answer) continue
          expect(option.why?.trim().length ?? 0).toBeGreaterThan(0)
        }
      }

      if (challenge.kind === 'event-loop') {
        const collect = (items: EventLoopItem[]): string[] =>
          items.flatMap((item) => [item.id, ...collect((item.spawns ?? []).map((s) => s.item))])
        const ids = [...collect(challenge.microtasks), ...collect(challenge.tasks)]
        expect(new Set(ids).size).toBe(ids.length)
        expect(challenge.microtasks.length + challenge.tasks.length).toBeGreaterThan(0)

        // Проход строго по правилам Event Loop даёт Output уровня.
        expect(playByTheRules(challenge.microtasks, challenge.tasks)).toEqual(level.expectedOutput)
      }

      if (challenge.kind === 'sandbox') {
        expect(SANDBOXES).toContain(challenge.sandbox)
      }
    }
  })
})
