import type { Level } from '../engine/types'
import { boss } from './boss'
import { level1 } from './level1'
import { level2 } from './level2'
import { level3 } from './level3'
import { level4 } from './level4'
import { level5 } from './level5'
import { level6 } from './level6'
import { level7 } from './level7'
import { level8 } from './level8'
import { tutorial } from './tutorial'

export const levels: Level[] = [
  tutorial,
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  boss,
]

export function levelById(id: string): Level | undefined {
  return levels.find((level) => level.id === id)
}

export function nextLevelId(id: string): string | null {
  const index = levels.findIndex((level) => level.id === id)
  if (index < 0 || index === levels.length - 1) return null
  return levels[index + 1].id
}
