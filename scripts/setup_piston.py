"""
Скрипт для настройки Piston: проверка доступности и установка пакета gcc (C++).

Использование:
    python scripts/setup_piston.py

По умолчанию Piston запускается на http://localhost:2000.
"""

import sys
import time
import urllib.request
import urllib.error
import json

PISTON_URL = "http://localhost:2000"
MAX_RETRIES = 30
RETRY_DELAY = 2  # секунды


def wait_for_piston():
    """Ждём, пока Piston станет доступен."""
    print(f"⏳ Ожидание запуска Piston ({PISTON_URL})...")
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(f"{PISTON_URL}/api/v2/runtimes")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    print(f"✅ Piston доступен (попытка {attempt})")
                    return json.loads(resp.read().decode())
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
        print(f"   Попытка {attempt}/{MAX_RETRIES}...")
        time.sleep(RETRY_DELAY)

    print("❌ Piston не запустился. Убедитесь, что Docker-контейнер работает:")
    print("   docker compose up -d")
    sys.exit(1)


def check_gcc_installed(runtimes: list) -> bool:
    """Проверяет, установлен ли gcc."""
    for rt in runtimes:
        if rt.get("language") in ("c++", "cpp", "g++", "gcc"):
            print(f"✅ Компилятор уже установлен: {rt['language']} {rt['version']}")
            return True
    return False


def install_gcc():
    """Устанавливает пакет gcc через Piston API."""
    print("📦 Установка пакета gcc в Piston...")
    payload = json.dumps({"language": "gcc", "version": "*"}).encode()
    req = urllib.request.Request(
        f"{PISTON_URL}/api/v2/packages",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
            print(f"✅ gcc установлен: {result}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Ошибка установки gcc: {e.code} — {body}")
        sys.exit(1)


def verify_cpp():
    """Проверяет, что C++ код компилируется и запускается."""
    print("🧪 Проверка: компиляция и запуск C++ кода...")
    payload = json.dumps({
        "language": "c++",
        "version": "*",
        "files": [{"name": "main.cpp", "content": '#include <iostream>\nint main() { std::cout << "OK"; return 0; }'}],
        "stdin": "",
    }).encode()
    req = urllib.request.Request(
        f"{PISTON_URL}/api/v2/execute",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            run_output = result.get("run", {}).get("stdout", "").strip()
            if run_output == "OK":
                print("✅ C++ работает корректно!")
            else:
                print(f"⚠️  Неожиданный вывод: {run_output}")
                print(f"   Полный ответ: {json.dumps(result, indent=2)}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Ошибка выполнения: {e.code} — {body}")
        sys.exit(1)


def main():
    runtimes = wait_for_piston()
    if not check_gcc_installed(runtimes):
        install_gcc()
        # Повторно проверяем список рантаймов
        time.sleep(2)
        req = urllib.request.Request(f"{PISTON_URL}/api/v2/runtimes")
        with urllib.request.urlopen(req, timeout=5) as resp:
            runtimes = json.loads(resp.read().decode())
        if not check_gcc_installed(runtimes):
            print("⚠️  gcc не появился в списке рантаймов, но установка прошла успешно.")
            print("   Попробуйте перезапустить контейнер: docker compose restart piston")
    verify_cpp()
    print("\n🎉 Piston готов к работе!")


if __name__ == "__main__":
    main()
