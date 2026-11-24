"""Pydantic-схемы для API (camelCase для фронтенда)."""

from __future__ import annotations

import warnings
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from pydantic.warnings import UnsupportedFieldAttributeWarning

# Подавляем ложные предупреждения Pydantic при генерации схем для FastAPI (camelCase алиасы)
warnings.filterwarnings("ignore", category=UnsupportedFieldAttributeWarning)


class CamelModel(BaseModel):
    """Базовая модель с camelCase алиасами для JSON."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# --- Дерево треков / тем / задач (Срез 3) ---


class ProblemListItem(CamelModel):
    id: int
    title: str
    difficulty: str
    order_index: int
    status: Literal["solved", "attempted", "not_started"] = "not_started"


class TopicOut(CamelModel):
    id: int
    title: str
    theory_markdown: str
    order_index: int
    problems: list[ProblemListItem]


class TrackOut(CamelModel):
    id: int
    title: str
    category: str  # school | university
    order_index: int
    topics: list[TopicOut]


# --- Детальная задача ---


class ExampleTest(CamelModel):
    input: str
    expected_output: str


class ProblemOut(CamelModel):
    id: int
    title: str
    difficulty: str
    description: str
    starter_code: str
    theory_markdown: str = ""
    grade: str = ""
    track_title: str = ""
    examples: list[ExampleTest]


# --- Отправка решения ---


class SubmitRequest(CamelModel):
    problem_id: int
    code: str


class TestResult(CamelModel):
    passed: bool
    is_hidden: bool = False
    input: str | None = None
    expected: str | None = None
    actual: str | None = None
    stderr: str = ""


class SubmitResponse(CamelModel):
    status: str  # "accepted" | "wrong_answer" | "compile_error" | "runtime_error"
    compile_output: str
    tests: list[TestResult]
    passed_count: int = 0
    total_count: int = 0


# --- ИИ-подсказки (Срез 2) ---


class FailedTestInfo(CamelModel):
    input: str | None = None
    expected: str | None = None
    actual: str | None = None
    stderr: str = ""
    is_hidden: bool = False


class HintRequest(CamelModel):
    problem_id: int
    code: str
    level: int = Field(ge=1, le=3)
    status: Literal["compile_error", "wrong_answer", "runtime_error"]
    compile_stderr: str | None = None
    failed_test: FailedTestInfo | None = None


class HintResponse(CamelModel):
    line_start: int = Field(ge=1)
    line_end: int = Field(ge=1)
    error_type: Literal["syntax", "logic", "edge_case", "runtime"]
    hint_text: str
    level: int
    can_escalate: bool
