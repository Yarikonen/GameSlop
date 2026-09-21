import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `console.log("A");
console.log("B");
console.log("C");`

const timeline = new Timeline()
  .push({ id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код' },
    'Глобальный код начинает выполняться.', { lines: [1, 2, 3] })
  .log('A', 'Первый вызов console.log попадает в стек.', { lines: [1] })
  .log('B', 'Движок переходит к следующей строке — раньше он к ней перейти не мог.', { lines: [2] })
  .log('C', 'И только теперь — третья строка.', { lines: [3] })
  .pop('Код закончился, Call Stack пуст.', { lines: [3], phase: 'idle' })

export const level1: Level = {
  id: 'level1',
  badge: 'Level 1',
  title: 'Output Predictor',
  topic: 'Синхронный JavaScript',
  goal: 'Освоить основную механику игры: сначала прогноз, потом запуск.',
  code,
  expectedOutput: ['A', 'B', 'C'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level1-predict',
      kind: 'predict-output',
      prompt: 'Собери Output программы. Карточки перетаскиваются мышью или ставятся кликом.',
      cards: ['C', 'A', 'B'],
      answer: ['A', 'B', 'C'],
    },
    {
      id: 'level1-frames',
      kind: 'choice',
      prompt: 'Сколько фреймов находится в Call Stack в момент выполнения console.log("B")?',
      options: [
        { id: '1', label: '1', why: 'Глобальный контекст никуда не делся — он под вызовом console.log.' },
        { id: '2', label: '2', detail: 'main() и сам console.log("B")' },
        { id: '3', label: '3', why: 'console.log("A") уже снялся со стека, он не остаётся там навсегда.' },
        { id: '0', label: '0', why: 'Если бы стек был пуст, выполнять было бы нечего.' },
      ],
      answer: '2',
      explanation: 'В стеке лежит глобальный контекст main(), а поверх него — текущий вызов console.log("B").',
    },
  ],
  hints: [
    'Здесь нет ни таймеров, ни промисов.',
    'Синхронный код выполняется ровно в том порядке, в котором написан.',
    'A → B → C. Движок не может перепрыгнуть строку: стек один.',
  ],
  keyIdea: 'Синхронный код выполняется строго сверху вниз, операция за операцией.',
  debrief: [
    'Пока в коде нет асинхронных операций, порядок Output совпадает с порядком строк.',
    'Дальше появятся setTimeout и Promise — и именно там порядок перестанет совпадать с текстом программы.',
  ],
  parTimeSec: 100,
}
