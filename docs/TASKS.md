# Трекер задач — Вертикальные срезы

## Срез 1: Скелет проверки C++ ✅

> Monaco Editor + FastAPI + Piston, 1 захардкоженная задача

- [x] Создать `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/TASKS.md`
- [x] Создать `docker-compose.yml` с сервисом Piston
- [x] Создать `scripts/setup_piston.py` (установка gcc в Piston)
- [x] Backend: структура `app/main.py`, `app/routers/`, `app/schemas/`
- [x] Backend: захардкоженная задача «Сумма чётных чисел» (9 класс)
- [x] Backend: `GET /api/problems/{id}` — условие + шаблон + примеры
- [x] Backend: `POST /api/submit` — компиляция и прогон тестов через Piston
- [x] Backend: CORS для локального фронтенда
- [x] Frontend: инициализация React + Vite + TypeScript + Tailwind
- [x] Frontend: двухколоночный интерфейс (условие | редактор)
- [x] Frontend: Monaco Editor с подсветкой C++
- [x] Frontend: кнопка «Проверить решение» + отображение результатов
- [x] Frontend: вывод ошибки компиляции или списка тестов (зелёный/красный)

## Срез 2: Интеграция DeepSeek API ✅

> Нумерация строк, 3 уровня подсказок, подсветка строк в Monaco Editor

- [x] Настроить DeepSeek API ключ в `.env` и `app/core/config.py`
- [x] Backend: сервис `ai_hint_service.py` — нумерация строк и запрос к DeepSeek
- [x] Backend: Pydantic-схемы `HintRequest` / `HintResponse` (camelCase)
- [x] Backend: эндпоинт `POST /api/hint` (3 уровня, Сократовский метод)
- [x] Backend: in-memory кэш и защита (503 при отсутствии ключа)
- [x] Frontend: автозапрос подсказки уровня 1 при неуспешном submit
- [x] Frontend: карточка «ИИ-наставник» с бейджем ошибки и ссылкой на строки
- [x] Frontend: кнопки «Подсказать точнее» / «Разобрать концепцию» (уровни 2–3)
- [x] Frontend: подсветка строк в Monaco Editor (decorations API)
- [x] Frontend: сброс подсветки при редактировании кода
- [x] Обновить `docs/ARCHITECTURE.md`

## Срез 3А: База данных и иерархия курсов (Бэкенд) ✅

> SQLite (async SQLAlchemy 2.0 + Alembic), иерархия «Трек -> Тема -> Задачи», скрытые тесты и сохранение прогресса

- [x] Добавить зависимости `sqlalchemy[asyncio]`, `aiosqlite`, `alembic` в `requirements.txt`
- [x] Настроить `DATABASE_URL` в `config.py` и `.env.example`, добавить `*.db` в `.gitignore`
- [x] Создать `app/core/database.py` (async engine, sessionmaker, Base, get_db)
- [x] Создать модели: `Track`, `Topic`, `Problem`, `TestCase`, `Submission`
- [x] Настроить Alembic (async SQLite) и создать начальную миграцию
- [x] Настроить `lifespan` в `app/main.py` с автомиграцией и идемпотентным сид-скриптом
- [x] Наполнить базу начальным контентом (Школа: 9 класс — 2 темы, 4 задачи; ВУЗ: 1 курс — 1 тема, 2 задачи; теория + по 5 тестов на задачу)
- [x] Реализовать `GET /api/tracks` с заголовком `X-Student-Key` и расчётом статусов (`solved` / `attempted` / `not_started`)
- [x] Реализовать `GET /api/problems/{id}` с теорией темы и только видимыми тестами
- [x] Реализовать `POST /api/submit` с прогоном всех тестов, сохранением в `submissions` и маскированием скрытых тестов
- [x] Обновить `POST /api/hint` с правилом скрытых тестов (запрет раскрытия чисел скрытого теста)
- [x] Подробно обновить `docs/ARCHITECTURE.md` (схема БД и точные JSON-контракты)

## Срез 3Б: Каталог задач и теория (Фронтенд) ✅

> Выбор задач по трекам/темам, статус решения задач и вкладка теории

- [x] Хранение `studentKey` в `localStorage` и передача в заголовке `X-Student-Key`
- [x] Страница каталога (навигация «Класс/Курс → Тема → Задачи» с бейджами статусов)
- [x] Вкладка теории темы в левой панели задачи с форматированием C++ кода
- [x] Отображение прогресса решения по темам и трекам (счётчик `solved / total`)
- [x] Адаптация отображения скрытых тестов в `ResultsPanel` («🔒 Скрытый тест #N»)
- [x] Сброс состояния редактора и результатов при переключении задач

## Срез 4: Кабинет преподавателя

> Учебные группы и сводка ошибок

- [ ] Модели: `Teacher`, `Group`, `GroupMembership`
- [ ] Backend: авторизация (роли: ученик, преподаватель)
- [ ] Backend: CRUD для групп
- [ ] Backend: эндпоинт сводки ошибок по группе
- [ ] Frontend: страница входа / регистрации
- [ ] Frontend: кабинет преподавателя (группы, сводка, прогресс учеников)
