import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchProblem, submitCode, requestHint, fetchTracks } from "./api";
import type {
  Problem,
  SubmitResponse,
  HintResponse,
  HintRequest,
  Track,
} from "./api";
import CodeEditor from "./components/CodeEditor";
import ProblemPanel from "./components/ProblemPanel";
import ResultsPanel from "./components/ResultsPanel";
import NavigationSidebar from "./components/NavigationSidebar";

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeProblemId, setActiveProblemId] = useState<number>(1);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Сайдбар каталога
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ИИ-подсказки
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [goToLine, setGoToLine] = useState<number | null>(null);

  // Загрузка дерева треков
  const loadTracks = useCallback(async () => {
    try {
      const data = await fetchTracks();
      setTracks(data);
    } catch (e) {
      console.error("Не удалось загрузить треки:", e);
    }
  }, []);

  // Загрузка конкретной задачи
  const loadProblem = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setHint(null);
    setHintError(null);
    try {
      const p = await fetchProblem(id);
      setProblem(p);
      setActiveProblemId(id);
      setCode(p.starterCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки задачи");
    } finally {
      setLoading(false);
    }
  }, []);

  // Начальная инициализация
  useEffect(() => {
    loadTracks();
    loadProblem(1);
  }, [loadTracks, loadProblem]);

  // Подсчёт общего прогресса (решено / всего)
  const stats = useMemo(() => {
    let solved = 0;
    let total = 0;
    for (const track of tracks) {
      for (const topic of track.topics) {
        for (const prob of topic.problems) {
          total++;
          if (prob.status === "solved") solved++;
        }
      }
    }
    return { solved, total };
  }, [tracks]);

  // Автоматический запрос подсказки уровня 1 при неуспешном результате
  const fetchHint = useCallback(
    async (
      res: SubmitResponse,
      currentCode: string,
      level: number = 1
    ) => {
      if (!problem) return;
      if (res.status === "accepted") return;

      setHintLoading(true);
      setHintError(null);

      const req: HintRequest = {
        problemId: problem.id,
        code: currentCode,
        level,
        status: res.status,
      };

      if (res.status === "compile_error" && res.compileOutput) {
        req.compileStderr = res.compileOutput;
      }

      // Первый непройденный тест
      const failedTest = res.tests.find((t) => !t.passed);
      if (failedTest) {
        req.failedTest = {
          input: failedTest.input,
          expected: failedTest.expected,
          actual: failedTest.actual,
          stderr: failedTest.stderr,
          isHidden: failedTest.isHidden,
        };
      }

      try {
        const h = await requestHint(req);
        setHint(h);
      } catch (e) {
        setHintError(e instanceof Error ? e.message : "Ошибка ИИ-наставника");
      } finally {
        setHintLoading(false);
      }
    },
    [problem]
  );

  const handleSubmit = async () => {
    if (!problem) return;
    setLoading(true);
    setResult(null);
    setHint(null);
    setHintError(null);
    setError(null);
    try {
      const res = await submitCode(problem.id, code);
      setResult(res);

      // Обновляем дерево треков, чтобы статус задачи (attempted/solved) обновился сразу
      loadTracks();

      // Автоматически запрашиваем подсказку уровня 1
      if (res.status !== "accepted") {
        fetchHint(res, code, 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleEscalateHint = () => {
    if (!result || !hint || !hint.canEscalate) return;
    fetchHint(result, code, hint.level + 1);
  };

  // Сброс подсветки при редактировании кода
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (hint) {
      setHint(null);
    }
  };

  const handleGoToLine = (line: number) => {
    setGoToLine(line);
  };

  if (error && !problem) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1a2e]">
        <div className="bg-rose-900/40 border border-rose-800 text-rose-200 p-6 rounded-xl max-w-md shadow-lg">
          <h2 className="text-xl font-bold mb-2">Ошибка подключения к серверу</h2>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => loadProblem(activeProblemId)}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-white font-medium text-sm transition-colors"
          >
            Повторить попытку
          </button>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1a2e]">
        <div className="flex items-center gap-3 text-indigo-300 font-medium">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full" />
          Загрузка платформы SchoolLeetCode...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1a1a2e]">
      {/* Сайдбар навигации по курсам */}
      <NavigationSidebar
        tracks={tracks}
        activeProblemId={activeProblemId}
        onSelectProblem={(id) => loadProblem(id)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Header */}
      <header className="bg-[#12192f] border-b border-[#1f2d4e] px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          {/* Кнопка открытия каталога */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#2d3748] text-gray-200 text-xs font-semibold border border-gray-700/60 transition-all active:scale-95 shadow-sm"
          >
            <span>📚</span>
            <span>Каталог задач</span>
            {stats.total > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 text-[10px] border border-indigo-700/50">
                {stats.solved}/{stats.total}
              </span>
            )}
          </button>

          {/* Хлебные крошки */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
            <span>/</span>
            <span className="text-gray-300 font-medium truncate max-w-[200px]">
              {problem.trackTitle || problem.grade}
            </span>
            <span>/</span>
            <span className="text-white font-semibold truncate max-w-[200px]">
              {problem.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            🎓 SchoolLeetCode
          </h1>
        </div>
      </header>

      {/* Main content: двухколоночный интерфейс */}
      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель: Условие / Теория + Панель результатов */}
        <div className="w-1/2 flex flex-col border-r border-[#1f2d4e] overflow-hidden bg-[#12192f]/40">
          <div className="flex-1 overflow-hidden">
            <ProblemPanel problem={problem} />
          </div>
          <ResultsPanel
            result={result}
            loading={loading}
            error={error}
            hint={hint}
            hintLoading={hintLoading}
            hintError={hintError}
            onEscalateHint={handleEscalateHint}
            onGoToLine={handleGoToLine}
          />
        </div>

        {/* Правая панель: Редактор кода Monaco + Кнопка проверки */}
        <div className="w-1/2 flex flex-col bg-[#0d1117]">
          <CodeEditor
            code={code}
            onChange={handleCodeChange}
            highlightLines={
              hint
                ? {
                    start: hint.lineStart,
                    end: hint.lineEnd,
                    hintText: hint.hintText,
                  }
                : null
            }
            goToLine={goToLine}
            onGoToLineHandled={() => setGoToLine(null)}
          />
          <div className="p-3 bg-[#12192f] border-t border-[#1f2d4e] shrink-0 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              C++ 10.2 (GCC / Piston Sandbox)
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="py-2 px-6 rounded-lg font-semibold text-xs text-white transition-all shadow-md
                         bg-gradient-to-r from-emerald-600 to-teal-600
                         hover:from-emerald-500 hover:to-teal-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         active:scale-[0.98]"
            >
              {loading ? "⏳ Проверяю..." : "▶ Проверить решение"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
