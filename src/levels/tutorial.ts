import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `function hello() {
    console.log("Hello");
}

function start() {
    hello();
}

start();`

const timeline = new Timeline()
  .push({ id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код' },
    'Движок начинает выполнять файл: в Call Stack ложится глобальный контекст main().', { lines: [9] })
  .push({ id: 'start', label: 'start()', kind: 'frame' },
    'Вызов start() создаёт новый фрейм — он ложится ПОВЕРХ main(). Стек растёт вверх.', { lines: [9] })
  .push({ id: 'hello', label: 'hello()', kind: 'frame' },
    'Внутри start() вызывается hello() — ещё один фрейм поверх предыдущего.', { lines: [6] })
  .log('Hello', 'console.log — такой же вызов функции: свой фрейм в стеке.', {
    lines: [2],
    after: 'console.log отработал, напечатал "Hello" и снялся со стека.',
  })
  .pop('hello() дошла до конца — фрейм снимается. Стек всегда разбирается сверху вниз.', { lines: [3] })
  .pop('start() больше нечего делать — фрейм снят.', { lines: [7] })
  .pop('main() завершён. Call Stack пуст — синхронная работа закончена.', { lines: [9], phase: 'idle' })

export const tutorial: Level = {
  id: 'tutorial',
  badge: 'Tutorial',
  title: 'Call Stack',
  topic: 'Call Stack',
  goal: 'Понять, как JavaScript выполняет обычный синхронный код — до всякой асинхронности.',
  code,
  expectedOutput: ['Hello'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'tutorial-next-frame',
      kind: 'choice',
      gateStep: 1,
      prompt: 'Стек сейчас: main() → start(). Что ляжет в Call Stack следующим?',
      options: [
        { id: 'hello', label: 'hello()', detail: 'вызов внутри start()' },
        { id: 'log', label: 'console.log("Hello")', why: 'console.log вызывается не напрямую из start(), а уже внутри hello().' },
        { id: 'main', label: 'main()', why: 'main() уже в стеке, он лежит в самом низу.' },
        { id: 'nothing', label: 'Ничего, стек начнёт разбираться', why: 'start() ещё не дошла до конца: внутри неё есть вызов.' },
      ],
      answer: 'hello',
      explanation: 'Вызов функции = новый фрейм поверх текущего. start() вызывает hello(), значит hello() ложится сверху.',
    },
    {
      id: 'tutorial-next-pop',
      kind: 'choice',
      gateStep: 4,
      prompt: '"Hello" напечатан, стек: main() → start() → hello(). Что произойдёт дальше?',
      options: [
        { id: 'pop-hello', label: 'hello() снимется со стека', detail: 'в теле функции больше нет кода' },
        { id: 'pop-main', label: 'main() снимется со стека', why: 'Снять можно только верхний фрейм — стек это LIFO.' },
        { id: 'call-start', label: 'start() вызовется ещё раз', why: 'Повторного вызова в коде нет.' },
        { id: 'log-again', label: 'console.log напечатает ещё раз', why: 'console.log уже отработал и снялся со стека.' },
      ],
      answer: 'pop-hello',
      explanation: 'Стек — структура LIFO: снимается всегда верхний фрейм. Функция уходит из стека, когда её код закончился.',
    },
  ],
  hints: [
    'Стек работает по принципу «последним пришёл — первым вышел».',
    'Каждый вызов функции добавляет фрейм, каждый return — убирает.',
    'main() → start() → hello() → console.log(). Разбирается стек в обратном порядке.',
  ],
  keyIdea: 'JavaScript выполняет код в одном Call Stack — строго по одной операции за раз.',
  debrief: [
    'Call Stack — это список функций, которые прямо сейчас выполняются. Вызов кладёт фрейм наверх, возврат снимает его.',
    'Пока стек не пуст, движок занят: он физически не может выполнить ничего другого. Именно отсюда растут все последующие уровни — очереди нужны только потому, что стек один.',
  ],
  parTimeSec: 90,
}
