"""Роутер для ИИ-подсказок."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Problem
from app.schemas.schemas import HintRequest, HintResponse
from app.services.ai_hint_service import get_hint

router = APIRouter()


@router.post("/hint", response_model=HintResponse)
async def request_hint(
    body: HintRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Возвращает ИИ-подсказку для кода ученика."""
    failed_test_dict = None
    if body.failed_test:
        failed_test_dict = body.failed_test.model_dump(by_alias=False)

    # Загружаем название, условие и тесты задачи из БД
    stmt = (
        select(Problem)
        .options(selectinload(Problem.test_cases))
        .where(Problem.id == body.problem_id)
    )
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    title = problem.title if problem else ""
    description = problem.description if problem else ""

    # Если упал скрытый тест, но фронтенд не знает его данных (они были скрыты),
    # подтягиваем реальные данные первого скрытого теста из БД для точного анализа DeepSeek
    if (
        failed_test_dict
        and failed_test_dict.get("is_hidden")
        and problem
        and (not failed_test_dict.get("input") or not failed_test_dict.get("expected"))
    ):
        hidden_tcs = [tc for tc in problem.test_cases if tc.is_hidden]
        if hidden_tcs:
            hidden_tcs.sort(key=lambda tc: tc.order_index)
            failed_test_dict["input"] = hidden_tcs[0].input_data
            failed_test_dict["expected"] = hidden_tcs[0].expected_output

    try:
        hint_result = await get_hint(
            problem_id=body.problem_id,
            code=body.code,
            level=body.level,
            status=body.status,
            problem_title=title,
            problem_description=description,
            compile_stderr=body.compile_stderr,
            failed_test=failed_test_dict,
        )
    except ValueError as exc:
        # Ключ API не задан
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка при обращении к ИИ-сервису: {exc}",
        ) from exc

    return HintResponse(**hint_result)
