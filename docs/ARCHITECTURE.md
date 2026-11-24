# Архитектура платформы

## Общая схема взаимодействия

```
┌────────────┐    HTTP     ┌───────────┐    HTTP     ┌────────┐
│  Frontend  │ ◄────────► │  FastAPI   │ ◄────────► │ Piston │
│  (React)   │            │  Backend   │            │(Docker)│
│ :5173      │            │  :8000     │            │ :2000  │
└────────────┘            └─────┬──────┘            └────────┘
                                │ HTTP
                                ▼
                          ┌───────────┐
                          │ DeepSeek  │
                          │   API     │
                          └───────────┘
```

## Срез 1 — Контракты API

### `GET /api/problems/{id}`

Возвращает условие задачи, шаблон кода и видимые примеры тестов.

**Response 200:**
```json
{
  "id": 1,
  "title": "Сумма чётных чисел в массиве",
  "description": "Дан массив целых чисел. Найдите сумму всех чётных чисел в массиве.",
  "grade": "9 класс",
  "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // ваш код здесь\n    return 0;\n}",
  "examples": [
    {
      "input": "5\n1 2 3 4 5",
      "expectedOutput": "6"
    }
  ]
}
```

### `POST /api/submit`

Принимает код и ID задачи, компилирует и прогоняет по всем тестам.

**Request:**
```json
{
  "problemId": 1,
  "code": "..."
}
```

**Response 200 (compile_error):**
```json
{
  "status": "compile_error",
  "compileOutput": "main.cpp:5:1: error: ...",
  "tests": []
}
```

**Response 200 (accepted / wrong_answer / runtime_error):**
```json
{
  "status": "accepted",
  "compileOutput": "",
  "tests": [
    {
      "passed": true,
      "input": "5\n1 2 3 4 5",
      "expected": "6",
      "actual": "6",
      "stderr": ""
    },
    {
      "passed": false,
      "input": "3\n1 3 5",
      "expected": "0",
      "actual": "9",
      "stderr": ""
    }
  ]
}
```

Поля ответа — camelCase (Pydantic `alias_generator=to_camel`).

Общий `status` определяется так:
- Все тесты пройдены → `accepted`
- Любой тест с непустым `stderr` и пустым `actual` → `runtime_error`
- Иначе → `wrong_answer`

### Piston API (внутренний)

**POST http://piston:2000/api/v2/execute**
```json
{
  "language": "c++",
  "version": "*",
  "files": [{ "name": "main.cpp", "content": "..." }],
  "stdin": "..."
}
```

## Срез 2 — DeepSeek интеграция

### `POST /api/hint`

Получает ИИ-подсказку для кода ученика (Сократовский метод, 3 уровня).

**Request:**
```json
{
  "problemId": 1,
  "code": "#include <iostream>\n...",
  "level": 1,
  "status": "wrong_answer",
  "compileStderr": null,
  "failedTest": {
    "input": "3\n1 3 5",
    "expected": "0",
    "actual": "6",
    "stderr": ""
  }
}
```

**Response 200:**
```json
{
  "lineStart": 8,
  "lineEnd": 9,
  "errorType": "logic",
  "hintText": "Посмотри на условие в строке 8: проверяешь ли ты чётность числа перед сложением?",
  "level": 1,
  "canEscalate": true
}
```

Поля ответа — camelCase. Поле `errorType` принимает значения:
`syntax`, `logic`, `edge_case`, `runtime`.

**Нумерация строк:** перед отправкой кода в DeepSeek бэкенд добавляет
нумерацию в формате:
```
 1 | #include <iostream>
 2 | using namespace std;
 3 | ...
```

**3 уровня подсказок (Сократовский метод):**
1. Укажи проблемные строки и задай короткий наводящий вопрос.
   Готовый код и прямое исправление ЗАПРЕЩЕНЫ.
2. Объясни суть конкретной ошибки простыми словами на русском.
   Готовое решение задачи ЗАПРЕЩЕНО.
3. Объясни нужную концепцию C++ на коротком отвлечённом мини-примере
   (не из этой задачи), чтобы ученик сам перенёс идею.

