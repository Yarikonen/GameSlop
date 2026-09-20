import { Timeline } from '../engine/builder'
import type { Level } from '../engine/types'

const code = `button.addEventListener("click", () => {
    const report = heavyCalculation(data);  // ~2 сек чистого CPU
    render(report);
});

setInterval(() => moveRobot(), 16);`

const timeline = new Timeline()
  .push({ id: 'handler', label: 'onClick handler', kind: 'frame' },
    'Пользователь нажал кнопку — колбэк попал в Call Stack.', { lines: [1] })
  .push({ id: 'heavy', label: 'heavyCalculation()', kind: 'sync', note: 'CPU 100%' },
    'Началась тяжёлая СИНХРОННАЯ функция. Она не отдаёт управление.', { lines: [2] })
  .enqueueTask({ id: 'timer-tick', label: 'interval → moveRobot', kind: 'timer' },
    'Таймер анимации истёк, колбэк встал в очередь. Но стек занят — он ждёт.', { lines: [6], phase: 'task' })
  .enqueueTask({ id: 'click-2', label: 'click → другая кнопка', kind: 'timer', note: 'ждёт' },
    'Пользователь кликает ещё раз — событие тоже встаёт в очередь. Интерфейс «не реагирует».', { phase: 'task' })
  .enqueueTask({ id: 'render', label: 'render frame', kind: 'timer', note: 'ждёт' },
    'Браузер не может даже перерисовать кадр: перерисовка тоже требует свободного Event Loop.', { phase: 'task' })
  .snap('Так проходит 2 секунды. Страница заморожена целиком: ни анимации, ни кликов, ни скролла.',
    { lines: [2], phase: 'sync' })
  .pop('heavyCalculation() наконец вернулась.', { lines: [2] })
  .log('report ready', 'render(report) отрисовывает результат.', { lines: [3] })
  .pop('Обработчик клика завершён, Call Stack пуст.', { lines: [4], phase: 'idle' })
  .taskToStack('Только теперь Event Loop начинает разгребать накопившуюся очередь.', { phase: 'task' })
  .pop('Анимация дёргается: пропущенные кадры уже не вернуть.', { phase: 'task' })
  .taskToStack('Второй клик обрабатывается с задержкой в 2 секунды.', { phase: 'task' })
  .pop('Пользователь давно решил, что сайт сломался.', { phase: 'idle' })

export const level7: Level = {
  id: 'level7',
  badge: 'Level 7',
  title: 'Freeze The Browser',
  topic: 'CPU-bound операции',
  goal: 'Почувствовать на себе, что блокирующий код делает с интерфейсом — и чем это лечится.',
  code,
  expectedOutput: ['report ready'],
  steps: timeline.steps(),
  challenges: [
    {
      id: 'level7-lab',
      kind: 'sandbox',
      sandbox: 'freeze-lab',
      prompt: 'Это не симуляция: кнопки запускают настоящие вычисления в этой вкладке.',
    },
    {
      id: 'level7-fix',
      kind: 'choice',
      prompt: 'Как убрать заморозку интерфейса при тяжёлом расчёте?',
      options: [
        { id: 'worker', label: 'C. Вынести расчёт в Web Worker', detail: 'отдельный поток — Event Loop остаётся свободным' },
        { id: 'async', label: 'A. Сделать функцию async', why: 'async меняет только то, КАК функция возвращает результат. Тело всё равно выполняется в том же потоке и так же его занимает.' },
        { id: 'promise', label: 'B. Обернуть вычисление в Promise', why: 'Промис не переносит код в другой поток: колбэк выполнится всё в том же Call Stack.' },
        { id: 'await', label: 'D. Добавить await перед вызовом', why: 'await ждёт результат, но сам расчёт по-прежнему идёт в главном потоке.' },
      ],
      answer: 'worker',
      explanation:
        'CPU-bound задачу нужно убрать из главного потока: Web Worker (в браузере) или worker_threads / отдельный сервис (в Node.js). Альтернатива — нарезать работу на куски и отдавать управление Event Loop между ними.',
    },
    {
      id: 'level7-why',
      kind: 'choice',
      weight: 'explanation',
      prompt: 'Почему async/await и промисы НЕ спасают от CPU-bound кода?',
      options: [
        {
          id: 'same-thread',
          label: 'Они лишь переносят код в очередь того же единственного потока — сам расчёт всё равно занимает Call Stack',
          detail: 'асинхронность ≠ параллельность',
        },
        {
          id: 'slow',
          label: 'Они работают медленнее обычных функций',
          why: 'Дело не в накладных расходах, а в том, что поток остаётся один.',
        },
        {
          id: 'gc',
          label: 'Мешает сборщик мусора',
          why: 'GC тут ни при чём.',
        },
        {
          id: 'micro',
          label: 'Промисы используют микрозадачи, а они запрещены в браузере',
          why: 'Микрозадачи никто не запрещает — они просто выполняются в том же потоке.',
        },
      ],
      answer: 'same-thread',
      explanation:
        'Асинхронность решает проблему ОЖИДАНИЯ (I/O), а не проблему ВЫЧИСЛЕНИЙ. Для вычислений нужен другой поток или нарезка задачи на части.',
    },
  ],
  hints: [
    'Спроси себя: сколько потоков выполняет твой JS?',
    'Перенос вызова в очередь не уменьшает время, которое он занимает Call Stack.',
    'Нужен настоящий второй поток: Web Worker (браузер) или worker_threads (Node.js).',
  ],
  keyIdea: 'async не превращает CPU-bound операцию в фоновую: поток JS по-прежнему один.',
  debrief: [
    'Пока синхронная функция считает, Call Stack занят. Значит, Event Loop не берёт ни задачи, ни микрозадачи: клики, таймеры и перерисовка ждут в очереди.',
    'Лечится это только уходом из главного потока (Worker) или нарезкой работы на куски, между которыми управление возвращается Event Loop.',
  ],
  parTimeSec: 260,
}
