"""Сервис ИИ-наставника — подсказки через DeepSeek API (Сократовский метод)."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory кэш подсказок  (problem_id, sha256(code), level, status) → dict
# ---------------------------------------------------------------------------
_hint_cache: dict[tuple, dict[str, Any]] = {}

MAX_CACHE_SIZE = 500


def _cache_key(problem_id: int, code: str, level: int, status: str) -> tuple:
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    return (problem_id, code_hash, level, status)


# ---------------------------------------------------------------------------
# Нумерация строк кода
# ---------------------------------------------------------------------------


def number_lines(code: str) -> str:
    """Добавляет нумерацию строк: '1 | ...', '2 | ...', ..."""
    lines = code.split("\n")
    width = len(str(len(lines)))
    return "\n".join(f"{i + 1:>{width}} | {line}" for i, line in enumerate(lines))


# ---------------------------------------------------------------------------
# Системный промпт для DeepSeek
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Ты — ИИ-наставник для школьников и студентов, изучающих C++.
Ученик решает задачу по программированию и допустил ошибку.

Твоя задача — помочь найти ошибку, НЕ выдавая готовое решение.

ВХОДНЫЕ ДАННЫЕ:
- Код ученика с пронумерованными строками (формат: «номер | код»).
- Описание задачи.
- Статус проверки и информация об ошибке.
- Запрашиваемый уровень подсказки (1, 2 или 3).

ПРАВИЛО СКРЫТЫХ ТЕСТОВ (КРИТИЧЕСКИ ВАЖНО):
Если упавший тест помечен как СКРЫТЫЙ (is_hidden=True):
Тебе переданы реальные входные и ожидаемые/полученные данные этого теста исключительно для понимания природы ошибки (например: отрицательные числа, ноль, переполнение, пустой ввод, граничные условия).
СТРОГО ЗАПРЕЩЕНО раскрывать ученику конкретные числа или строки из входных/ожидаемых данных скрытого теста!
(Например, НЕ пиши: «на тесте -2 7 10 -4 ожидается 4». Вместо этого напиши: «Обрати внимание, как твоя программа обрабатывает отрицательные числа»).

УРОВНИ ПОДСКАЗОК (Сократовский метод):
- Уровень 1: укажи проблемные строки и задай КОРОТКИЙ наводящий вопрос.
  Готовый код и прямое исправление ЗАПРЕЩЕНЫ.
- Уровень 2: объясни суть конкретной ошибки в этих строках на русском языке
  простыми словами. Объясни что не так и почему. Готовое решение задачи ЗАПРЕЩЕНО.
- Уровень 3: объясни нужную концепцию C++ на коротком отвлечённом мини-примере
  (НЕ из этой задачи), чтобы ученик сам перенёс идею в свой код.

Для compile_error и runtime_error: переведи сообщение компилятора/ошибки
на понятный школьнику русский язык.

ФОРМАТ ОТВЕТА — строго JSON с полями:
{
  "line_start": <номер первой проблемной строки, int, >= 1>,
  "line_end": <номер последней проблемной строки, int, >= 1>,
  "error_type": "<одно из: syntax, logic, edge_case, runtime>",
  "hint_text": "<текст подсказки на русском языке>"
}

Отвечай ТОЛЬКО JSON, без markdown, без обёрток в ```.
"""


def _build_user_message(
    code: str,
    problem_title: str,
    problem_description: str,
    level: int,
    status: str,
    compile_stderr: str | None,
    failed_test: dict | None,
) -> str:
    """Формирует пользовательское сообщение для DeepSeek."""
    numbered_code = number_lines(code)

    parts = [
        f"## Задача: {problem_title}\n{problem_description}\n",
        f"## Код ученика (с нумерацией строк):\n```\n{numbered_code}\n```\n",
        f"## Статус проверки: {status}",
        f"## Запрашиваемый уровень подсказки: {level}",
    ]

    if status == "compile_error" and compile_stderr:
        parts.append(f"## Вывод компилятора:\n```\n{compile_stderr}\n```")

    if status == "runtime_error" and failed_test and failed_test.get("stderr"):
        parts.append(f"## Ошибка выполнения:\n```\n{failed_test['stderr']}\n```")

    if status in ("wrong_answer", "runtime_error") and failed_test:
        is_hidden = failed_test.get("is_hidden", False)
        hidden_prefix = (
            " (ВНИМАНИЕ: это скрытый тест! Не называй ученику конкретные входные/выходные числа!)"
            if is_hidden
            else ""
        )
        parts.append(
            f"## Упавший тест{hidden_prefix}:\n"
            f"Ввод: {failed_test.get('input', '—')}\n"
            f"Ожидалось: {failed_test.get('expected', '—')}\n"
            f"Получено: {failed_test.get('actual', '—')}"
        )

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Запрос к DeepSeek и валидация
# ---------------------------------------------------------------------------


async def get_hint(
    problem_id: int,
    code: str,
    level: int,
    status: str,
    problem_title: str = "",
    problem_description: str = "",
    compile_stderr: str | None = None,
    failed_test: dict | None = None,
) -> dict[str, Any]:
    """
    Получает подсказку от DeepSeek, валидирует и кэширует.

    Возвращает dict с ключами:
      line_start, line_end, error_type, hint_text, level, can_escalate
    """
    # --- Проверка ключа API ---
    if not settings.deepseek_api_key:
        raise ValueError(
            "ИИ-наставник недоступен: ключ DEEPSEEK_API_KEY не задан в .env"
        )

    # --- Кэш ---
    key = _cache_key(problem_id, code, level, status)
    if key in _hint_cache:
        return _hint_cache[key]

    # --- Подсчёт строк кода ---
    total_lines = len(code.split("\n"))

    # --- Запрос к DeepSeek ---
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    user_message = _build_user_message(
        code=code,
        problem_title=problem_title or f"Задача #{problem_id}",
        problem_description=problem_description,
        level=level,
        status=status,
        compile_stderr=compile_stderr,
        failed_test=failed_test,
    )

    response = await client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=600,
    )

    raw_text = response.choices[0].message.content or "{}"

    # --- Парсинг и валидация ---
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("DeepSeek вернул невалидный JSON: %s", raw_text[:200])
        data = {}

    line_start = int(data.get("line_start", 1))
    line_end = int(data.get("line_end", line_start))
    error_type = data.get("error_type", "logic")
    hint_text = data.get("hint_text", "Не удалось получить подсказку.")

    # Валидация error_type
    if error_type not in ("syntax", "logic", "edge_case", "runtime"):
        error_type = "logic"

    # Приведение строк к валидному диапазону
    line_start = max(1, min(line_start, total_lines))
    line_end = max(line_start, min(line_end, total_lines))

    result = {
        "line_start": line_start,
        "line_end": line_end,
        "error_type": error_type,
        "hint_text": hint_text,
        "level": level,
        "can_escalate": level < 3,
    }

    # Кэшируем
    if len(_hint_cache) >= MAX_CACHE_SIZE:
        first_key = next(iter(_hint_cache))
        del _hint_cache[first_key]
    _hint_cache[key] = result

    return result
