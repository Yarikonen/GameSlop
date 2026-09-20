import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `async function load() {
    console.log("B");

    await Promise.resolve();

    console.log("C");
}

console.log("A");

load();

console.log("D");`

const timeline = new Timeline()
  .push({ id: 'main', label: 'main()', kind: 'frame', note: 'глобальный код' },
    'Синхронный код стартовал.', { lines: [9] })
  .log('A', 'Обычный синхронный вызов.', { lines: [9] })
  .push({ id: 'load', label: 'load()', kind: 'async', note: 'async-функция' },
    'load() вызвана. Async-функция начинает выполняться СИНХРОННО — до первого await.', { lines: [11] })
  .log('B', 'Поэтому B печатается сразу, без всякой задержки.', { lines: [2] })
  .push({ id: 'await', label: 'await Promise.resolve()', kind: 'promise' },
    'Дошли до await. Промис уже выполнен — но это ничего не меняет.', { lines: [4] })
  .enqueueMicro({ id: 'cont', label: 'continuation load()', kind: 'async', note: 'всё после await' },
    'Остаток функции (console.log("C")) превращается в микрозадачу-продолжение.', { lines: [4, 6], phase: 'microtask' })
  .pop('await не блокирует поток…', { lines: [4] })
  .pop('…а СНИМАЕТ функцию со стека. load() приостановлена, управление вернулось вызывающему коду.', { lines: [11] })
  .log('D', 'Поэтому D печатается раньше C.', { lines: [13] })
  .pop('Синхронный код закончился, Call Stack пуст.', { lines: [13], phase: 'idle' })
  .microToStack('Event Loop берёт продолжение load() из Microtask Queue.', { lines: [6], phase: 'microtask' })
  .log('C', 'Функция возобновляется ровно с того места, где стояло await.', { lines: [6], phase: 'microtask' })
  .pop('load() дошла до конца и зарезолвила свой промис. Всё пусто.', { lines: [7], phase: 'idle' })

export const level5: Level = {
  id: 'level5',
  badge: 'Level 5',
  title: 'Async / Await Dungeon',
  topic: 'async/await',
  goal: 'Увидеть, что await — это не блокировка, а точка разрыва функции.',
  code,
  expectedOutput: ['A', 'B', 'D', 'C'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level5-predict',
      kind: 'predict-output',
      prompt: 'await стоит перед уже выполненным промисом. Собери Output.',
      cards: ['C', 'A', 'D', 'B'],
      answer: ['A', 'B', 'D', 'C'],
    },
    {
      id: 'level5-where',
      kind: 'choice',
      prompt: 'Куда попадает код, написанный ПОСЛЕ await?',
      options: [
        { id: 'micro', label: 'В Microtask Queue — как продолжение функции', detail: 'await ≈ .then() под капотом' },
        { id: 'task', label: 'В Task Queue', why: 'Тогда продолжение выполнялось бы после таймеров — но оно обгоняет их.' },
        { id: 'stack', label: 'Остаётся в Call Stack и ждёт там', why: 'Фрейм снимается со стека: иначе движок был бы заблокирован.' },
        { id: 'worker', label: 'В отдельный поток', why: 'Никакого второго потока JS тут не появляется.' },
      ],
      answer: 'micro',
      explanation:
        'Async-функция разрезается на части по каждому await. Первая часть выполняется синхронно, остальные — как микрозадачи.',
    },
    {
      id: 'level5-why',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Почему D печатается раньше C, хотя load() вызвана раньше console.log("D")?',
      options: [
        {
          id: 'suspend',
          label: 'На await функция приостанавливается и снимается со стека, а вызывающий код продолжает работу',
          detail: 'C выполнится только когда стек опустеет и дойдёт очередь микрозадач',
        },
        {
          id: 'block',
          label: 'await блокирует поток, поэтому D ждёт',
          why: 'Если бы await блокировал поток, D напечаталось бы после C.',
        },
        {
          id: 'slow',
          label: 'Promise.resolve() резолвится не мгновенно',
          why: 'Он уже выполнен. Даже так продолжение всё равно отложено в микрозадачу.',
        },
        {
          id: 'parallel',
          label: 'load() выполняется параллельно в другом потоке',
          why: 'Поток один. Параллельности тут нет — есть чередование.',
        },
      ],
      answer: 'suspend',
      explanation:
        'await = «верни управление наверх, а продолжение поставь в очередь микрозадач». Поток при этом свободен.',
    },
  ],
  hints: [
    'Async-функция выполняется синхронно ровно до первого await.',
    'await не останавливает поток — он ставит в очередь продолжение функции.',
    'A (sync) → B (sync внутри load) → D (sync) → C (микрозадача-продолжение).',
  ],
  keyIdea: 'await не блокирует поток: он разрезает функцию и откладывает её хвост в Microtask Queue.',
  debrief: [
    'async/await — синтаксис поверх промисов. Тело функции до первого await выполняется обычным синхронным кодом, а всё после каждого await превращается в микрозадачу.',
    'Практическое следствие: await не делает код «медленнее» и не занимает поток ожиданием. Но и не превращает тяжёлые вычисления в фоновые — этим займётся Level 7.',
  ],
  parTimeSec: 210,
}
