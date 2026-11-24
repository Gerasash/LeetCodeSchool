"""Pydantic-схемы для API (camelCase для фронтенда)."""

from __future__ import annotations

import datetime
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


# --- Учебные группы и задания (Срез 4: Ученик) ---


class GroupJoinRequest(CamelModel):
    invite_code: str
    student_name: str


class GroupJoinResponse(CamelModel):
    group_id: int
    group_name: str
    invite_code: str
    student_name: str


class StudentAssignmentProblem(CamelModel):
    id: int
    title: str
    difficulty: str
    status: Literal["solved", "attempted", "not_started"] = "not_started"


class StudentAssignment(CamelModel):
    id: int
    title: str
    problems: list[StudentAssignmentProblem]


class StudentGroupOut(CamelModel):
    group_id: int
    group_name: str
    invite_code: str
    student_name: str
    assignments: list[StudentAssignment]


# --- Кабинет преподавателя (Срез 4: Преподаватель) ---


class TeacherVerifyResponse(CamelModel):
    ok: bool = True


class TeacherGroupListItem(CamelModel):
    id: int
    name: str
    invite_code: str
    student_count: int = 0
    assignment_count: int = 0
    created_at: datetime.datetime


class TeacherCreateGroupRequest(CamelModel):
    name: str


class TeacherCreateAssignmentRequest(CamelModel):
    title: str
    problem_ids: list[int]


class TeacherAssignmentProblemOut(CamelModel):
    id: int
    title: str
    difficulty: str


class TeacherAssignmentOut(CamelModel):
    id: int
    title: str
    problems: list[TeacherAssignmentProblemOut]


class StudentProblemProgress(CamelModel):
    problem_id: int
    status: Literal["solved", "attempted", "not_started"]
    attempts: int = 0
    last_status: str | None = None


class TeacherStudentProgress(CamelModel):
    student_key: str
    student_name: str
    solved_count: int = 0
    total_attempts: int = 0
    progress: list[StudentProblemProgress]


class GroupBrief(CamelModel):
    id: int
    name: str
    invite_code: str


class TeacherGroupDetailResponse(CamelModel):
    group: GroupBrief
    assignments: list[TeacherAssignmentOut]
    problems: list[TeacherAssignmentProblemOut]
    students: list[TeacherStudentProgress]


# --- ИИ-аналитика ошибок группы (Срез 4) ---


class TeacherAiSummaryRequest(CamelModel):
    problem_id: int | None = None


class CommonMistakeItem(CamelModel):
    title: str
    description: str
    affected_students_count: int
    recommendation: str


class TeacherAiSummaryResponse(CamelModel):
    overall_summary: str
    common_mistakes: list[CommonMistakeItem]
    analyzed_submissions_count: int
    analyzed_students_count: int
