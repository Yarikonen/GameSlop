import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `// /api/users 1000 ms · /api/orders 3000 ms · /api/profile 500 ms

const [users, orders, profile] = await Promise.all([
    fetch("/api/users"),
    fetch("/api/orders"),
    fetch("/api/profile")
]);

render(users, orders, profile);`

const timeline = new Timeline()
  .push({ id: 'main', label: 'loadDashboard()', kind: 'async' },
    'Функция начинает выполняться синхронно.', { lines: [3] })
  .toRuntime({ id: 'io-users', label: 'GET /api/users', kind: 'io', note: '1000 ms' },
    'fetch стартует запрос и сразу возвращает промис. Сеть — это Web API, а не JS.', { lines: [4] })
  .toRuntime({ id: 'io-orders', label: 'GET /api/orders', kind: 'io', note: '3000 ms' },
    'Второй запрос стартует, не дожидаясь первого.', { lines: [5] })
  .toRuntime({ id: 'io-profile', label: 'GET /api/profile', kind: 'io', note: '500 ms' },
    'И третий. Все три запроса уже «в полёте» одновременно.', { lines: [6] })
  .push({ id: 'all', label: 'Promise.all([...])', kind: 'promise' },
    'Promise.all собирает три промиса в один.', { lines: [3, 7] })
  .pop('await снимает функцию со стека.', { lines: [3] })
  .pop('Call Stack пуст. Движок JS полностью свободен, пока сеть работает.', { phase: 'idle' })
  .runtimeToMicro('io-profile', 'resolve /api/profile',
    '≈500 мс: пришёл самый быстрый ответ. Его реакция встаёт в Microtask Queue.', { lines: [6], phase: 'runtime' })
  .microToStack('Микрозадача выполняется: промис /api/profile становится fulfilled.', { phase: 'microtask' })
  .pop('Promise.all ждёт остальные ответы.', { phase: 'idle' })
  .runtimeToMicro('io-users', 'resolve /api/users',
    '≈1000 мс: пришёл ответ /api/users.', { lines: [4], phase: 'runtime' })
  .microToStack('Ещё одна микрозадача.', { phase: 'microtask' })
  .pop('Остался самый медленный запрос.', { phase: 'idle' })
  .runtimeToMicro('io-orders', 'resolve /api/orders',
    '≈3000 мс: пришёл последний ответ. Все три промиса выполнены.', { lines: [5], phase: 'runtime' })
  .microToStack('Микрозадача резолвит Promise.all → продолжение функции возобновляется.', { lines: [3], phase: 'microtask' })
  .log('rendered after ~3000 ms', 'Данные готовы. Общее время = самый долгий запрос, а не их сумма.', { lines: [9] })
  .pop('Готово. Последовательные await дали бы ~4500 мс.', { phase: 'idle' })

export const level6: Level = {
  id: 'level6',
  badge: 'Level 6',
  title: 'Fetch Racing',
  topic: 'Асинхронный I/O и конкурентность',
  goal: 'Увидеть разницу между последовательным ожиданием и конкурентным запуском запросов.',
  code,
  expectedOutput: ['rendered after ~3000 ms'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level6-race',
      kind: 'sandbox',
      sandbox: 'fetch-race',
      prompt: 'Запусти оба варианта и сравни таймлайны (время ускорено в 4 раза).',
    },
    {
      id: 'level6-choice',
      kind: 'choice',
      prompt: 'Какой вариант загрузит дашборд быстрее?',
      code: `// A
const users = await fetch("/api/users");
const orders = await fetch("/api/orders");
const profile = await fetch("/api/profile");

// B
const [users, orders, profile] = await Promise.all([
    fetch("/api/users"),
    fetch("/api/orders"),
    fetch("/api/profile")
]);`,
      options: [
        { id: 'b', label: 'Вариант B — Promise.all', detail: '≈3000 мс: время самого медленного запроса' },
        { id: 'a', label: 'Вариант A — три await подряд', why: 'Каждый await ждёт завершения предыдущего запроса: 1000 + 3000 + 500 ≈ 4500 мс.' },
        { id: 'same', label: 'Одинаково — запросы всё равно идут по сети', why: 'Разница именно в моменте СТАРТА запросов: в варианте A они стартуют по очереди.' },
        { id: 'a-fast', label: 'Вариант A — он не создаёт лишних объектов', why: 'Стоимость объектов промиса несопоставима с сетевыми задержками.' },
      ],
      answer: 'b',
      explanation:
        'В варианте B все три запроса стартуют сразу и ждут одновременно, поэтому общее время равно самому долгому из них.',
    },
    {
      id: 'level6-why',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Почему Promise.all даёт ≈3000 мс, а не 4500 и не 1500?',
      options: [
        {
          id: 'concurrent',
          label: 'Запросы ждут конкурентно (в Web API/сети), поэтому общее время = максимум из них',
          detail: 'JS-поток в это время свободен и ничего не ждёт',
        },
        {
          id: 'threads',
          label: 'Promise.all выполняет запросы в трёх параллельных потоках JS',
          why: 'Поток JS один. Параллельно работает сеть, а не ваш код.',
        },
        {
          id: 'sum',
          label: 'Время делится между запросами поровну',
          why: 'Запросы не делят между собой процессорное время — они просто ждут ответа сервера.',
        },
        {
          id: 'cache',
          label: 'Браузер кеширует ответы и ускоряет их',
          why: 'Кеш тут ни при чём: ускорение даёт одновременный старт.',
        },
      ],
      answer: 'concurrent',
      explanation:
        'Конкурентность ≠ параллелизм. Ваш код по-прежнему выполняется в одном потоке; одновременно происходит только ОЖИДАНИЕ, которым занимается не JS, а сеть/ОС.',
    },
  ],
  hints: [
    'Сравни, в какой момент СТАРТУЕТ каждый запрос.',
    'await останавливает только вашу функцию, но не мешает другим запросам идти.',
    'Promise.all стартует все запросы сразу: 1000 / 3000 / 500 идут одновременно → ≈3000 мс.',
  ],
  keyIdea: 'Конкурентность — это перекрытие ожиданий, а не параллельное выполнение JS-кода.',
  debrief: [
    'fetch не занимает поток: запрос уходит в Web API, а колбэк возвращается через очередь. Поэтому N запросов можно держать «в полёте» одновременно.',
    'Последовательные await превращают независимые запросы в цепочку и складывают задержки. Promise.all (или сохранение промисов в переменные до await) убирает лишнее ожидание.',
  ],
  parTimeSec: 240,
}