**Валидация ответа DeepSeek:** Pydantic-схема проверяет формат JSON,
`lineStart` и `lineEnd` приводятся к границам реального кода.

**Кэширование:** in-memory по ключу `(problem_id, sha256(code), level, status)`.

**Защита:** если `DEEPSEEK_API_KEY` не задан, возвращается 503 с понятным
сообщением на русском.

## Срез 3 — База данных и иерархия курсов (Срез 3А — Бэкенд)

Стек БД: SQLite + SQLAlchemy 2.0 (asyncio) + aiosqlite, миграции — Alembic.
Подключение: `DATABASE_URL=sqlite+aiosqlite:///./school_leetcode.db`.

### Схема таблиц базы данных

```
┌─────────────────────────────────┐
│             tracks              │
├─────────────────────────────────┤
│ id: Integer (PK)                │
│ title: String(200)              │
│ category: String(20)            │  ("school" | "university")
│ order_index: Integer            │
└───────────────┬─────────────────┘
                │ 1
                │
                │ *
┌───────────────▼─────────────────┐
│             topics              │
├─────────────────────────────────┤
│ id: Integer (PK)                │
│ track_id: Integer (FK -> tracks)│
│ title: String(200)              │
│ theory_markdown: Text           │
│ order_index: Integer            │
└───────────────┬─────────────────┘
                │ 1
                │
                │ *
┌───────────────▼─────────────────┐
│            problems             │
├─────────────────────────────────┤
│ id: Integer (PK)                │
│ topic_id: Integer (FK -> topics)│
│ title: String(200)              │
│ difficulty: String(10)          │  ("easy" | "medium" | "hard")
│ description: Text               │
│ starter_code: Text              │
│ order_index: Integer            │
└────────┬────────────────┬───────┘
         │ 1              │ 1
         │                │
         │ *              │ *
┌────────▼──────────────┐ ┌────────▼───────────────────────────────┐
│      test_cases       │ │                  submissions           │
├───────────────────────┤ ├────────────────────────────────────────┤
│ id: Integer (PK)      │ │ id: Integer (PK)                       │
│ problem_id: Integer   │ │ problem_id: Integer (FK -> problems)   │
│ input_data: Text      │ │ student_key: String(100) (indexed)     │
│ expected_output: Text │ │ code: Text                             │
│ is_hidden: Boolean    │ │ status: String(20)                     │
│ order_index: Integer  │ │ passed_count: Integer                  │
└───────────────────────┘ │ total_count: Integer                   │
                          │ created_at: DateTime                   │
                          └────────────────────────────────────────┘
```

---

### Контракты API (camelCase)

#### 1. `GET /api/tracks`

Возвращает дерево: Треки → Темы → Задачи.

**Заголовки запроса:**
- `X-Student-Key` (опционально, строка) — идентификатор ученика (UUID или ключ сессии). Если передан, статус каждой задачи рассчитывается индивидуально:
  * `"solved"` — есть хотя бы одно успешное решение (`status="accepted"`);
  * `"attempted"` — были попытки сдать задачу, но ни одна не прошла все тесты;
  * `"not_started"` — решение ещё не отправлялось (или заголовок не указан).

**Response 200:**
```json
[
  {
    "id": 1,
    "title": "9 класс: Массивы и циклы",
    "category": "school",
    "orderIndex": 1,
    "topics": [
      {
        "id": 1,
        "title": "Одномерные массивы",
        "theoryMarkdown": "## Одномерные массивы в C++\n\nМассив — это структура данных...",
        "orderIndex": 1,
        "problems": [
          {
            "id": 1,
            "title": "Сумма чётных чисел в массиве",
            "difficulty": "easy",
            "orderIndex": 1,
            "status": "solved"
          },
          {
            "id": 2,
            "title": "Количество отрицательных элементов",
            "difficulty": "easy",
            "orderIndex": 2,
            "status": "not_started"
          }
        ]
      }
    ]
  }
]
```

#### 2. `GET /api/problems/{problem_id}`

Возвращает условие задачи, теорию соответствующей темы и **только видимые примеры тестов** (`is_hidden=false`).

