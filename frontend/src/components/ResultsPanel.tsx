import type { SubmitResponse, HintResponse } from "../api";

interface Props {
  result: SubmitResponse | null;
  loading: boolean;
  error: string | null;
  hint: HintResponse | null;
  hintLoading: boolean;
  hintError: string | null;
  onEscalateHint: () => void;
  onGoToLine: (line: number) => void;
}

const errorTypeBadges: Record<string, { label: string; color: string }> = {
  syntax: { label: "Синтаксис", color: "bg-orange-800 text-orange-200" },
  logic: { label: "Логика", color: "bg-blue-800 text-blue-200" },
  edge_case: {
    label: "Граничный случай",
    color: "bg-purple-800 text-purple-200",
  },
  runtime: {
    label: "Ошибка выполнения",
    color: "bg-red-800 text-red-200",
  },
};

export default function ResultsPanel({
  result,
  loading,
  error,
  hint,
  hintLoading,
  hintError,
  onEscalateHint,
  onGoToLine,
}: Props) {
  if (loading) {
    return (
      <div className="p-5 border-t border-[#0f3460] bg-[#12192f]/50">
        <div className="flex items-center gap-3 text-indigo-300 font-medium">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full" />
          Компиляция и тестирование в песочнице Piston...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 border-t border-[#0f3460]">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const statusColors: Record<string, string> = {
    accepted: "text-emerald-400",
    wrong_answer: "text-rose-400",
    compile_error: "text-amber-400",
    runtime_error: "text-rose-400",
  };

  const statusLabels: Record<string, string> = {
    accepted: "✅ Все тесты пройдены!",
    wrong_answer: "❌ Неправильный ответ",
    compile_error: "⚠️ Ошибка компиляции",
    runtime_error: "💥 Ошибка выполнения",
  };

  const escalateLabels: Record<number, string> = {
    1: "🔍 Подсказать точнее",
    2: "📖 Разобрать концепцию",
  };

  return (
    <div className="p-5 border-t border-[#0f3460] bg-[#12192f]/30 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-bold ${statusColors[result.status] ?? "text-gray-400"}`}>
          {statusLabels[result.status] ?? result.status}
        </h3>
        {result.totalCount > 0 && (
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#16213e] border border-[#1f2d4e] text-gray-300">
            Пройдено: {result.passedCount} / {result.totalCount}
          </span>
        )}
      </div>

      {/* Ошибка компиляции */}
      {result.status === "compile_error" && result.compileOutput && (
        <pre className="bg-[#0d1117] border border-orange-900 rounded-lg p-3 text-orange-300 text-xs overflow-x-auto whitespace-pre-wrap mb-3 font-mono">
          {result.compileOutput}
        </pre>
      )}

      {/* Результаты тестов */}
      {result.tests.length > 0 && (
        <div className="space-y-2 mb-4">
          {result.tests.map((t, i) => {
            // 1. Отображение скрытого теста
            if (t.isHidden) {
              return (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-sm font-mono border flex flex-col gap-1.5 transition-all ${
                    t.passed
                      ? "bg-emerald-950/20 border-emerald-800/60 text-emerald-300"
                      : "bg-rose-950/20 border-rose-800/60 text-rose-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{t.passed ? "✅" : "❌"}</span>
                      <span className="font-semibold text-xs tracking-wide">
                        🔒 Скрытый тест #{i + 1}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#0d1117]/60 border border-gray-700/50">
                      {t.passed ? "Пройден" : "Не пройден"}
                    </span>
                  </div>
                  {t.stderr && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded mt-1 border border-rose-900/50">
                      <span className="font-bold">Stderr: </span>
                      {t.stderr}
                    </div>
                  )}
                </div>
              );
            }

            // 2. Отображение видимого теста
            return (
              <div
                key={i}
                className={`rounded-lg p-3 text-sm font-mono border ${
                  t.passed
                    ? "bg-emerald-950/20 border-emerald-800/60"
                    : "bg-rose-950/20 border-rose-800/60"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`font-bold text-xs ${t.passed ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {t.passed ? "✅" : "❌"} Открытый тест #{i + 1}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div>
                    <span className="text-gray-500">Ввод: </span>
                    <span className="text-gray-300">{t.input}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ожидалось: </span>
                    <span className="text-emerald-300">{t.expected}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Получено: </span>
                    <span className={t.passed ? "text-emerald-300" : "text-rose-300"}>
                      {t.actual || "(пусто)"}
                    </span>
                  </div>
                  {t.stderr && (
                    <div>
                      <span className="text-gray-500">Stderr: </span>
                      <span className="text-orange-300">{t.stderr}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ИИ-наставник */}
      {result.status !== "accepted" && (
        <div className="bg-[#1e1e3f] border border-[#3b3b6d] rounded-lg p-4 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <h4 className="text-sm font-bold text-indigo-300">
              ИИ-наставник
            </h4>
            {hint && (
              <span className="text-xs text-gray-500 ml-auto">
                Уровень {hint.level}/3
              </span>
            )}
          </div>

          {hintLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full" />
              Анализирую код...
            </div>
          )}

          {hintError && (
            <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded p-2">
              {hintError}
            </div>
          )}

          {hint && !hintLoading && (
            <div className="space-y-2.5">
              {/* Бейдж типа ошибки + ссылка на строки */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    errorTypeBadges[hint.errorType]?.color ??
                    "bg-gray-700 text-gray-300"
                  }`}
                >
                  {errorTypeBadges[hint.errorType]?.label ?? hint.errorType}
                </span>
                <button
                  onClick={() => onGoToLine(hint.lineStart)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                >
                  {hint.lineStart === hint.lineEnd
                    ? `Строка ${hint.lineStart}`
                    : `Строки ${hint.lineStart}–${hint.lineEnd}`}
                </button>
              </div>

              {/* Текст подсказки */}
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">
                {hint.hintText}
              </p>

              {/* Кнопка следующего уровня */}
              {hint.canEscalate && (
                <button
                  onClick={onEscalateHint}
                  className="text-sm px-3 py-1.5 rounded-md font-medium transition-all
                             bg-indigo-900/50 text-indigo-300 border border-indigo-700
                             hover:bg-indigo-800/60 hover:text-indigo-200
                             active:scale-[0.98]"
                >
                  {escalateLabels[hint.level] ?? "Следующий уровень"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
