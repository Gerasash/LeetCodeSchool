"""Идемпотентное заполнение БД начальным учебным контентом."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Assignment,
    AssignmentProblem,
    GroupMember,
    Problem,
    StudyGroup,
    Submission,
    TestCase,
    Topic,
    Track,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Теория для тем
# ---------------------------------------------------------------------------

THEORY_ARRAYS = """\
## Одномерные массивы в C++

Массив — это структура данных, которая хранит набор элементов одного типа.\
 В C++ массив объявляется так:

```cpp
int a[100]; // массив из 100 целых чисел
```

Для считывания массива из стандартного ввода обычно сначала читают его размер **N**,\
 а затем в цикле — элементы:

```cpp
int n;
cin >> n;
for (int i = 0; i < n; i++) {
    cin >> a[i];
}
```

После заполнения массива можно обходить его в цикле, накапливая результат\
 (сумму, количество, максимум и т. д.).\
"""

THEORY_SEQUENCES = """\
## Обработка последовательностей

Часто нужно обработать последовательность чисел «на лету» — не сохраняя все\
 элементы в массив, а считывая по одному. Это полезно, когда нужен только итоговый\
 результат (сумма, максимум, подсчёт и др.).

```cpp
int n, x, maxVal = -1e9;
cin >> n;
for (int i = 0; i < n; i++) {
    cin >> x;
    if (x > maxVal) maxVal = x;
}
cout << maxVal;
```

Ключевая идея — хранить **аккумулятор** (переменную-накопитель) и обновлять его\
 на каждом шаге цикла.\
"""

THEORY_COMPLEXITY = """\
## Сложность алгоритмов и поиск

**Сложность алгоритма** показывает, как растёт время работы при увеличении\
 размера входных данных. Запись O(N) означает линейный рост, O(N²) — квадратичный.

Линейный поиск — простейший алгоритм: проверяем каждый элемент по очереди:

```cpp
int pos = -1;
for (int i = 0; i < n; i++) {
    if (a[i] == target) { pos = i; break; }
}
```

Если массив **отсортирован**, можно искать быстрее — бинарным поиском за O(log N).\
 Идея: на каждом шаге отбрасываем половину массива, сравнивая средний элемент с искомым.\
