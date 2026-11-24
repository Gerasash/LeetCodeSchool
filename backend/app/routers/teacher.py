"""Роутер кабинета преподавателя."""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import verify_teacher
from app.core.database import get_db
from app.models.models import (
    Assignment,
    AssignmentProblem,
    GroupMember,
    Problem,
    StudyGroup,
    Submission,
)
from app.schemas.schemas import (
    GroupBrief,
    StudentProblemProgress,
    TeacherAiSummaryRequest,
    TeacherAiSummaryResponse,
    TeacherAssignmentOut,
    TeacherAssignmentProblemOut,
    TeacherCreateAssignmentRequest,
    TeacherCreateGroupRequest,
    TeacherGroupDetailResponse,
    TeacherGroupListItem,
    TeacherStudentProgress,
    TeacherVerifyResponse,
)
from app.services.teacher_analytics_service import analyze_group_mistakes

router = APIRouter(dependencies=[Depends(verify_teacher)])

INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Без визуально похожих 0, O, 1, I


def _generate_invite_code(length: int = 6) -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(length))


@router.post("/verify", response_model=TeacherVerifyResponse)
async def verify_teacher_access():
    """Проверяет корректность ключа преподавателя."""
    return TeacherVerifyResponse(ok=True)


@router.get("/groups", response_model=list[TeacherGroupListItem])
async def list_groups(db: Annotated[AsyncSession, Depends(get_db)]):
    """Возвращает список всех групп с количеством учеников и заданий."""
    # Загружаем группы с подсчётом учеников и заданий
    stmt = (
        select(
            StudyGroup,
            func.count(func.distinct(GroupMember.id)).label("student_count"),
            func.count(func.distinct(Assignment.id)).label("assignment_count"),
        )
        .outerjoin(GroupMember, GroupMember.group_id == StudyGroup.id)
        .outerjoin(Assignment, Assignment.group_id == StudyGroup.id)
        .group_by(StudyGroup.id)
        .order_by(StudyGroup.created_at.desc(), StudyGroup.id.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    items: list[TeacherGroupListItem] = []
    for group, student_count, assignment_count in rows:
        items.append(
            TeacherGroupListItem(
                id=group.id,
                name=group.name,
                invite_code=group.invite_code,
                student_count=student_count,
                assignment_count=assignment_count,
                created_at=group.created_at,
            )
        )
    return items


@router.post("/groups", response_model=TeacherGroupListItem, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: TeacherCreateGroupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Создаёт новую учебную группу с уникальным 6-символьным кодом приглашения."""
    name = body.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название группы не может быть пустым",
        )

    # Генерируем уникальный инвайт-код
    for _ in range(10):
        code = _generate_invite_code(6)
        check_stmt = select(StudyGroup.id).where(StudyGroup.invite_code == code)
        existing = (await db.execute(check_stmt)).scalar_one_or_none()
        if not existing:
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сгенерировать уникальный код приглашения",
        )

    group = StudyGroup(name=name, invite_code=code)
    db.add(group)
    await db.commit()
    await db.refresh(group)

    return TeacherGroupListItem(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        student_count=0,
        assignment_count=0,
        created_at=group.created_at,
    )


@router.get("/groups/{group_id}", response_model=TeacherGroupDetailResponse)
async def get_group_details(
    group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Возвращает детальную карточку группы, список заданий,
    уникальные задачи и матрицу успеваемости каждого ученика.
    """
    stmt = (
        select(StudyGroup)
        .options(
            selectinload(StudyGroup.members),
            selectinload(StudyGroup.assignments)
            .selectinload(Assignment.problems)
            .selectinload(AssignmentProblem.problem),
        )
        .where(StudyGroup.id == group_id)
    )
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    # 1. Формируем список заданий
    assignments_out: list[TeacherAssignmentOut] = []
    unique_problems_map: dict[int, TeacherAssignmentProblemOut] = {}

    for asgn in group.assignments:
        prob_out_list: list[TeacherAssignmentProblemOut] = []
        for ap in sorted(asgn.problems, key=lambda p: p.order_index):
            prob = ap.problem
            p_out = TeacherAssignmentProblemOut(
                id=prob.id,
                title=prob.title,
                difficulty=prob.difficulty,
            )
            prob_out_list.append(p_out)
            if prob.id not in unique_problems_map:
                unique_problems_map[prob.id] = p_out

        assignments_out.append(
            TeacherAssignmentOut(
                id=asgn.id,
                title=asgn.title,
                problems=prob_out_list,
            )
        )

    unique_problems = list(unique_problems_map.values())
    problem_ids = list(unique_problems_map.keys())

    # 2. Собираем матрицу успеваемости по каждому ученику
    students_out: list[TeacherStudentProgress] = []

    if group.members and problem_ids:
        student_keys = [m.student_key for m in group.members]

        # Загружаем все попытки учеников по задачам заданий
        sub_stmt = (
            select(Submission)
            .where(
                Submission.student_key.in_(student_keys),
                Submission.problem_id.in_(problem_ids),
            )
            .order_by(Submission.created_at.asc())
        )
        sub_res = await db.execute(sub_stmt)
        submissions = sub_res.scalars().all()

        # Группируем попытки: (student_key, problem_id) -> list[Submission]
        student_prob_subs: dict[tuple[str, int], list[Submission]] = {}
        for sub in submissions:
            pair = (sub.student_key, sub.problem_id)
            if pair not in student_prob_subs:
                student_prob_subs[pair] = []
            student_prob_subs[pair].append(sub)

        for member in group.members:
            progress_list: list[StudentProblemProgress] = []
            solved_count = 0
            total_attempts = 0

            for p in unique_problems:
                subs = student_prob_subs.get((member.student_key, p.id), [])
                attempts = len(subs)
                total_attempts += attempts

                if any(s.status == "accepted" for s in subs):
                    p_status = "solved"
                    solved_count += 1
                elif attempts > 0:
                    p_status = "attempted"
                else:
                    p_status = "not_started"

                last_status = subs[-1].status if subs else None

                progress_list.append(
                    StudentProblemProgress(
                        problem_id=p.id,
                        status=p_status,
                        attempts=attempts,
                        last_status=last_status,
                    )
                )

            students_out.append(
                TeacherStudentProgress(
                    student_key=member.student_key,
                    student_name=member.student_name,
                    solved_count=solved_count,
                    total_attempts=total_attempts,
                    progress=progress_list,
                )
            )
    elif group.members:
        # Ученики есть, но заданий/задач пока нет
        for member in group.members:
            students_out.append(
                TeacherStudentProgress(
                    student_key=member.student_key,
                    student_name=member.student_name,
                    solved_count=0,
                    total_attempts=0,
                    progress=[],
                )
            )

    return TeacherGroupDetailResponse(
        group=GroupBrief(
            id=group.id,
            name=group.name,
            invite_code=group.invite_code,
        ),
        assignments=assignments_out,
        problems=unique_problems,
        students=students_out,
    )


@router.post("/groups/{group_id}/assignments", response_model=TeacherAssignmentOut, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    group_id: int,
    body: TeacherCreateAssignmentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Создаёт новое задание (ДЗ) в группе с указанным набором задач."""
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Название задания не может быть пустым")

    if not body.problem_ids:
        raise HTTPException(status_code=400, detail="Необходимо указать хотя бы одну задачу")

    # 1. Проверяем наличие группы
    group_stmt = select(StudyGroup.id).where(StudyGroup.id == group_id)
    if not (await db.execute(group_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Группа не найдена")

    # 2. Проверяем существование всех задач
    prob_stmt = select(Problem).where(Problem.id.in_(body.problem_ids))
    prob_res = await db.execute(prob_stmt)
    found_problems = {p.id: p for p in prob_res.scalars().all()}

    missing_ids = [pid for pid in body.problem_ids if pid not in found_problems]
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Задачи с ID {missing_ids} не найдены в базе данных",
        )

    # 3. Создаём Assignment и AssignmentProblem
    assignment = Assignment(group_id=group_id, title=title)
    db.add(assignment)
    await db.flush()

    prob_out_list: list[TeacherAssignmentProblemOut] = []
    # Сохраняем в порядке, переданном преподавателем
    for idx, pid in enumerate(body.problem_ids):
        ap = AssignmentProblem(
            assignment_id=assignment.id,
            problem_id=pid,
            order_index=idx + 1,
        )
        db.add(ap)
        prob = found_problems[pid]
        prob_out_list.append(
            TeacherAssignmentProblemOut(
                id=prob.id,
                title=prob.title,
                difficulty=prob.difficulty,
            )
        )

    await db.commit()

    return TeacherAssignmentOut(
        id=assignment.id,
        title=assignment.title,
        problems=prob_out_list,
    )


@router.post("/groups/{group_id}/ai-summary", response_model=TeacherAiSummaryResponse)
async def get_group_ai_summary(
    group_id: int,
    body: TeacherAiSummaryRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Генерирует ИИ-сводку типичных ошибок учеников группы
    (по конкретной задаче или в целом по группе) через DeepSeek.
    """
    # Проверяем наличие группы
    group_stmt = select(StudyGroup.id).where(StudyGroup.id == group_id)
    if not (await db.execute(group_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Группа не найдена")

    return await analyze_group_mistakes(
        db=db,
        group_id=group_id,
        problem_id=body.problem_id,
    )
