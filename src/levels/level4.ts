import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `Promise.resolve().then(() => console.log("C"));
Promise.resolve().then(() => console.log("D"));

setTimeout(() => {
    console.log("B");
    Promise.resolve().then(() => console.log("F"));
}, 0);

setTimeout(() => console.log("E"), 0);

// Синхронный код уже закончился.
// Дальше Event Loop — это ты.`

const timeline = new Timeline()
  .enqueueMicro({ id: 'micro-c', label: 'then → C', kind: 'promise' },
    'Стартовое состояние раунда: синхронный код отработал, Call Stack пуст.', { lines: [1], phase: 'microtask' })
  .enqueueMicro({ id: 'micro-d', label: 'then → D', kind: 'promise' },
    'В Microtask Queue ждут две реакции промисов: C и D.', { lines: [2], phase: 'microtask' })
  .enqueueTask({ id: 'task-b', label: 'timeout → B', kind: 'timer' },
    'В Task Queue ждут два колбэка таймеров: B и E.', { lines: [4, 7], phase: 'task' })
  .enqueueTask({ id: 'task-e', label: 'timeout → E', kind: 'timer' },
    'Оба таймера уже истекли, их колбэки стоят в очереди задач.', { lines: [9], phase: 'task' })
  .microToStack('Микрозадачи первыми: берём C.', { lines: [1], phase: 'microtask' })
  .log('C', 'Выполняется колбэк C.', { lines: [1], phase: 'microtask' })
  .pop('Очередь микрозадач ещё не пуста — задачу брать рано.', { phase: 'microtask' })
  .microToStack('Следующая микрозадача: D.', { lines: [2], phase: 'microtask' })
  .log('D', 'Выполняется колбэк D.', { lines: [2], phase: 'microtask' })
  .pop('Microtask Queue пуста. Вот теперь можно взять одну задачу.', { phase: 'idle' })
  .taskToStack('Берём первую задачу — колбэк B.', { lines: [4], phase: 'task' })
  .log('B', 'B напечатано.', { lines: [5], phase: 'task' })
  .enqueueMicro({ id: 'micro-f', label: 'then → F', kind: 'promise' },
    'Внутри задачи создана новая микрозадача F.', { lines: [6], phase: 'microtask' })
  .pop('Задача B завершена, Call Stack пуст.', { lines: [7], phase: 'idle' })
  .microToStack('ЛОВУШКА: после каждой задачи снова опустошается Microtask Queue. F идёт раньше E.',
    { lines: [6], phase: 'microtask' })
  .log('F', 'F выполняется до следующей задачи.', { lines: [6], phase: 'microtask' })
  .pop('Микрозадач больше нет.', { phase: 'idle' })
  .taskToStack('Теперь — вторая задача, E.', { lines: [9], phase: 'task' })
  .log('E', 'E напечатано последним.', { lines: [9], phase: 'task' })
  .pop('Все очереди пусты. Раунд окончен.', { phase: 'idle' })

export const level4: Level = {
  id: 'level4',
  badge: 'Level 4',
  title: 'You Are The Event Loop',
  topic: 'Алгоритм Event Loop',
  goal: 'Самому выполнить алгоритм Event Loop и не нарушить его правила.',
  code,
  expectedOutput: ['C', 'D', 'B', 'F', 'E'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level4-loop',
      kind: 'event-loop',
      prompt: 'Call Stack пуст. Выбирай, какую операцию Event Loop выполнит следующей.',
      microtasks: [
        { id: 'micro-c', label: 'then → C', output: 'C' },
        { id: 'micro-d', label: 'then → D', output: 'D' },
      ],
      tasks: [
        {
          id: 'task-b',
          label: 'timeout → B',
          output: 'B',
          note: 'внутри создаёт новую микрозадачу',
          spawns: [{ queue: 'microtask', item: { id: 'micro-f', label: 'then → F', output: 'F' } }],
        },
        { id: 'task-e', label: 'timeout → E', output: 'E' },
      ],
    },
  ],
  hints: [
    'Одна из очередей всегда имеет приоритет.',
    'Task берётся только тогда, когда Microtask Queue полностью пуста.',
    'Задача может породить новую микрозадачу — и эта микрозадача выполнится раньше следующей задачи.',
  ],
  keyIdea: 'Цикл: выполнить одну задачу → опустошить ВСЮ очередь микрозадач → повторить.',
  debrief: [
    'Алгоритм Event Loop в одном абзаце: пока Call Stack не пуст — ждём. Как только он пуст — выполняем микрозадачи до последней, в том числе те, что появились прямо сейчас. Затем берём ровно одну задачу и всё повторяется.',
    'Именно из-за «в том числе те, что появились прямо сейчас» микрозадачи могут полностью заблокировать очередь задач. Этим займётся Level 8.',
  ],
  parTimeSec: 180,
}