**Response 200:**
```json
{
  "id": 1,
  "title": "Сумма чётных чисел в массиве",
  "difficulty": "easy",
  "description": "Дан массив целых чисел...",
  "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n",
  "theoryMarkdown": "## Одномерные массивы в C++...",
  "trackTitle": "9 класс: Массивы и циклы",
  "grade": "9 класс: Массивы и циклы",
  "examples": [
    {
      "input": "5\n1 2 3 4 5",
      "expectedOutput": "6"
    },
    {
      "input": "3\n2 4 6",
      "expectedOutput": "12"
    }
  ]
}
```

#### 3. `POST /api/submit`

Принимает решение ученика, компилирует его через Piston, прогоняет по **всем** тестам из БД (видимым и скрытым) и сохраняет попытку в таблицу `submissions`.

**Заголовки запроса:**
- `X-Student-Key` (опционально, строка, по умолчанию `"anonymous"`).

**Request:**
```json
{
  "problemId": 1,
  "code": "#include <iostream>\n..."
}
```

**Правило скрытых тестов:**
Для скрытых тестов (`isHidden: true`) поля `input`, `expected` и `actual` в ответе фронтенду маскируются значением `null`. Фронтенд выводит пользователю только статус выполнения (например, «Скрытый тест #3 не пройден»).

**Response 200 (wrong_answer / accepted):**
```json
{
  "status": "wrong_answer",
  "compileOutput": "",
  "passedCount": 2,
  "totalCount": 5,
  "tests": [
    {
      "passed": true,
      "isHidden": false,
      "input": "5\n1 2 3 4 5",
      "expected": "6",
      "actual": "6",
      "stderr": ""
    },
    {
      "passed": true,
      "isHidden": false,
      "input": "3\n2 4 6",
      "expected": "12",
      "actual": "12",
      "stderr": ""
    },
    {
      "passed": false,
      "isHidden": true,
      "input": null,
      "expected": null,
      "actual": null,
      "stderr": ""
    },
    {
      "passed": false,
      "isHidden": true,
      "input": null,
      "expected": null,
      "actual": null,
      "stderr": ""
    },
    {
      "passed": false,
      "isHidden": true,
      "input": null,
      "expected": null,
      "actual": null,
      "stderr": ""
    }
  ]
}
```

#### 4. `POST /api/hint`

Запрашивает подсказку ИИ-наставника. Если упал скрытый тест, в запрос передаются реальные данные с признаком `isHidden: true`. ИИ использует эти данные для точного анализа ошибки, но системный промпт строго запрещает называть ученику конкретные входные/выходные числа скрытого теста.

**Request:**
```json
{
  "problemId": 1,
  "code": "#include <iostream>\n...",
  "level": 1,
  "status": "wrong_answer",
  "compileStderr": null,
  "failedTest": {
    "input": "4\n-2 7 10 -4",
    "expected": "4",
    "actual": "10",
    "stderr": "",
    "isHidden": true
  }
}
```

**Response 200:**
```json
{
  "lineStart": 9,
  "lineEnd": 10,
  "errorType": "edge_case",
  "hintText": "Обрати внимание, как твоё условие проверки чётности ведёт себя с отрицательными числами. В C++ остаток от деления отрицательного числа может быть отрицательным!",
  "level": 1,
  "canEscalate": true
}
```

## Срез 4 — Кабинет преподавателя, учебные группы и ИИ-аналитика

### 1. Расширение схемы базы данных

```
┌──────────────────┐       1:N       ┌──────────────────┐
│   StudyGroup     │ ─────────────── │   GroupMember    │
│ ──────────────── │                 │ ──────────────── │
│ id (PK)          │                 │ id (PK)          │
│ name             │                 │ group_id (FK)    │
│ invite_code (UQ) │                 │ student_key      │
│ created_at       │                 │ student_name     │
└────────┬─────────┘                 │ joined_at        │
         │                           └──────────────────┘
         │ 1:N
         ▼
┌──────────────────┐       1:N       ┌──────────────────────┐
│   Assignment     │ ─────────────── │  AssignmentProblem   │
│ ──────────────── │                 │ ──────────────────── │
│ id (PK)          │                 │ id (PK)              │
│ group_id (FK)    │                 │ assignment_id (FK)   │
│ title            │                 │ problem_id (FK)      │
│ created_at       │                 │ order_index          │
└──────────────────┘                 └──────────────────────┘
```

#### Таблица `study_groups` (учебные группы)
- `id` (INTEGER, PK)
- `name` (VARCHAR(128)) — название («9А — Демо-группа»)
- `invite_code` (VARCHAR(16), UNIQUE) — 6-символьный код приглашения (например, `DEMO9A`, алфавит без неоднозначных символов 0/O/1/I)
- `created_at` (DATETIME)

#### Таблица `group_members` (ученики группы)
- `id` (INTEGER, PK)
- `group_id` (INTEGER, FK -> `study_groups.id`)
- `student_key` (VARCHAR(64)) — анонимный UUID ученика из `X-Student-Key`
- `student_name` (VARCHAR(128)) — отображаемое ФИО («Алексей Иванов»)
- `joined_at` (DATETIME)
- *Ограничение уникальности:* `(group_id, student_key)`

#### Таблица `assignments` (домашние задания / контрольные работы)
- `id` (INTEGER, PK)
- `group_id` (INTEGER, FK -> `study_groups.id`)
- `title` (VARCHAR(128)) — название («Домашняя работа №1: Массивы»)
- `created_at` (DATETIME)

#### Таблица `assignment_problems` (связка заданий с задачами)
- `id` (INTEGER, PK)
- `assignment_id` (INTEGER, FK -> `assignments.id`)
- `problem_id` (INTEGER, FK -> `problems.id`)
- `order_index` (INTEGER)
- *Ограничение уникальности:* `(assignment_id, problem_id)`

#### Изменение в таблице `submissions`
- Добавлена колонка `error_message` (TEXT, nullable) — краткое описание ошибки или stderr упавшей попытки для быстрой ИИ-агрегации без разбора всего лога.

---

### 2. Авторизация преподавателя

- Используется упрощённая схема авторизации через заголовок `X-Teacher-Key`.
- Ключ задаётся в `.env` (`TEACHER_ACCESS_KEY="teacher123"`).
- Все эндпоинты `/api/teacher/*` защищены FastAPI dependency `verify_teacher`. При отсутствии или несовпадении ключа возвращается `401 Unauthorized` с детальным сообщением.

---

### 3. Контракты API: Ученик и группы (`/api/groups`)

#### `POST /api/groups/join`
Присоединяет ученика к группе по коду приглашения. Идемпотентно: если ученик уже состоит в группе, обновляется его `student_name`.

**Заголовки:**
- `X-Student-Key` (обязателен, UUID ученика).

**Request:**
```json
{
  "inviteCode": "DEMO9A",
  "studentName": "Иван Смирнов"
}
```

**Response 200:**
```json
{
  "groupId": 1,
  "groupName": "9А — Демо-группа",
  "inviteCode": "DEMO9A",
  "studentName": "Иван Смирнов"
}
```

#### `GET /api/groups/my`
Возвращает список всех групп, в которых состоит ученик, со всеми выданными заданиями и персональным статусом выполнения каждой задачи (`solved`, `attempted`, `not_started`).

**Заголовки:**
- `X-Student-Key` (обязателен).

**Response 200:**
```json
[
  {
    "groupId": 1,
    "groupName": "9А — Демо-группа",
    "inviteCode": "DEMO9A",
    "studentName": "Иван Смирнов",
    "assignments": [
      {
        "id": 1,
        "title": "Домашняя работа №1: Массивы",
        "problems": [
          {
            "id": 1,
            "title": "Сумма чётных чисел в массиве",
            "difficulty": "easy",
            "status": "solved"
          },
          {
            "id": 2,
            "title": "Количество отрицательных элементов",
            "difficulty": "easy",
            "status": "attempted"
          },
          {
            "id": 3,
            "title": "Максимум последовательности",
            "difficulty": "easy",
            "status": "not_started"
          }
        ]
      }
    ]
  }
]
```

---

### 4. Контракты API: Кабинет преподавателя (`/api/teacher`)

Все эндпоинты требуют заголовок `X-Teacher-Key`.

#### `POST /api/teacher/verify`
Проверяет валидность ключа преподавателя.

**Response 200:**
```json
{
  "ok": true
}
```

#### `GET /api/teacher/groups`
Возвращает список созданных учебных групп со счётчиками учеников и выданных заданий.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "9А — Демо-группа",
    "inviteCode": "DEMO9A",
    "studentCount": 3,
    "assignmentCount": 1,
    "createdAt": "2026-11-24T12:00:00"
  }
]
```

#### `POST /api/teacher/groups`
Создаёт новую учебную группу и генерирует уникальный 6-символьный инвайт-код.

**Request:**
```json
{
  "name": "10-Б Информатика"
}
```

**Response 201:**
```json
{
  "id": 2,
  "name": "10-Б Информатика",
  "inviteCode": "LS66XR",
  "studentCount": 0,
  "assignmentCount": 0,
  "createdAt": "2026-11-24T16:55:00"
}
```

#### `GET /api/teacher/groups/{groupId}`
Возвращает подробную информацию о группе, список заданий, список уникальных задач и матрицу успеваемости всех учеников группы.

**Response 200:**
```json
{
  "group": {
    "id": 1,
    "name": "9А — Демо-группа",
    "inviteCode": "DEMO9A"
  },
  "assignments": [
    {
      "id": 1,
      "title": "Домашняя работа №1: Массивы",
      "problems": [
        {
          "id": 1,
          "title": "Сумма чётных чисел в массиве",
          "difficulty": "easy"
        }
      ]
    }
  ],
  "problems": [
    {
      "id": 1,
      "title": "Сумма чётных чисел в массиве",
      "difficulty": "easy"
    }
  ],
  "students": [
    {
      "studentKey": "demo-student-1",
      "studentName": "Алексей Иванов",
      "solvedCount": 1,
      "totalAttempts": 2,
      "progress": [
        {
          "problemId": 1,
          "status": "solved",
          "attempts": 2,
          "lastStatus": "accepted"
        }
      ]
    }
  ]
}
```

#### `POST /api/teacher/groups/{groupId}/assignments`
Создаёт новое задание (ДЗ) в группе с упорядоченным списком задач из каталога.

**Request:**
```json
{
  "title": "Домашняя работа №2: Поиск в массиве",
  "problemIds": [1, 2, 4]
}
```

**Response 201:**
```json
{
  "id": 2,
  "title": "Домашняя работа №2: Поиск в массиве",
  "problems": [
    {
      "id": 1,
      "title": "Сумма чётных чисел в массиве",
      "difficulty": "easy"
    },
    {
      "id": 2,
      "title": "Количество отрицательных элементов",
      "difficulty": "easy"
    },
    {
      "id": 4,
      "title": "Линейный поиск",
      "difficulty": "easy"
    }
  ]
}
```

#### `POST /api/teacher/groups/{groupId}/ai-summary`
Генерирует сводку типичных ошибок учеников группы с помощью DeepSeek (`deepseek-chat`).

**Правило приватности:** реальные имена учеников НИКОГДА не передаются в LLM. В запросе ученики анонимизируются как `Ученик #1`, `Ученик #2`.
**Кэширование:** результат кэшируется в памяти по ключу `(group_id, problem_id, max_submission_id)`. Пока ученики не отправят новые решения, повторные запросы отдаются мгновенно без повторного расхода токенов.

**Request:**
```json
{
  "problemId": 1
}
```
*(поле `problemId` опционально; если не передано — анализируются ошибки по всем задачам группы).*

**Response 200:**
```json
{
  "overallSummary": "Группа в целом понимает базовый синтаксис циклов, но допускает ошибки в инициализации аккумулятора...",
  "analyzedSubmissionsCount": 2,
  "analyzedStudentsCount": 2,
  "commonMistakes": [
    {
      "title": "Неинициализированная переменная суммы",
      "description": "Переменная sum объявлена без начального значения 0, из-за чего накапливается мусор из памяти.",
      "affectedStudentsCount": 1,
      "recommendation": "На уроке напомнить, что в C++ автоматические переменные не обнуляются по умолчанию."
    }
  ]
}
```

