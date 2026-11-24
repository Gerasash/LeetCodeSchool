"""Авторизация и проверка прав доступа."""

from __future__ import annotations

from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def verify_teacher(
    x_teacher_key: Annotated[str, Header(alias="X-Teacher-Key")] = "",
) -> str:
    """Проверяет статический ключ преподавателя из заголовка X-Teacher-Key."""
    if not x_teacher_key or x_teacher_key != settings.teacher_access_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный ключ доступа преподавателя",
        )
    return x_teacher_key
