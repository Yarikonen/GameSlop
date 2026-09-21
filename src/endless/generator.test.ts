import { describe, expect, it } from 'vitest'
import type { EventLoopItem } from '../engine/types'
import { legalNextId } from '../engine/validator'
import {
  MAX_MICROTASKS,
  MAX_SPAWNS,
  MAX_TASKS,
  generateWave,
  introsFor,
  microtaskCount,
  spawnCount,
  taskCount,
  type Wave,
} from './generator'

/** Пройти волну строго по правилам Event Loop. */
function playByTheRules(wave: Wave): { output: string[]; picks: number } {
  const micro = [...wave.microtasks]
  const tasks = [...wave.tasks]
  const output: string[] = []
  let picks = 0

  for (let guard = 0; guard < 200; guard += 1) {
    const nextId = legalNextId({ microtasks: micro, tasks })
    if (nextId === null) break
    const item = (micro[0]?.id === nextId ? micro.shift() : tasks.shift()) as EventLoopItem
    picks += 1
    if (item.output) output.push(item.output)
    for (const spawn of item.spawns ?? []) {
      if (spawn.queue === 'microtask') micro.push(spawn.item)
      else tasks.push(spawn.item)
    }
  }
  return { output, picks }
}

const allItems = (wave: Wave): EventLoopItem[] => {
  const walk = (items: EventLoopItem[]): EventLoopItem[] =>
    items.flatMap((item) => [item, ...walk((item.spawns ?? []).map((spawn) => spawn.item))])
  return walk([...wave.microtasks, ...wave.tasks])
}

const labels = (wave: Wave) => allItems(wave).map((item) => item.label)

