# Event Loop Arena

Браузерная учебная игра про модель выполнения JavaScript: **Call Stack, Web APIs,
Microtask Queue, Task Queue и Event Loop**.

Студент не отвечает на вопросы про определения, а работает с визуальной моделью
выполнения программы: предсказывает Output, раскладывает операции по очередям, сам
исполняет алгоритм Event Loop, ломает интерфейс блокирующим кодом и чинит
production-инцидент. Прохождение занимает **30–40 минут**, backend не нужен.

## Запуск

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production-сборка в dist/
npm run preview # предпросмотр собранного бандла
npm run lint
```

Vite собирается с `base: './'`, поэтому `dist/` разворачивается как есть на
GitHub Pages, Vercel, Netlify или любом статическом хостинге — студентам
достаточно одной ссылки.

## Уровни

| Уровень    | Тема               | Механика                                                   |
| ---------- | ------------------ | ---------------------------------------------------------- |
| Tutorial   | Call Stack         | пошаговое выполнение + вопросы прямо во время симуляции     |
| Level 1    | Синхронный JS      | Drag&Drop прогноз Output                                    |
| Level 2    | setTimeout         | Web API → Task Queue                                        |
| Level 3    | Promise            | Microtask vs Task, раскладка операций по очередям           |
| Level 4    | Event Loop         | игрок сам выбирает следующую операцию (violations наказуемы)|
| Level 5    | async/await        | continuation после `await`                                  |
| Level 6    | fetch              | таймлайны последовательных await и `Promise.all`            |
| Level 7    | Blocking           | **настоящая** CPU-нагрузка в главном потоке и в Web Worker  |
| Level 8    | Starvation         | **настоящая** цепочка микрозадач против `setTimeout`        |
| Final Boss | Production incident| расследование метрик, root cause и архитектурное решение    |

Уровни 7, 8 и финальный босс используют не анимацию, а реальные измерения в
браузере: счётчики кадров, тиков таймера и задержки колбэков считаются по живому
коду, поэтому разница между главным потоком и Web Worker видна в цифрах.

## Режимы

* **Prediction** — до запуска студент собирает предполагаемый Output карточками;
  посмотреть ответ, не сделав прогноз, нельзя.
* **Step** — по одной операции, с описанием происходящего и подсветкой строки кода.
* **Run** — автопрогон сценария; карточки физически перелетают между Call Stack,
  Web APIs, очередями и Output (FLIP-анимация).

Очки начисляются за прогнозы, действия и объяснения, снимаются за ошибки,
подсказки и нарушения правил Event Loop. После потери всех жизней уровень не
блокируется — включается **Learning Mode** с бесплатными подсказками и разбором.
Прогресс хранится в `localStorage`.

## Архитектура

```
src/
├── engine/
│   ├── types.ts       # модель симуляции и заданий
│   ├── builder.ts     # Timeline — конструктор сценариев уровня
│   ├── simulator.ts   # воспроизведение сценария (STEP / RUN)
│   ├── validator.ts   # проверка прогнозов, раскладок и правил Event Loop
│   └── scoring.ts     # очки, жизни, ранги
├── levels/            # tutorial.ts, level1..level8.ts, boss.ts — только конфигурация
├── components/        # CallStack, Runtime, MicrotaskQueue, TaskQueue, Output,
│   │                  # CodePanel, Timeline, Score, задания и лаборатории
│   └── sandboxes/     # FetchRace, FreezeLab, StarvationLab, IncidentBoss
├── pages/             # Menu, Game, Results
├── state/gameStore.tsx
└── styles/
```

Полноценный интерпретатор JavaScript не требуется: каждый уровень — заранее
описанный сценарий из снимков состояния машины (`SimulationStep[]`), собираемый
через `Timeline`. Новый уровень добавляется одним файлом в `src/levels/`.

Стек: Vite + React + TypeScript + CSS-анимации, без внешних зависимостей
и без backend.
