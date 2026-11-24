"""Роутер для отправки решения на проверку."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Problem, Submission
from app.schemas.schemas import SubmitRequest, SubmitResponse, TestResult
from app.services.piston_service import execute_cpp

router = APIRouter()


@router.post("/submit", response_model=SubmitResponse)
async def submit_solution(
    body: SubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_student_key: Annotated[str | None, Header(alias="X-Student-Key")] = None,
):
    """
    Компилирует код через Piston, прогоняет по всем тестам (видимым и скрытым)
    из базы данных и сохраняет результат в таблицу submissions.
    """
    # 1. Загружаем задачу и её тесты
    stmt = (
        select(Problem)
        .options(selectinload(Problem.test_cases))
        .where(Problem.id == body.problem_id)
    )
    result = await db.execute(stmt)
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    tests = sorted(problem.test_cases, key=lambda tc: tc.order_index)
    if not tests:
        raise HTTPException(status_code=500, detail="У задачи отсутствуют тесты")

    student_key = x_student_key.strip() if x_student_key else "anonymous"

    # 2. Пробная компиляция на первом тесте
    first_result = await execute_cpp(body.code, tests[0].input_data)

    if not first_result["compile_ok"]:
        # Сохраняем попытку с ошибкой компиляции
        sub = Submission(
            problem_id=problem.id,
            student_key=student_key,
            code=body.code,
            status="compile_error",
            passed_count=0,
            total_count=len(tests),
        )
        db.add(sub)
        await db.commit()

        return SubmitResponse(
            status="compile_error",
            compile_output=first_result["compile_stderr"],
            tests=[],
            passed_count=0,
            total_count=len(tests),
        )

    # 3. Прогон по всем тестам
    test_results: list[TestResult] = []
    overall_status = "accepted"

    for tc in tests:
        res = await execute_cpp(body.code, tc.input_data)
        actual = res["run_stdout"]
        expected = tc.expected_output.strip()
        stderr = res["run_stderr"]

        passed = (actual == expected) and (not stderr)

        if not passed:
            if stderr and not actual:
                overall_status = "runtime_error"
            elif overall_status != "runtime_error":
                overall_status = "wrong_answer"

        # Правило скрытых тестов: скрываем ввод и ожидаемый/полученный вывод
        if tc.is_hidden:
            test_results.append(
                TestResult(
                    passed=passed,
                    is_hidden=True,
                    input=None,
                    expected=None,
                    actual=None,
                    stderr=stderr if stderr else "",
                )
            )
        else:
            test_results.append(
                TestResult(
                    passed=passed,
                    is_hidden=False,
                    input=tc.input_data,
                    expected=expected,
                    actual=actual,
                    stderr=stderr,
                )
            )

    passed_count = sum(1 for t in test_results if t.passed)

    # 4. Сохраняем Submission в БД
    sub = Submission(
        problem_id=problem.id,
        student_key=student_key,
        code=body.code,
        status=overall_status,
        passed_count=passed_count,
        total_count=len(tests),
    )
    db.add(sub)
    await db.commit()

    return SubmitResponse(
        status=overall_status,
        compile_output="",
        tests=test_results,
        passed_count=passed_count,
        total_count=len(tests),
    )
