"""Роутер для работы ученика с учебными группами."""

from __future__ import annotations

from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import (
    Assignment,
    AssignmentProblem,
    GroupMember,
    StudyGroup,
    Submission,
)
from app.schemas.schemas import (
    GroupJoinRequest,
    GroupJoinResponse,
    StudentAssignment,
    StudentAssignmentProblem,
    StudentGroupOut,
)

router = APIRouter()


@router.post("/join", response_model=GroupJoinResponse)
async def join_group(
    body: GroupJoinRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_student_key: Annotated[str | None, Header(alias="X-Student-Key")] = None,
):
    """Присоединяет ученика к учебной группе по коду приглашения (идемпотентно)."""
    if not x_student_key or not x_student_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заголовок X-Student-Key обязателен для вступления в группу",
        )

    student_key = x_student_key.strip()
    invite_code = body.invite_code.strip().upper()
    student_name = body.student_name.strip()

    if not invite_code or not student_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код приглашения и имя ученика не могут быть пустыми",
        )

    # 1. Поиск группы по коду
    stmt = select(StudyGroup).where(StudyGroup.invite_code == invite_code)
    res = await db.execute(stmt)
    group = res.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Группа с таким кодом не найдена",
        )

    # 2. Проверяем, состоит ли ученик уже в группе
    member_stmt = select(GroupMember).where(
        GroupMember.group_id == group.id,
        GroupMember.student_key == student_key,
    )
    m_res = await db.execute(member_stmt)
    member = m_res.scalar_one_or_none()

    if member:
        # Обновляем имя, если изменилось
        member.student_name = student_name
    else:
        member = GroupMember(
            group_id=group.id,
            student_key=student_key,
            student_name=student_name,
        )
        db.add(member)

    await db.commit()

    return GroupJoinResponse(
        group_id=group.id,
        group_name=group.name,
        invite_code=group.invite_code,
        student_name=student_name,
    )


@router.get("/my", response_model=list[StudentGroupOut])
async def get_my_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_student_key: Annotated[str | None, Header(alias="X-Student-Key")] = None,
):
    """
    Возвращает список групп, в которых состоит ученик,
    вместе с заданиями и персональным статусом решения задач.
    """
    if not x_student_key or not x_student_key.strip():
        return []

    student_key = x_student_key.strip()

    # 1. Находим группы ученика
    stmt = (
        select(GroupMember)
        .options(
            selectinload(GroupMember.group)
            .selectinload(StudyGroup.assignments)
            .selectinload(Assignment.problems)
            .selectinload(AssignmentProblem.problem)
        )
        .where(GroupMember.student_key == student_key)
        .order_by(GroupMember.joined_at.desc())
    )
    result = await db.execute(stmt)
    memberships = result.scalars().all()

    if not memberships:
        return []

    # 2. Собираем все problem_id из всех заданий этих групп
    problem_ids: set[int] = set()
    for m in memberships:
        for asgn in m.group.assignments:
            for ap in asgn.problems:
                problem_ids.add(ap.problem_id)

    # 3. Получаем статусы попыток для этого ученика
    problem_statuses: dict[int, set[str]] = defaultdict(set)
    if problem_ids:
        sub_stmt = select(Submission.problem_id, Submission.status).where(
            Submission.student_key == student_key,
            Submission.problem_id.in_(problem_ids),
        )
        sub_res = await db.execute(sub_stmt)
        for pid, st in sub_res.all():
            problem_statuses[pid].add(st)

    # 4. Формируем ответ
    output: list[StudentGroupOut] = []
    for m in memberships:
        group = m.group
        assignments_out: list[StudentAssignment] = []

        for asgn in group.assignments:
            asgn_problems_out: list[StudentAssignmentProblem] = []
            for ap in sorted(asgn.problems, key=lambda p: p.order_index):
                statuses = problem_statuses.get(ap.problem_id, set())
                if "accepted" in statuses:
                    prob_status = "solved"
                elif statuses:
                    prob_status = "attempted"
                else:
                    prob_status = "not_started"

                asgn_problems_out.append(
                    StudentAssignmentProblem(
                        id=ap.problem.id,
                        title=ap.problem.title,
                        difficulty=ap.problem.difficulty,
                        status=prob_status,
                    )
                )

            assignments_out.append(
                StudentAssignment(
                    id=asgn.id,
                    title=asgn.title,
                    problems=asgn_problems_out,
                )
            )

        output.append(
            StudentGroupOut(
                group_id=group.id,
                group_name=group.name,
                invite_code=group.invite_code,
                student_name=m.student_name,
                assignments=assignments_out,
            )
        )

    return output
