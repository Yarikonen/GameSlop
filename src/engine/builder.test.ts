import { describe, expect, it } from 'vitest'
import { Timeline } from './builder'

describe('Timeline — конструктор сценария уровня', () => {
  it('пустой таймлайн не содержит шагов', () => {
    expect(new Timeline().steps()).toEqual([])
  })

  it('push кладёт фрейм в Call Stack и пишет снимок', () => {
    const steps = new Timeline()
      .push({ id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код' }, 'Старт', {
        lines: [1],
      })
      .steps()

    expect(steps).toHaveLength(1)
    expect(steps[0].stack).toEqual([
      { id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код', type: 'stack' },
    ])
    expect(steps[0].description).toBe('Старт')
    expect(steps[0].codeLines).toEqual([1])
    expect(steps[0].phase).toBe('sync')
  })

  it('kind по умолчанию — sync', () => {
    const [step] = new Timeline().push({ id: 'x', label: 'x()' }, 'Шаг').steps()
    expect(step.stack[0].kind).toBe('sync')
  })

  it('pop снимает верхний фрейм и может напечатать строку', () => {
    const steps = new Timeline()
      .push({ id: 'main', label: 'main()' }, 'Старт')
      .push({ id: 'inner', label: 'inner()' }, 'Вложенный вызов')
      .pop('Возврат', { log: 'done' })
      .steps()

    expect(steps[2].stack.map((op) => op.id)).toEqual(['main'])
    expect(steps[2].output).toEqual(['done'])
  })

  it('log добавляет два снимка: вызов и печать', () => {
    const steps = new Timeline()
      .push({ id: 'main', label: 'main()' }, 'Старт')
      .log('A', 'console.log в стеке', { lines: [1], after: 'Напечатано' })
      .steps()

    expect(steps).toHaveLength(3)
    expect(steps[1].stack.at(-1)?.label).toBe('console.log("A")')
    expect(steps[1].output).toEqual([])
    expect(steps[2].stack.map((op) => op.id)).toEqual(['main'])
    expect(steps[2].output).toEqual(['A'])
    expect(steps[2].description).toBe('Напечатано')
  })

  it('log без after получает описание по умолчанию', () => {
    const steps = new Timeline().log('A', 'Вызов').steps()
    expect(steps[1].description).toContain('Строка "A" напечатана')
  })

  it('toRuntime отдаёт работу браузеру и помечает фазу runtime', () => {
    const [step] = new Timeline()
      .toRuntime({ id: 'timer', label: 'Timer 0 ms', kind: 'timer' }, 'Таймер пошёл')
      .steps()

    expect(step.runtime.map((op) => op.id)).toEqual(['timer'])
    expect(step.phase).toBe('runtime')
  })

  it('runtimeToTask переносит колбэк из Web API в Task Queue', () => {
    const steps = new Timeline()
      .toRuntime({ id: 'timer', label: 'Timer 0 ms', kind: 'timer' }, 'Таймер пошёл')
      .runtimeToTask('timer', 'callback B', 'Таймер истёк')
      .steps()

    expect(steps[1].runtime).toEqual([])
    expect(steps[1].tasks.map((op) => op.label)).toEqual(['callback B'])
    expect(steps[1].tasks[0].kind).toBe('timer')
    expect(steps[1].tasks[0].type).toBe('task')
  })

  it('runtimeToMicro переносит реакцию промиса в Microtask Queue', () => {
    const steps = new Timeline()
      .toRuntime({ id: 'fetch', label: 'GET /api', kind: 'io' }, 'Запрос ушёл')
      .runtimeToMicro('fetch', 'then → data', 'Ответ пришёл')
      .steps()

    expect(steps[1].runtime).toEqual([])
    expect(steps[1].microtasks.map((op) => op.label)).toEqual(['then → data'])
    expect(steps[1].microtasks[0].kind).toBe('io')
  })

  it('перенос несуществующей операции не роняет сценарий', () => {
    const steps = new Timeline().runtimeToTask('нет-такого', 'callback', 'Шаг').steps()
    expect(steps[0].tasks).toHaveLength(1)
    expect(steps[0].tasks[0].kind).toBe('timer')
  })

  it('microToStack забирает первую микрозадачу в стек', () => {
    const steps = new Timeline()
      .enqueueMicro({ id: 'm1', label: 'then → C' }, 'Первая микрозадача')
      .enqueueMicro({ id: 'm2', label: 'then → D' }, 'Вторая микрозадача')
      .microToStack('Event Loop берёт C')
      .steps()

    expect(steps[2].microtasks.map((op) => op.id)).toEqual(['m2'])
    expect(steps[2].stack.map((op) => op.id)).toEqual(['m1'])
    expect(steps[2].stack[0].type).toBe('stack')
    expect(steps[2].phase).toBe('microtask')
  })

  it('taskToStack забирает первую задачу в стек', () => {
    const steps = new Timeline()
      .enqueueTask({ id: 't1', label: 'timeout → B' }, 'Задача в очереди')
      .taskToStack('Event Loop берёт B')
      .steps()

    expect(steps[1].tasks).toEqual([])
    expect(steps[1].stack.map((op) => op.id)).toEqual(['t1'])
    expect(steps[1].phase).toBe('task')
  })

  it('пустые очереди переживают попытку взять операцию', () => {
    const steps = new Timeline().microToStack('Пусто').taskToStack('Тоже пусто').steps()
    expect(steps[0].stack).toEqual([])
    expect(steps[1].stack).toEqual([])
  })

  it('снимки независимы: поздние шаги не переписывают ранние', () => {
    const timeline = new Timeline().push({ id: 'main', label: 'main()' }, 'Старт')
    const steps = timeline.log('A', 'Печать').pop('Конец').steps()

    expect(steps[0].stack.map((op) => op.id)).toEqual(['main'])
    expect(steps[0].output).toEqual([])
    expect(steps.at(-1)?.stack).toEqual([])
    expect(steps.at(-1)?.output).toEqual(['A'])

    steps[0].stack[0].label = 'взломано'
    expect(steps[1].stack[0].label).toBe('main()')
  })

  it('явная фаза важнее фазы по умолчанию', () => {
    const [step] = new Timeline().snap('Простой', { phase: 'idle' }).steps()
    expect(step.phase).toBe('idle')
  })
})