describe('генератор волн', () => {
  it('одна и та же волна с одним сидом собирается одинаково', () => {
    expect(generateWave(7, 42)).toEqual(generateWave(7, 42))
  })

  it('разные сиды дают разные волны', () => {
    const variants = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(generateWave(9, seed))))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('нулевой и отрицательной волны не бывает', () => {
    expect(() => generateWave(0)).toThrow(/Волна начинается с 1/)
    expect(() => generateWave(-3)).toThrow()
  })

  describe('первая волна — как уровень 4', () => {
    it('только then и setTimeout, по две операции, без спаунов', () => {
      const wave = generateWave(1)

      expect(wave.microtasks).toHaveLength(2)
      expect(wave.tasks).toHaveLength(2)
      expect(wave.microtasks.every((item) => item.label.startsWith('then →'))).toBe(true)
      expect(wave.tasks.every((item) => item.label.startsWith('timeout →'))).toBe(true)
      expect(allItems(wave).every((item) => !item.spawns)).toBe(true)
      expect(wave.totalPicks).toBe(4)
    })

    it('на первой волне ничего не объясняется — игрок это уже проходил', () => {
      expect(generateWave(1).unlocked).toEqual([])
    })
  })

  describe('словарь операций расширяется по волнам', () => {
    const seenUpTo = (wave: number, seeds = 40) =>
      new Set(
        Array.from({ length: seeds }, (_, seed) => generateWave(wave, seed + 1))
          .flatMap(labels)
          .map((label) => label.split(' →')[0]),
      )

    it('queueMicrotask появляется с третьей волны, не раньше', () => {
      expect(seenUpTo(2)).not.toContain('queueMicrotask')
      expect(seenUpTo(3)).toContain('queueMicrotask')
    })

    it('продолжение после await — с пятой', () => {
      expect(seenUpTo(4)).not.toContain('continuation')
      expect(seenUpTo(5)).toContain('continuation')
    })

    it('setInterval — с седьмой', () => {
      expect(seenUpTo(6)).not.toContain('interval')
      expect(seenUpTo(7)).toContain('interval')
    })

    it('requestAnimationFrame не используется вообще: его колбэк — не задача', () => {
      expect(seenUpTo(30, 60)).not.toContain('rAF')
      expect(seenUpTo(30, 60)).not.toContain('requestAnimationFrame')
    })

    it('новая операция объясняется ровно на той волне, где появилась', () => {
      expect(introsFor(3).join(' ')).toMatch(/queueMicrotask/)
      expect(introsFor(5).join(' ')).toMatch(/await/)
      expect(introsFor(7).join(' ')).toMatch(/setInterval/)
      expect(introsFor(4)).toEqual([])
    })
  })

  describe('операции, порождающие новые', () => {
    const spawnKinds = (wave: number, seeds = 40) => {
      const kinds = new Set<string>()
      for (let seed = 1; seed <= seeds; seed += 1) {
        const generated = generateWave(wave, seed)
        for (const host of generated.microtasks) {
          for (const spawn of host.spawns ?? []) kinds.add(`microtask→${spawn.queue}`)
        }
        for (const host of generated.tasks) {
          for (const spawn of host.spawns ?? []) kinds.add(`task→${spawn.queue}`)
        }
      }
      return kinds
    }

    it('задача, ставящая микрозадачу, появляется со второй волны', () => {
      expect(spawnKinds(1)).toEqual(new Set())
      expect(spawnKinds(2)).toEqual(new Set(['task→microtask']))
    })

    it('микрозадача, ставящая микрозадачу, — с шестой', () => {
      expect(spawnKinds(5)).not.toContain('microtask→microtask')
      expect(spawnKinds(6)).toContain('microtask→microtask')
    })

    it('задача, ставящая задачу, — с восьмой', () => {
      expect(spawnKinds(7)).not.toContain('task→task')
      expect(spawnKinds(8)).toContain('task→task')
    })

    it('порождённая операция сама ничего не порождает — волна конечна', () => {
      for (let wave = 1; wave <= 40; wave += 1) {
        for (const item of allItems(generateWave(wave, wave))) {
          for (const spawn of item.spawns ?? []) {
            expect(spawn.item.spawns).toBeUndefined()
          }
        }
      }
    })

    it('операция, которая поставит новую, честно об этом предупреждает', () => {
      for (let wave = 2; wave <= 20; wave += 1) {
        for (const item of allItems(generateWave(wave, wave))) {
          if (item.spawns?.length) expect(item.note).toMatch(/поставит/)
        }
      }
    })
  })

  describe('рост сложности', () => {
    it('очереди удлиняются и упираются в потолок', () => {
      expect(microtaskCount(1)).toBe(2)
      expect(taskCount(1)).toBe(2)
      expect(microtaskCount(100)).toBe(MAX_MICROTASKS)
      expect(taskCount(100)).toBe(MAX_TASKS)
      expect(spawnCount(1)).toBe(0)
      expect(spawnCount(100)).toBe(MAX_SPAWNS)
    })

    it('длина очередей не убывает с волнами', () => {
      for (let wave = 2; wave <= 60; wave += 1) {
        expect(microtaskCount(wave)).toBeGreaterThanOrEqual(microtaskCount(wave - 1))
        expect(taskCount(wave)).toBeGreaterThanOrEqual(taskCount(wave - 1))
        expect(spawnCount(wave)).toBeGreaterThanOrEqual(spawnCount(wave - 1))
      }
    })

    it('поздняя волна требует больше ходов, чем первая', () => {
      expect(generateWave(30, 5).totalPicks).toBeGreaterThan(generateWave(1, 5).totalPicks)
    })

    it('режим остаётся компактным: раунд не разрастается бесконечно', () => {
      for (let wave = 1; wave <= 200; wave += 5) {
        expect(generateWave(wave, wave).totalPicks).toBeLessThanOrEqual(
          MAX_MICROTASKS + MAX_TASKS + MAX_SPAWNS,
        )
      }
    })
  })

  describe('корректность любой волны', () => {
    const waves = Array.from({ length: 60 }, (_, index) => generateWave(index + 1, index + 1))

    it('очереди не пустые', () => {
      for (const wave of waves) {
        expect(wave.microtasks.length).toBeGreaterThan(0)
        expect(wave.tasks.length).toBeGreaterThan(0)
      }
    })

    it('идентификаторы уникальны — иначе сломается выбор операции', () => {
      for (const wave of waves) {
        const ids = allItems(wave).map((item) => item.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    })

    it('каждая операция печатает свою букву', () => {
      for (const wave of waves) {
        const outputs = allItems(wave).map((item) => item.output)
        expect(outputs.every(Boolean)).toBe(true)
        expect(new Set(outputs).size).toBe(outputs.length)
      }
    })

    it('волна проходится по правилам Event Loop за обещанное число ходов', () => {
      for (const wave of waves) {
        const played = playByTheRules(wave)
        expect(played.picks).toBe(wave.totalPicks)
        expect(played.output).toHaveLength(wave.totalPicks)
      }
    })
  })
})
