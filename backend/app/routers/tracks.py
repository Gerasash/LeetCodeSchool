"""Роутер учебных треков и каталога задач."""

from __future__ import annotations

from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Submission, Topic, Track
from app.schemas.schemas import ProblemListItem, TopicOut, TrackOut

router = APIRouter()


@router.get("/tracks", response_model=list[TrackOut])
async def get_tracks(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_student_key: Annotated[str | None, Header(alias="X-Student-Key")] = None,
):
    """
    Возвращает дерево: Треки -> Темы -> Задачи.
    Для каждой задачи рассчитывается статус (solved / attempted / not_started)
    на основе X-Student-Key.
    """
    # 1. Загружаем дерево
    stmt = (
        select(Track)
        .options(
            selectinload(Track.topics.and_(True))
            .selectinload(Topic.problems.and_(True))
        )
        .order_by(Track.order_index)
    )
    result = await db.execute(stmt)
    tracks = result.scalars().all()

    # 2. Если передан student_key, получаем статусы решений
    problem_statuses: dict[int, set[str]] = defaultdict(set)
    if x_student_key:
        sub_stmt = select(Submission.problem_id, Submission.status).where(
            Submission.student_key == x_student_key
        )
        sub_res = await db.execute(sub_stmt)
        for pid, status in sub_res.all():
            problem_statuses[pid].add(status)

    # 3. Собираем ответ
    out: list[TrackOut] = []
    for track in tracks:
        topics_out: list[TopicOut] = []
        # Сортируем темы по order_index
        sorted_topics = sorted(track.topics, key=lambda t: t.order_index)
        for topic in sorted_topics:
            sorted_problems = sorted(topic.problems, key=lambda p: p.order_index)
            problems_out: list[ProblemListItem] = []
            for prob in sorted_problems:
                statuses = problem_statuses.get(prob.id, set())
                if "accepted" in statuses:
                    prob_status = "solved"
                elif statuses:
                    prob_status = "attempted"
                else:
                    prob_status = "not_started"

                problems_out.append(
                    ProblemListItem(
                        id=prob.id,
                        title=prob.title,
                        difficulty=prob.difficulty,
                        order_index=prob.order_index,
                        status=prob_status,
                    )
                )

            topics_out.append(
                TopicOut(
                    id=topic.id,
                    title=topic.title,
                    theory_markdown=topic.theory_markdown,
                    order_index=topic.order_index,
                    problems=problems_out,
                )
            )

        out.append(
            TrackOut(
                id=track.id,
                title=track.title,
                category=track.category,
                order_index=track.order_index,
                topics=topics_out,
            )
        )

    return out
