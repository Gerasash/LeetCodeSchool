const API_BASE = "http://localhost:8000/api";

const STUDENT_KEY_STORAGE = "school_leetcode_student_key";

/**
 * Получает или генерирует уникальный анонимный идентификатор ученика (UUID).
 */
export function getStudentKey(): string {
  let key = localStorage.getItem(STUDENT_KEY_STORAGE);
  if (!key) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      key = crypto.randomUUID();
    } else {
      key = "student-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem(STUDENT_KEY_STORAGE, key);
  }
  return key;
}

function getHeaders(extraHeaders: Record<string, string> = {}): HeadersInit {
  return {
    "X-Student-Key": getStudentKey(),
    ...extraHeaders,
  };
}

// --- Типы дерева треков (Срез 3) ---

export interface ProblemListItem {
  id: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  orderIndex: number;
  status: "solved" | "attempted" | "not_started";
}

export interface Topic {
  id: number;
  title: string;
  theoryMarkdown: string;
  orderIndex: number;
  problems: ProblemListItem[];
}

export interface Track {
  id: number;
  title: string;
  category: "school" | "university";
  orderIndex: number;
  topics: Topic[];
}

// --- Детальная задача ---

export interface Example {
  input: string;
  expectedOutput: string;
}

export interface Problem {
  id: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  starterCode: string;
  theoryMarkdown: string;
  trackTitle: string;
  grade: string;
  examples: Example[];
}

// --- Результаты тестирования ---

export interface TestResult {
  passed: boolean;
  isHidden: boolean;
  input: string | null;
  expected: string | null;
  actual: string | null;
  stderr: string;
}

export interface SubmitResponse {
  status: "accepted" | "wrong_answer" | "compile_error" | "runtime_error";
  compileOutput: string;
  tests: TestResult[];
  passedCount: number;
  totalCount: number;
}

// --- ИИ-подсказки ---

export interface FailedTestInfo {
  input?: string | null;
  expected?: string | null;
  actual?: string | null;
  stderr?: string;
  isHidden?: boolean;
}

export interface HintRequest {
  problemId: number;
  code: string;
  level: number;
  status: "compile_error" | "wrong_answer" | "runtime_error";
  compileStderr?: string;
  failedTest?: FailedTestInfo;
}

export interface HintResponse {
  lineStart: number;
  lineEnd: number;
  errorType: "syntax" | "logic" | "edge_case" | "runtime";
  hintText: string;
  level: number;
  canEscalate: boolean;
}

// --- API-вызовы ---

export async function fetchTracks(): Promise<Track[]> {
  const resp = await fetch(`${API_BASE}/tracks`, {
    headers: getHeaders(),
  });
  if (!resp.ok) throw new Error(`Ошибка загрузки треков: ${resp.status}`);
  return resp.json();
}

export async function fetchProblem(id: number): Promise<Problem> {
  const resp = await fetch(`${API_BASE}/problems/${id}`, {
    headers: getHeaders(),
  });
  if (!resp.ok) throw new Error(`Ошибка загрузки задачи: ${resp.status}`);
  return resp.json();
}

export async function submitCode(
  problemId: number,
  code: string
): Promise<SubmitResponse> {
  const resp = await fetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ problemId, code }),
  });
  if (!resp.ok) throw new Error(`Ошибка отправки: ${resp.status}`);
  return resp.json();
}

export async function requestHint(req: HintRequest): Promise<HintResponse> {
  const resp = await fetch(`${API_BASE}/hint`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(
      body.detail || `Ошибка получения подсказки: ${resp.status}`
    );
  }
  return resp.json();
}
