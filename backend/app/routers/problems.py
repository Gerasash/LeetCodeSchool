"""Роутер для получения задач из базы данных."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Problem, Topic
from app.schemas.schemas import ExampleTest, ProblemOut

router = APIRouter()


@router.get("/problems/{problem_id}", response_model=ProblemOut)
async def get_problem(
    problem_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Возвращает условие задачи, теорию темы и только видимые примеры тестов."""
    stmt = (
        select(Problem)
        .options(
            selectinload(Problem.test_cases),
            selectinload(Problem.topic).selectinload(Topic.track),
        )
        .where(Problem.id == problem_id)
    )
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    visible_tests = [
        tc for tc in problem.test_cases if not tc.is_hidden
    ]
    visible_tests.sort(key=lambda tc: tc.order_index)

    theory_md = problem.topic.theory_markdown if problem.topic else ""
    track_name = problem.topic.track.title if (problem.topic and problem.topic.track) else ""

    return ProblemOut(
        id=problem.id,
        title=problem.title,
        difficulty=problem.difficulty,
        description=problem.description,
        starter_code=problem.starter_code,
        theory_markdown=theory_md,
        track_title=track_name,
        grade=track_name,
        examples=[
            ExampleTest(input=tc.input_data, expected_output=tc.expected_output)
            for tc in visible_tests
        ],
    )
