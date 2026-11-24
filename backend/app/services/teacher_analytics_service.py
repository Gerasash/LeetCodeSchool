"""Сервис ИИ-аналитики типичных ошибок группы через DeepSeek."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import HTTPException
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import GroupMember, Problem, Submission
from app.schemas.schemas import CommonMistakeItem, TeacherAiSummaryResponse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory кэш аналитики: (group_id, problem_id, max_submission_id) -> TeacherAiSummaryResponse
# ---------------------------------------------------------------------------
_analytics_cache: dict[tuple, TeacherAiSummaryResponse] = {}
MAX_ANALYTICS_CACHE_SIZE = 200

SYSTEM_PROMPT = """\
Ты — ведущий преподаватель-методист по языку C++.
Перед тобой выборка недавних неуспешных попыток решения задач учениками одной учебной группы.
Твоя задача — провести анализ типичных ошибок группы и дать методические рекомендации преподавателю.

ВХОДНЫЕ ДАННЫЕ:
- Список попыток учеников (анонимизированные обозначения «Ученик #1», «Ученик #2» и т.д.).
- Названия задач, типы ошибок (compile_error, wrong_answer, runtime_error), сообщения об ошибках и фрагменты кода.

ИНСТРУКЦИИ:
1. Выдели 1–4 наиболее частые и характерные ошибки (например: выход за границы массива, отсутствие проверки чётности, неинициализированные переменные, путаница с индексацией с 0 или 1, синтаксические ошибки).
2. Для каждой ошибки укажи:
   - title: краткое понятное название (на русском);
   - description: в чём именно заключается ошибка и почему ученики её допускают;
   - affected_students_count: примерное количество учеников с такой ошибкой (целое число, >= 1);
   - recommendation: что преподавателю разобрать на ближайшем уроке (конкретная рекомендация, как объяснить тему).
3. Сформулируй overall_summary: краткое резюме по группе на 2–3 предложения (общий уровень понимания темы, ключевой пробел).

ФОРМАТ ОТВЕТА — строго JSON со следующей структурой:
{
  "overall_summary": "Краткое резюме на 2-3 предложения",
  "common_mistakes": [
    {
      "title": "Название ошибки",
      "description": "Суть ошибки",
      "affected_students_count": 2,
      "recommendation": "Что разобрать на уроке"
    }
  ]
}

Отвечай ТОЛЬКО валидным JSON, без markdown-разметки (без ```json).
"""


async def analyze_group_mistakes(
    db: AsyncSession,
    group_id: int,
    problem_id: int | None = None,
) -> TeacherAiSummaryResponse:
    """
    Анализирует последние ошибки учеников группы и генерирует ИИ-сводку.
    """
    # 1. Получаем ключи учеников группы
    member_stmt = select(GroupMember.student_key).where(GroupMember.group_id == group_id)
    member_res = await db.execute(member_stmt)
    student_keys = member_res.scalars().all()

    if not student_keys:
        return TeacherAiSummaryResponse(
            overall_summary="В группе пока нет учеников для анализа.",
            common_mistakes=[],
            analyzed_submissions_count=0,
            analyzed_students_count=0,
        )

    # 2. Выбираем последние неуспешные попытки (до 25 штук)
    sub_stmt = (
        select(Submission, Problem.title)
        .join(Problem, Submission.problem_id == Problem.id)
        .where(
            Submission.student_key.in_(student_keys),
            Submission.status != "accepted",
        )
    )
    if problem_id:
        sub_stmt = sub_stmt.where(Submission.problem_id == problem_id)

    sub_stmt = sub_stmt.order_by(Submission.created_at.desc(), Submission.id.desc()).limit(25)
    sub_res = await db.execute(sub_stmt)
    submissions_with_title = sub_res.all()

    if not submissions_with_title:
        return TeacherAiSummaryResponse(
            overall_summary="В группе пока нет неуспешных попыток для анализа.",
            common_mistakes=[],
            analyzed_submissions_count=0,
            analyzed_students_count=0,
        )

    # 3. Проверяем кэш
    max_sub_id = max(sub.id for sub, _ in submissions_with_title)
    cache_key = (group_id, problem_id, max_sub_id)
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    # 4. Проверяем наличие ключа DeepSeek API
    if not settings.deepseek_api_key:
        raise HTTPException(
            status_code=503,
            detail="ИИ-аналитика недоступна: ключ DEEPSEEK_API_KEY не задан в .env",
        )

    # 5. Анонимизируем учеников и формируем промпт
    distinct_students: dict[str, str] = {}
    for sub, _ in submissions_with_title:
        if sub.student_key not in distinct_students:
            distinct_students[sub.student_key] = f"Ученик #{len(distinct_students) + 1}"

    user_lines: list[str] = [
        f"Всего проанализировано попыток: {len(submissions_with_title)}",
        f"Учеников с ошибками: {len(distinct_students)}",
        "",
        "### Список попыток:",
    ]

    for idx, (sub, prob_title) in enumerate(submissions_with_title, start=1):
        anon_name = distinct_students[sub.student_key]
        err_info = sub.error_message or "не указано"
        code_snippet = sub.code[:600].strip()
        user_lines.append(
            f"--- Попытка #{idx} ---\n"
            f"Автор: {anon_name}\n"
            f"Задача: {prob_title} (ID {sub.problem_id})\n"
            f"Статус: {sub.status} (пройдено тестов: {sub.passed_count}/{sub.total_count})\n"
            f"Ошибка: {err_info}\n"
            f"Код:\n```cpp\n{code_snippet}\n```\n"
        )

    user_message = "\n".join(user_lines)

    # 6. Запрос к DeepSeek
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.deepseek_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1000,
        )
        raw_text = response.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw_text)
    except Exception as exc:
        logger.error("Ошибка при вызове DeepSeek для аналитики группы: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка генерации ИИ-сводки: {exc}",
        ) from exc

    # 7. Валидация и парсинг
    overall = data.get("overall_summary", "Анализ ошибок завершён.")
    raw_mistakes = data.get("common_mistakes", [])

    common_mistakes: list[CommonMistakeItem] = []
    for m in raw_mistakes:
        if isinstance(m, dict):
            common_mistakes.append(
                CommonMistakeItem(
                    title=str(m.get("title", "Типичная ошибка")),
                    description=str(m.get("description", "")),
                    affected_students_count=int(m.get("affected_students_count", 1)),
                    recommendation=str(m.get("recommendation", "")),
                )
            )

    result = TeacherAiSummaryResponse(
        overall_summary=overall,
        common_mistakes=common_mistakes,
        analyzed_submissions_count=len(submissions_with_title),
        analyzed_students_count=len(distinct_students),
    )

    # Сохраняем в кэш
    if len(_analytics_cache) >= MAX_ANALYTICS_CACHE_SIZE:
        oldest_key = next(iter(_analytics_cache))
        del _analytics_cache[oldest_key]
    _analytics_cache[cache_key] = result

    return result