"""

# ---------------------------------------------------------------------------
# Задачи
# ---------------------------------------------------------------------------

STARTER = (
    "#include <iostream>\n"
    "using namespace std;\n"
    "\n"
    "int main() {\n"
    "    // Ваш код здесь\n"
    "    \n"
    "    return 0;\n"
    "}\n"
)


def _seed_data() -> list[dict]:
    """Возвращает полное дерево контента для seed."""
    return [
        {
            "title": "9 класс: Массивы и циклы",
            "category": "school",
            "order_index": 1,
            "topics": [
                {
                    "title": "Одномерные массивы",
                    "theory_markdown": THEORY_ARRAYS,
                    "order_index": 1,
                    "problems": [
                        {
                            "title": "Сумма чётных чисел в массиве",
                            "difficulty": "easy",
                            "order_index": 1,
                            "description": (
                                "Дан массив из **N** целых чисел. Найдите сумму всех **чётных** чисел.\n\n"
                                "### Формат ввода\n"
                                "- Первая строка: число **N**.\n"
                                "- Вторая строка: **N** целых чисел через пробел.\n\n"
                                "### Формат вывода\n"
                                "- Одно число — сумма чётных элементов.\n\n"
                                "### Ограничения\n"
                                "- 1 ≤ N ≤ 1000\n"
                                "- −10⁶ ≤ aᵢ ≤ 10⁶"
                            ),
                            "tests": [
                                ("5\n1 2 3 4 5", "6", False),
                                ("3\n2 4 6", "12", False),
                                ("3\n1 3 5", "0", True),
                                ("1\n0", "0", True),
                                ("4\n-2 7 10 -4", "4", True),
                            ],
                        },
                        {
                            "title": "Количество отрицательных элементов",
                            "difficulty": "easy",
                            "order_index": 2,
                            "description": (
                                "Дан массив из **N** целых чисел. Подсчитайте, сколько из них **отрицательных**.\n\n"
                                "### Формат ввода\n"
                                "- Первая строка: число **N**.\n"
                                "- Вторая строка: **N** целых чисел через пробел.\n\n"
                                "### Формат вывода\n"
                                "- Одно число — количество отрицательных элементов.\n\n"
                                "### Ограничения\n"
                                "- 1 ≤ N ≤ 1000"
                            ),
                            "tests": [
                                ("5\n-1 2 -3 4 -5", "3", False),
                                ("3\n1 2 3", "0", False),
                                ("1\n0", "0", True),
                                ("4\n-1 -2 -3 -4", "4", True),
                                ("2\n-1000000 1000000", "1", True),
                            ],
                        },
                    ],
                },
                {
                    "title": "Обработка последовательностей",
                    "theory_markdown": THEORY_SEQUENCES,
                    "order_index": 2,
                    "problems": [
                        {
                            "title": "Максимум последовательности",
                            "difficulty": "easy",
                            "order_index": 1,
                            "description": (
                                "Дана последовательность из **N** целых чисел. Найдите **максимальный** элемент.\n\n"
                                "### Формат ввода\n"
                                "- Первая строка: число **N** (N ≥ 1).\n"
                                "- Вторая строка: **N** целых чисел через пробел.\n\n"
                                "### Формат вывода\n"
                                "- Одно число — максимальный элемент.\n\n"
                                "### Ограничения\n"
                                "- 1 ≤ N ≤ 10⁵\n"
                                "- −10⁹ ≤ aᵢ ≤ 10⁹"
                            ),
                            "tests": [
                                ("5\n3 1 4 1 5", "5", False),
                                ("1\n42", "42", False),
                                ("3\n-1 -2 -3", "-1", True),
                                ("4\n0 0 0 0", "0", True),
                                ("2\n1000000000 -1000000000", "1000000000", True),
                            ],
                        },
                        {
                            "title": "Среднее арифметическое",
                            "difficulty": "medium",
                            "order_index": 2,
                            "description": (
                                "Дана последовательность из **N** целых чисел.\n"
                                "Найдите **среднее арифметическое** всех элементов.\n"
                                "Ответ выведите с точностью 1 знак после запятой (формат `fixed`, `setprecision(1)`).\n\n"
                                "### Формат ввода\n"
                                "- Первая строка: число **N**.\n"
                                "- Вторая строка: **N** целых чисел через пробел.\n\n"
                                "### Формат вывода\n"
                                "- Одно дробное число с 1 знаком после запятой.\n\n"
                                "### Ограничения\n"
                                "- 1 ≤ N ≤ 10⁵"
                            ),
                            "tests": [
                                ("3\n1 2 3", "2.0", False),
                                ("4\n10 20 30 40", "25.0", False),
                                ("1\n7", "7.0", True),
                                ("2\n1 2", "1.5", True),
                                ("5\n-5 -3 0 3 5", "0.0", True),
                            ],
                        },
                    ],
                },
            ],
        },
        {
            "title": "1 курс: Введение в алгоритмы",
            "category": "university",
            "order_index": 2,
            "topics": [
                {
                    "title": "Сложность алгоритмов и поиск",
                    "theory_markdown": THEORY_COMPLEXITY,
                    "order_index": 1,
                    "problems": [
                        {
                            "title": "Линейный поиск элемента",
                            "difficulty": "easy",
                            "order_index": 1,
                            "description": (
                                "Дан массив из **N** целых чисел и число **X**.\n"
                                "Найдите **индекс первого вхождения** X в массив (нумерация с 0).\n"
                                "Если X не найден, выведите **-1**.\n\n"
                                "### Формат ввода\n"
                                "- Первая строка: числа **N** и **X**.\n"
                                "- Вторая строка: **N** целых чисел через пробел.\n\n"
                                "### Формат вывода\n"
                                "- Одно число — индекс или -1.\n\n"
                                "### Ограничения\n"
                                "- 1 ≤ N ≤ 10⁵"
                            ),
                            "tests": [
                                ("5 3\n1 2 3 4 5", "2", False),
                                ("3 7\n1 2 3", "-1", False),
                                ("1 1\n1", "0", True),
                                ("5 1\n1 1 1 1 1", "0", True),
                                ("4 4\n1 2 3 4", "3", True),
                            ],
                        },
                        {
                            "title": "Два максимума",
                            "difficulty": "medium",
                            "order_index": 2,
                            "description": (
                                "Дан массив из **N** целых чисел (N ≥ 2).\n"
                                "Найдите **два наибольших** различных по значению элемента и выведите их\n"
                                "в порядке убывания через пробел.\n"
                                "Гарантируется, что в массиве есть хотя бы два различных значения.\n\n"
                                "### Формат ввода\n"
                                "- Первая строка: число **N**.\n"
                                "- Вторая строка: **N** целых чисел через пробел.\n\n"
                                "### Формат вывода\n"
                                "- Два числа через пробел — наибольший и второй по величине.\n\n"
                                "### Ограничения\n"
                                "- 2 ≤ N ≤ 10⁵"
                            ),
                            "tests": [
                                ("5\n1 5 3 5 2", "5 3", False),
                                ("3\n10 20 30", "30 20", False),
                                ("2\n-1 -2", "-1 -2", True),
                                ("4\n7 7 3 3", "7 3", True),
                                ("5\n1000000000 999999999 1 2 3", "1000000000 999999999", True),
                            ],
                        },
                    ],
                },
            ],
        },
    ]


async def seed_database(session: AsyncSession) -> None:
    """Заполняет БД начальными данными (курсы и демо-группа), если они отсутствуют."""
    await seed_tracks_and_problems(session)
    await seed_study_groups(session)


async def seed_tracks_and_problems(session: AsyncSession) -> None:
    """Заполняет БД начальными данными, если таблица tracks пуста."""
    result = await session.execute(select(Track).limit(1))
    if result.scalars().first() is not None:
        logger.info("Seed: треки уже существуют, пропускаю.")
        return

    logger.info("Seed: заполняю базу начальным контентом...")

    for track_data in _seed_data():
        track = Track(
            title=track_data["title"],
            category=track_data["category"],
            order_index=track_data["order_index"],
        )
        session.add(track)
        await session.flush()  # получаем track.id

        for topic_data in track_data["topics"]:
            topic = Topic(
                track_id=track.id,
                title=topic_data["title"],
                theory_markdown=topic_data["theory_markdown"],
                order_index=topic_data["order_index"],
            )
            session.add(topic)
            await session.flush()

            for prob_data in topic_data["problems"]:
                problem = Problem(
                    topic_id=topic.id,
                    title=prob_data["title"],
                    difficulty=prob_data["difficulty"],
                    description=prob_data["description"],
                    starter_code=STARTER,
                    order_index=prob_data["order_index"],
                )
                session.add(problem)
                await session.flush()

                for idx, (inp, exp, hidden) in enumerate(prob_data["tests"]):
                    tc = TestCase(
                        problem_id=problem.id,
                        input_data=inp,
                        expected_output=exp,
                        is_hidden=hidden,
                        order_index=idx + 1,
                    )
                    session.add(tc)

    await session.commit()
    logger.info("Seed: треки готовы!")


async def seed_study_groups(session: AsyncSession) -> None:
    """Заполняет БД демо-группой и учениками, если таблица study_groups пуста."""
    result = await session.execute(select(StudyGroup).limit(1))
    if result.scalars().first() is not None:
        logger.info("Seed: группы уже существуют, пропускаю.")
        return

    logger.info("Seed: создаю демо-группу и учеников...")

    # 1. Группа
    group = StudyGroup(name="9А — Демо-группа", invite_code="DEMO9A")
    session.add(group)
    await session.flush()

    # 2. Домашняя работа с задачами 1, 2, 3
    assignment = Assignment(group_id=group.id, title="Домашняя работа №1: Массивы")
    session.add(assignment)
    await session.flush()

    for idx, pid in enumerate([1, 2, 3]):
        ap = AssignmentProblem(
            assignment_id=assignment.id,
            problem_id=pid,
            order_index=idx + 1,
        )
        session.add(ap)

    # 3. Ученики
    m1 = GroupMember(group_id=group.id, student_key="demo-student-1", student_name="Алексей Иванов")
    m2 = GroupMember(group_id=group.id, student_key="demo-student-2", student_name="Мария Смирнова")
    m3 = GroupMember(group_id=group.id, student_key="demo-student-3", student_name="Дмитрий Козлов")
    session.add_all([m1, m2, m3])
    await session.flush()

    # 4. Попытки решений (Submissions)
    # Студент 1 (Алексей Иванов): 1 accepted, 1 wrong_answer (i <= n)
    s1_1 = Submission(
        problem_id=1,
        student_key="demo-student-1",
        code=(
            "#include <iostream>\nusing namespace std;\nint main() {\n"
            "    int n;\n    if (!(cin >> n)) return 0;\n    long long sum = 0;\n"
            "    for (int i = 0; i < n; i++) {\n        long long x;\n        cin >> x;\n"
            "        if (x % 2 == 0) sum += x;\n    }\n    cout << sum;\n    return 0;\n}"
        ),
        status="accepted",
        passed_count=5,
        total_count=5,
        error_message=None,
    )
    s1_2 = Submission(
        problem_id=2,
        student_key="demo-student-1",
        code=(
            "#include <iostream>\nusing namespace std;\nint main() {\n"
            "    int n;\n    cin >> n;\n    int a[1005];\n    for (int i = 0; i <= n; i++) {\n"
            "        cin >> a[i];\n    }\n    int count = 0;\n    for (int i = 0; i <= n; i++) {\n"
            "        if (a[i] < 0) count++;\n    }\n    cout << count;\n    return 0;\n}"
        ),
        status="wrong_answer",
        passed_count=1,
        total_count=5,
        error_message="Тест #1: неверный ответ (выход за границы массива i <= n)",
    )

    # Студент 2 (Мария Смирнова): 1 wrong_answer (sum += a[i]), 1 compile_error
    s2_1 = Submission(
        problem_id=1,
        student_key="demo-student-2",
        code=(
            "#include <iostream>\nusing namespace std;\nint main() {\n"
            "    int n;\n    cin >> n;\n    long long sum = 0;\n    for (int i = 0; i < n; i++) {\n"
            "        long long x;\n        cin >> x;\n        sum += x;\n    }\n"
            "    cout << sum;\n    return 0;\n}"
        ),
        status="wrong_answer",
        passed_count=0,
        total_count=5,
        error_message="Тест #1: неверный ответ (ожидалось 6, получено 15)",
    )
    s2_2 = Submission(
        problem_id=2,
        student_key="demo-student-2",
        code="#include <iostream>\nusing namespace std;\nint main() {\n    int n\n    cin >> n;\n    return 0;\n}",
        status="compile_error",
        passed_count=0,
        total_count=5,
        error_message="main.cpp:5:5: error: expected initializer before 'cin'",
    )

    # Студент 3 (Дмитрий Козлов): 1 wrong_answer (int sum не инициализирована и <= n), 1 accepted
    s3_1 = Submission(
        problem_id=1,
        student_key="demo-student-3",
        code=(
            "#include <iostream>\nusing namespace std;\nint main() {\n"
            "    int n;\n    cin >> n;\n    int sum;\n    for (int i = 0; i <= n; i++) {\n"
            "        int x;\n        cin >> x;\n        if (x % 2 == 0) sum += x;\n    }\n"
            "    cout << sum;\n    return 0;\n}"
        ),
        status="wrong_answer",
        passed_count=0,
        total_count=5,
        error_message="Тест #1: неверный ответ (мусорное значение переменной sum)",
    )
    s3_2 = Submission(
        problem_id=2,
        student_key="demo-student-3",
        code=(
            "#include <iostream>\nusing namespace std;\nint main() {\n"
            "    int n;\n    if (!(cin >> n)) return 0;\n    int count = 0;\n"
            "    for (int i = 0; i < n; i++) {\n        int x;\n        cin >> x;\n"
            "        if (x < 0) count++;\n    }\n    cout << count;\n    return 0;\n}"
        ),
        status="accepted",
        passed_count=5,
        total_count=5,
        error_message=None,
    )

    session.add_all([s1_1, s1_2, s2_1, s2_2, s3_1, s3_2])
    await session.commit()
    logger.info("Seed: демо-группа и ученики готовы!")
