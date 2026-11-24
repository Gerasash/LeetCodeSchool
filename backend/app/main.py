"""SchoolLeetCode — точка входа FastAPI."""

from __future__ import annotations

import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic.warnings import UnsupportedFieldAttributeWarning

# Подавляем ложные предупреждения Pydantic при генерации схем для FastAPI (camelCase алиасы)
warnings.filterwarnings("ignore", category=UnsupportedFieldAttributeWarning)

from app.core.database import Base, async_session, engine
from app.routers import hints, problems, submit, tracks
from app.services.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """При старте сервера создаёт таблицы и заполняет базу начальным контентом."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await seed_database(session)

    yield

    await engine.dispose()


app = FastAPI(title="SchoolLeetCode API", version="0.3.0", lifespan=lifespan)

# CORS — разрешаем локальный фронтенд
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tracks.router, prefix="/api")
app.include_router(problems.router, prefix="/api")
app.include_router(submit.router, prefix="/api")
app.include_router(hints.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "SchoolLeetCode API v0.3.0"}
