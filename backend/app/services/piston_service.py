"""Сервис для взаимодействия с Piston API."""

import httpx
from fastapi import HTTPException

from app.core.config import settings

EXECUTE_URL = f"{settings.piston_url}/api/v2/execute"


async def execute_cpp(code: str, stdin: str) -> dict:
    """
    Отправляет C++ код на компиляцию и выполнение в Piston.

    Возвращает словарь с ключами:
    - compile_ok: bool
    - compile_stderr: str
    - run_stdout: str
    - run_stderr: str
    """
    payload = {
        "language": "c++",
        "version": "*",
        "files": [{"name": "main.cpp", "content": code}],
        "stdin": stdin,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(EXECUTE_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Песочница Piston недоступна или вернула ошибку: {exc}",
        ) from exc

    compile_stage = data.get("compile", {})
    run_stage = data.get("run", {})

    compile_output = (
        compile_stage.get("output", "")
        or compile_stage.get("stderr", "")
    ).strip()
    compile_code = compile_stage.get("code")

    # В Piston compile.code == 0 означает успешную компиляцию
    # Если compile_stage отсутствует (например интерпретируемый язык), но есть run_stage
    compile_ok = (compile_code == 0) or (compile_code is None and bool(run_stage))

    return {
        "compile_ok": compile_ok,
        "compile_stderr": compile_output,
        "run_stdout": run_stage.get("stdout", "").strip(),
        "run_stderr": run_stage.get("stderr", "").strip(),
        "run_code": run_stage.get("code"),
    }
