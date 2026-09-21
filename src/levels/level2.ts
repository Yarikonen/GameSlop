import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `console.log("A");

setTimeout(() => {
    console.log("B");
}, 0);

console.log("C");`

const timeline = new Timeline()
  .push({ id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код' },
    'Синхронный код начинает выполняться.', { lines: [1] })
  .log('A', 'Обычный синхронный вызов.', { lines: [1] })
  .push({ id: 'set-timeout', label: 'setTimeout(cb, 0)', kind: 'timer' },
    'Вызывается setTimeout. Это функция браузера (Web API), а не часть языка JavaScript.', { lines: [3, 5] })
  .toRuntime({ id: 'timer-b', label: 'Timer 0 ms', kind: 'timer', note: 'держит callback B' },
    'setTimeout отдаёт колбэк и задержку в Web API. Таймер тикает ВНЕ движка JS.', { lines: [3, 5] })
  .pop('setTimeout мгновенно вернулся: движок не ждёт таймер ни секунды.', { lines: [5] })
  .runtimeToTask('timer-b', 'callback B',
    'Таймер 0 мс истёк почти сразу. Но колбэк НЕ выполняется на месте — он встаёт в Task Queue.',
    { lines: [4] })
  .log('C', 'Движок как ни в чём не бывало выполняет следующую синхронную строку.', { lines: [7] })
  .pop('Синхронный код закончился — Call Stack пуст.', { lines: [7], phase: 'idle' })
  .snap('Только теперь Event Loop получает право что-то сделать: он смотрит на очереди.', { phase: 'idle' })
  .taskToStack('Call Stack свободен → Event Loop переносит первую задачу из Task Queue в стек.', { lines: [3], phase: 'task' })
  .log('B', 'Колбэк наконец выполняется.', { lines: [4], phase: 'task' })
  .pop('Колбэк завершён. Стек и очереди пусты — программа закончена.', { lines: [5], phase: 'idle' })

export const level2: Level = {
  id: 'level2',
  badge: 'Level 2',
  title: 'Timer Attack',
  topic: 'setTimeout и Task Queue',
  goal: 'Разобраться, почему setTimeout(cb, 0) не выполняет колбэк немедленно.',
  code,
  expectedOutput: ['A', 'C', 'B'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level2-predict',
      kind: 'predict-output',
      prompt: 'Задержка равна нулю. Собери Output — и только потом запускай симуляцию.',
      cards: ['B', 'A', 'C'],
      answer: ['A', 'C', 'B'],
    },
    {
      id: 'level2-why',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Почему setTimeout(callback, 0) не означает немедленное выполнение callback?',
      options: [
        {
          id: 'queue',
          label: 'Колбэк попадает в Task Queue и ждёт, пока Call Stack не освободится',
          detail: '0 мс — это «не раньше чем через 0 мс», а не «прямо сейчас»',
        },
        {
          id: 'clamp',
          label: 'Браузер заменяет 0 на 4 мс, поэтому есть задержка',
          why: 'Минимальный клемп в 4 мс действительно существует для вложенных таймеров, но даже с настоящим 0 колбэк всё равно ждал бы свободного стека.',
        },
        {
          id: 'thread',
          label: 'Колбэк выполняется в отдельном потоке и стартует позже',
          why: 'Колбэк выполняется в том же единственном потоке JS. В другом потоке живёт только сам таймер.',
        },
        {
          id: 'slow',
          label: 'console.log("C") выполняется слишком быстро, колбэк не успевает',
          why: 'Дело не в скорости: даже очень долгий синхронный код не пустит колбэк вперёд себя.',
        },
      ],
      answer: 'queue',
      explanation:
        'setTimeout лишь регистрирует таймер в Web API. Когда время вышло, колбэк встаёт в Task Queue и выполняется только после того, как Call Stack полностью опустеет.',
    },
  ],
  hints: [
    'Обрати внимание: setTimeout возвращается мгновенно.',
    'Колбэк не может попасть в стек, пока там есть хоть один фрейм.',
    'A и C — синхронные, B ждёт в Task Queue до конца синхронного кода.',
  ],
  keyIdea: 'Задержка в setTimeout — это минимальное время до попадания в очередь, а не время выполнения.',
  debrief: [
    'setTimeout не «откладывает выполнение на 0 мс». Он отдаёт колбэк браузеру, браузер по истечении таймера кладёт его в Task Queue, и только освободившийся Call Stack позволяет Event Loop его забрать.',
    'Поэтому setTimeout(..., 0) — это способ сказать «выполни после текущего синхронного кода», а не «выполни немедленно».',
  ],
  parTimeSec: 150,
}
