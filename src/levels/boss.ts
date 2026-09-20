import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `app.get("/report", async (req, res) => {
    const data = await db.getData();      // I/O, ~40 ms

    const report = calculateReport(data); // CPU, ~6400 ms

    res.json(report);
});`

const timeline = new Timeline()
  .enqueueTask({ id: 'req-report', label: 'GET /report', kind: 'io' },
    'В очередь событий сервера приходит запрос /report.', { phase: 'task' })
  .enqueueTask({ id: 'req-users', label: 'GET /users', kind: 'io' },
    'Следом — обычные лёгкие запросы.', { phase: 'task' })
  .enqueueTask({ id: 'req-profile', label: 'GET /profile', kind: 'io' }, 'Очередь растёт.', { phase: 'task' })
  .enqueueTask({ id: 'req-health', label: 'GET /health', kind: 'io' },
    'Даже health-check стоит в той же очереди.', { phase: 'task' })
  .taskToStack('Event Loop берёт первый запрос — /report.', { lines: [1], phase: 'task' })
  .toRuntime({ id: 'db', label: 'db.getData()', kind: 'io', note: '~40 ms' },
    'Запрос в БД уходит в libuv / драйвер. Это честный асинхронный I/O.', { lines: [2] })
  .pop('await снимает хендлер со стека. Поток свободен — сервер может обслуживать других.', { lines: [2], phase: 'idle' })
  .taskToStack('Пока БД отвечает, Event Loop берёт /users.', { phase: 'task' })
  .log('GET /users 200 — 12 ms', 'Лёгкий запрос обработан мгновенно. Пока всё хорошо.', { phase: 'task' })
  .pop('Стек снова свободен.', { phase: 'idle' })
  .runtimeToMicro('db', 'resolve db.getData()',
    'БД ответила за 40 мс — база НЕ виновата.', { lines: [2], phase: 'runtime' })
  .microToStack('Продолжение хендлера /report возобновляется.', { lines: [4], phase: 'microtask' })
  .push({ id: 'calc', label: 'calculateReport(data)', kind: 'sync', note: 'CPU 100%' },
    'А вот здесь начинается СИНХРОННЫЙ расчёт на 6.4 секунды.', { lines: [4] })
  .snap('Call Stack занят. Event Loop не может взять ни одного запроса: /profile и /health просто ждут.',
    { lines: [4], phase: 'sync' })
  .snap('Именно это видно в метриках: CPU 100%, p95 растёт, при этом БД и сеть здоровы.',
    { lines: [4], phase: 'sync' })
  .pop('calculateReport() наконец завершилась.', { lines: [4] })
  .log('GET /report 200 — 6452 ms', 'Ответ отправлен.', { lines: [6] })
  .pop('Хендлер завершён.', { phase: 'idle' })
  .taskToStack('Event Loop разгребает очередь.', { phase: 'task' })
  .log('GET /profile 200 — 6390 ms', 'Лёгкий запрос простоял 6 секунд — не по своей вине.', { phase: 'task' })
  .pop('Вот откуда берётся p95 = 7.8 s при «здоровой» базе.', { phase: 'idle' })

export const boss: Level = {
  id: 'boss',
  badge: 'Final Boss',
  title: 'Production Is Down',
  topic: 'Диагностика реального инцидента',
  goal: 'Найти причину деградации backend, опираясь на модель выполнения JavaScript.',
  code,
  expectedOutput: ['GET /users 200 — 12 ms', 'GET /report 200 — 6452 ms', 'GET /profile 200 — 6390 ms'],
  steps: timeline.steps(),
  boss: true,
  challenges: [
    {
      id: 'boss-investigation',
      kind: 'sandbox',
      sandbox: 'incident',
      prompt: 'Проверь компоненты системы, прежде чем делать выводы.',
    },
    {
      id: 'boss-root-cause',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Метрики собраны. Что является root cause инцидента?',
      options: [
        {
          id: 'cpu-block',
          label: 'CPU-bound синхронная операция блокирует Event Loop',
          detail: 'calculateReport() держит единственный поток и не даёт обрабатывать другие запросы',
        },
        {
          id: 'db',
          label: 'Медленная база данных',
          why: 'db.getData() отвечает за ~40 мс, а метрики базы зелёные. Ожидание БД асинхронное и поток не занимает.',
        },
        {
          id: 'network',
          label: 'Проблемы с сетью',
          why: 'Сеть в порядке: страдают только запросы, попавшие в очередь за тяжёлым расчётом.',
        },
        {
          id: 'memory',
          label: 'Утечка памяти',
          why: 'RAM 43% и стабильна. Утечка дала бы рост памяти и GC-паузы, а не ровные 100% CPU.',
        },
      ],
      answer: 'cpu-block',
      explanation:
        'Зелёные БД/сеть/память при 100% CPU и растущем p95 — классическая подпись заблокированного Event Loop. Один синхронный расчёт останавливает обслуживание ВСЕХ запросов процесса.',
    },
    {
      id: 'boss-fix',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Какое архитектурное решение чинит инцидент?',
      options: [
        {
          id: 'worker',
          label: 'Вынести calculateReport в worker_threads / отдельный сервис-обработчик',
          detail: 'главный поток снова только принимает запросы и делает I/O',
        },
        {
          id: 'async-fn',
          label: 'Объявить calculateReport как async и вызывать с await',
          why: 'Тело функции всё равно выполнится в главном потоке и займёт его на те же 6.4 секунды.',
        },
        {
          id: 'scale',
          label: 'Поднять больше инстансов сервиса',
          why: 'Это размажет боль, но каждый инстанс продолжит вставать колом на своём тяжёлом запросе — и стоить денег.',
        },
        {
          id: 'timeout',
          label: 'Увеличить таймауты балансировщика',
          why: 'Пользователи будут ждать дольше, а не быстрее. Симптом спрятан, причина осталась.',
        },
      ],
      answer: 'worker',
      explanation:
        'CPU-bound работу убираем из главного потока: worker_threads, отдельный воркер-сервис или очередь фоновых задач. Дополнительно помогает нарезка расчёта на куски с возвратом управления Event Loop.',
    },
  ],
  hints: [
    'Сравни метрики: что красное, а что зелёное?',
    'Асинхронное ожидание I/O не занимает поток. Вычисления — занимают.',
    'CPU 100% + здоровая БД + растущий p95 = заблокированный Event Loop. Ищи синхронный расчёт в хендлере.',
  ],
  keyIdea: 'Один синхронный CPU-bound вызов в Node.js останавливает обслуживание всех запросов процесса.',
  debrief: [
    'Event Loop — не абстракция из собеседований: это то, чем сервер обслуживает запросы. Заблокировали его — встал весь процесс, каким бы быстрым ни был код вокруг.',
    'Диагностика по модели выполнения: асинхронное ожидание (БД, сеть) поток не занимает, поэтому при здоровых зависимостях и 100% CPU виноват синхронный код в главном потоке.',
  ],
  parTimeSec: 300,
}
