import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `function spawn() {
    Promise.resolve().then(spawn);
}

spawn();

setTimeout(() => {
    console.log("HELLO");
}, 0);`

const timeline = new Timeline()
  .push({ id: 'main', label: 'main()', kind: 'frame' }, 'Синхронный код стартовал.', { lines: [5] })
  .push({ id: 'spawn-0', label: 'spawn()', kind: 'frame' }, 'Первый вызов spawn().', { lines: [5] })
  .enqueueMicro({ id: 'micro-1', label: 'then → spawn', kind: 'promise' },
    'spawn() ставит микрозадачу, которая снова вызовет spawn.', { lines: [2], phase: 'microtask' })
  .pop('spawn() вернулась.', { lines: [3] })
  .push({ id: 'set-timeout', label: 'setTimeout(cb, 0)', kind: 'timer' },
    'Регистрируется таймер.', { lines: [7, 9] })
  .toRuntime({ id: 'timer-hello', label: 'Timer 0 ms', kind: 'timer', note: 'держит HELLO' },
    'Таймер ушёл в Web API.', { lines: [7, 9] })
  .pop('setTimeout вернулся.', { lines: [9] })
  .runtimeToTask('timer-hello', 'timeout → HELLO',
    'Таймер истёк: колбэк HELLO встал в Task Queue и ждёт свободного Event Loop.', { lines: [8], phase: 'task' })
  .pop('Синхронный код закончился, Call Stack пуст.', { phase: 'idle' })
  .microToStack('Правило: сначала полностью опустошаем Microtask Queue.', { lines: [2], phase: 'microtask' })
  .enqueueMicro({ id: 'micro-2', label: 'then → spawn', kind: 'promise' },
    'Но микрозадача добавляет в очередь НОВУЮ микрозадачу — очередь не пустеет.', { lines: [2], phase: 'microtask' })
  .pop('Микрозадача завершена, но очередь снова не пуста.', { phase: 'microtask' })
  .microToStack('Event Loop опять обязан взять микрозадачу, а не задачу.', { lines: [2], phase: 'microtask' })
  .enqueueMicro({ id: 'micro-3', label: 'then → spawn', kind: 'promise', note: '…и так бесконечно' },
    'Каждая итерация рождает следующую. Microtask Queue не опустеет НИКОГДА.', { lines: [2], phase: 'microtask' })
  .pop('HELLO по-прежнему стоит в Task Queue.', { phase: 'microtask' })
  .snap('Микрозадачи голодоморят очередь задач: HELLO не выполнится, интерфейс не перерисуется, таймеры встанут.',
    { lines: [1, 2, 3], phase: 'microtask' })

export const level8: Level = {
  id: 'level8',
  badge: 'Level 8',
  title: 'Microtask Apocalypse',
  topic: 'Microtask starvation',
  goal: 'Понять, как бесконечная цепочка микрозадач полностью лишает задачи шанса выполниться.',
  code,
  expectedOutput: [],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level8-lab',
      kind: 'sandbox',
      sandbox: 'starvation-lab',
      prompt: 'Лаборатория запускает настоящую цепочку микрозадач в этой вкладке (с аварийным стопом).',
    },
    {
      id: 'level8-why',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Почему callback setTimeout не получает возможности выполниться?',
      options: [
        {
          id: 'never-empty',
          label: 'Каждая микрозадача ставит новую, поэтому Microtask Queue никогда не пустеет — а task берётся только после её полного опустошения',
          detail: 'очередь задач голодает (starvation)',
        },
        {
          id: 'expired',
          label: 'Таймер на 0 мс «протух» и был отменён',
          why: 'Колбэк спокойно лежит в Task Queue и ждёт — его никто не отменял.',
        },
        {
          id: 'priority',
          label: 'У setTimeout слишком низкий приоритет, нужно увеличить задержку',
          why: 'Задержка не поможет: очередь задач вообще не обрабатывается.',
        },
        {
          id: 'stack',
          label: 'Call Stack переполнен, будет RangeError',
          why: 'Переполнения нет: каждая микрозадача выполняется с чистым стеком, поэтому цикл может идти бесконечно.',
        },
      ],
      answer: 'never-empty',
      explanation:
        'Event Loop обязан опустошить Microtask Queue целиком, включая микрозадачи, появившиеся во время обхода. Самовоспроизводящаяся цепочка делает это условие недостижимым.',
    },
    {
      id: 'level8-fix',
      kind: 'choice',
      prompt: 'Как починить этот код, если рекурсия действительно нужна?',
      options: [
        {
          id: 'macrotask',
          label: 'Планировать следующий шаг через setTimeout / очередь задач и обрабатывать данные порциями',
          detail: 'между шагами Event Loop успевает взять задачи и перерисовать кадр',
        },
        {
          id: 'queue-microtask',
          label: 'Заменить Promise.resolve().then на queueMicrotask',
          why: 'Это та же самая микрозадача — поведение не изменится.',
        },
        {
          id: 'async',
          label: 'Сделать spawn async и добавить await',
          why: 'await тоже ставит продолжение в Microtask Queue — цепочка останется бесконечной.',
        },
        {
          id: 'try',
          label: 'Обернуть в try/catch',
          why: 'Ошибки тут нет — есть бесконечная очередь.',
        },
      ],
      answer: 'macrotask',
      explanation:
        'Нужно вернуть управление Event Loop: отдавать следующий шаг в Task Queue (setTimeout / MessageChannel / scheduler.yield), а не в микрозадачи.',
    },
  ],
  hints: [
    'Вспомни правило из Level 4 про опустошение очереди микрозадач.',
    'Микрозадача, поставленная во время обхода очереди, обрабатывается в этом же обходе.',
    'Очередь микрозадач никогда не станет пустой → условие «взять задачу» никогда не наступит.',
  ],
  keyIdea: 'Бесконечная цепочка микрозадач полностью блокирует задачи, рендер и таймеры.',
  debrief: [
    'Микрозадачи выгодны тем, что выполняются как можно раньше. Обратная сторона — их приоритет абсолютен: пока они есть, задач не будет.',
    'Правило простое: рекурсивные или потенциально длинные цепочки шагов планируйте через очередь задач, а не через промисы.',
  ],
  parTimeSec: 240,
}
