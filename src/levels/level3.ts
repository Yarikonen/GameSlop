import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `console.log("A");

setTimeout(() => {
    console.log("B");
}, 0);

Promise.resolve()
    .then(() => console.log("C"));

console.log("D");`

const timeline = new Timeline()
  .push({ id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код' },
    'Синхронный код пошёл.', { lines: [1] })
  .log('A', 'Первая синхронная строка.', { lines: [1] })
  .push({ id: 'set-timeout', label: 'setTimeout(cb, 0)', kind: 'timer' },
    'setTimeout отдаёт колбэк браузеру.', { lines: [3, 5] })
  .toRuntime({ id: 'timer-b', label: 'Timer 0 ms', kind: 'timer', note: 'держит callback B' },
    'Таймер живёт в Web API, движок свободен.', { lines: [3, 5] })
  .pop('setTimeout вернулся мгновенно.', { lines: [5] })
  .runtimeToTask('timer-b', 'callback B',
    'Таймер истёк → колбэк B встаёт в Task Queue (очередь макрозадач).', { lines: [4] })
  .push({ id: 'promise-then', label: 'Promise.resolve().then(cb)', kind: 'promise' },
    'Промис уже выполнен (resolved), поэтому .then регистрирует реакцию.', { lines: [7, 8] })
  .enqueueMicro({ id: 'micro-c', label: 'then → C', kind: 'promise' },
    'Реакция промиса идёт НЕ в Task Queue, а в Microtask Queue.', { lines: [8], phase: 'microtask' })
  .pop('.then() тоже вернулся сразу — колбэк он не выполняет.', { lines: [8] })
  .log('D', 'Синхронный код продолжается как ни в чём не бывало.', { lines: [10] })
  .pop('Синхронная часть закончилась — Call Stack пуст.', { lines: [10], phase: 'idle' })
  .snap('Правило Event Loop: стек пуст → СНАЧАЛА полностью опустошается Microtask Queue.', { phase: 'microtask' })
  .microToStack('Микрозадача C переходит в Call Stack.', { lines: [8], phase: 'microtask' })
  .log('C', 'Колбэк промиса выполняется.', { lines: [8], phase: 'microtask' })
  .pop('Microtask Queue пуста — только теперь можно брать задачу.', { phase: 'idle' })
  .taskToStack('Event Loop берёт первую задачу из Task Queue.', { lines: [3], phase: 'task' })
  .log('B', 'Колбэк таймера выполняется последним.', { lines: [4], phase: 'task' })
  .pop('Всё пусто: программа завершена.', { lines: [5], phase: 'idle' })

export const level3: Level = {
  id: 'level3',
  badge: 'Level 3',
  title: 'Microtask Battle',
  topic: 'Microtask Queue vs Task Queue',
  goal: 'Понять, почему колбэк промиса обгоняет колбэк setTimeout.',
  code,
  expectedOutput: ['A', 'D', 'C', 'B'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level3-classify',
      kind: 'classify',
      prompt: 'Сначала разложи отложенные операции по очередям.',
      items: [
        { id: 'then-c', label: 'then(() => log("C"))', kind: 'promise' },
        { id: 'timeout-b', label: 'timeout(() => log("B"))', kind: 'timer' },
      ],
      buckets: [
        { id: 'microtask', label: 'Microtask Queue', hint: 'промисы, queueMicrotask, продолжения после await' },
        { id: 'task', label: 'Task Queue', hint: 'таймеры, события, сетевые колбэки' },
      ],
      answer: { 'then-c': 'microtask', 'timeout-b': 'task' },
    },
    {
      id: 'level3-predict',
      kind: 'predict-output',
      prompt: 'Теперь собери Output целиком.',
      cards: ['B', 'D', 'A', 'C'],
      answer: ['A', 'D', 'C', 'B'],
    },
    {
      id: 'level3-why',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Почему C печатается раньше B, хотя setTimeout написан выше?',
      options: [
        {
          id: 'priority',
          label: 'После опустошения стека Event Loop полностью разбирает Microtask Queue и только потом берёт одну задачу',
          detail: 'микрозадачи имеют приоритет перед следующей task',
        },
        {
          id: 'faster',
          label: 'Промисы работают быстрее таймеров',
          why: 'Скорость тут ни при чём: дело в разных очередях и правилах их обхода.',
        },
        {
          id: 'order',
          label: 'Порядок зависит от того, какая операция записана ниже в коде',
          why: 'Тогда бы порядок был B, затем C — но очередь определяется типом операции, а не строкой.',
        },
        {
          id: 'sync',
          label: 'Promise.then выполняется синхронно',
          why: 'Если бы .then выполнялся синхронно, C напечаталось бы до D.',
        },
      ],
      answer: 'priority',
      explanation:
        'Call Stack пуст → выполняются ВСЕ микрозадачи (включая те, что появились по ходу) → и только потом берётся одна задача из Task Queue.',
    },
  ],
  hints: [
    'Обрати внимание на Microtask Queue.',
    'Promise callbacks имеют приоритет перед следующей task.',
    'Promise.then() → Microtask Queue → выполняется до колбэка setTimeout. Значит: A, D, затем C, затем B.',
  ],
  keyIdea: 'Стек пуст → все микрозадачи → одна задача. В таком порядке, всегда.',
  debrief: [
    'Очередей две, и они не равны. Микрозадачи (промисы, queueMicrotask, продолжения после await) разбираются целиком, до последней. Задачи (таймеры, события, I/O-колбэки) берутся по одной.',
    'Отсюда практическое следствие: ни одна микрозадача не даст браузеру перерисовать кадр или обработать клик — этим занимаются задачи.',
  ],
  parTimeSec: 210,
}
