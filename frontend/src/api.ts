const API_BASE = "http://localhost:8000/api";

const STUDENT_KEY_STORAGE = "school_leetcode_student_key";
const TEACHER_KEY_STORAGE = "school_leetcode_teacher_key";

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

export function getTeacherKey(): string | null {
  return localStorage.getItem(TEACHER_KEY_STORAGE);
}

export function setTeacherKey(key: string): void {
  localStorage.setItem(TEACHER_KEY_STORAGE, key.trim());
}

export function clearTeacherKey(): void {
  localStorage.removeItem(TEACHER_KEY_STORAGE);
}

function getHeaders(extraHeaders: Record<string, string> = {}): HeadersInit {
  return {
    "X-Student-Key": getStudentKey(),
    ...extraHeaders,
  };
}

function getTeacherHeaders(teacherKey: string, extraHeaders: Record<string, string> = {}): HeadersInit {
  return {
    "X-Teacher-Key": teacherKey,
    ...extraHeaders,
  };
}

async function extractErrorMessage(resp: Response, fallback: string): Promise<string> {
  try {
    const data = await resp.json();
    if (data && data.detail) {
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail) && data.detail[0]?.msg) return String(data.detail[0].msg);
    }
  } catch {
    // ignore
  }
  return `${fallback} (${resp.status})`;
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

// --- Типы групп и ДЗ ученика (Срез 4: Ученик) ---

export interface GroupJoinResponse {
  groupId: number;
  groupName: string;
  inviteCode: string;
  studentName: string;
}

export interface StudentAssignmentProblem {
  id: number;
  title: string;
  difficulty: "easy" | "medium" | "hard" | string;
  status: "solved" | "attempted" | "not_started";
}

export interface StudentAssignment {
  id: number;
  title: string;
  problems: StudentAssignmentProblem[];
}

export interface StudentGroupOut {
  groupId: number;
  groupName: string;
  inviteCode: string;
  studentName: string;
  assignments: StudentAssignment[];
}

// --- Типы кабинета преподавателя (Срез 4: Преподаватель) ---

export interface TeacherVerifyResponse {
  ok: boolean;
}

export interface TeacherGroupListItem {
  id: number;
  name: string;
  inviteCode: string;
  studentCount: number;
  assignmentCount: number;
  createdAt: string;
}

export interface TeacherAssignmentProblemOut {
  id: number;
  title: string;
  difficulty: string;
}

export interface TeacherAssignmentOut {
  id: number;
  title: string;
  problems: TeacherAssignmentProblemOut[];
}

export interface StudentProblemProgress {
  problemId: number;
  status: "solved" | "attempted" | "not_started";
  attempts: number;
  lastStatus: string | null;
}

export interface TeacherStudentProgress {
  studentKey: string;
  studentName: string;
  solvedCount: number;
  totalAttempts: number;
  progress: StudentProblemProgress[];
}

export interface GroupBrief {
  id: number;
  name: string;
  inviteCode: string;
}

export interface TeacherGroupDetailResponse {
  group: GroupBrief;
  assignments: TeacherAssignmentOut[];
  problems: TeacherAssignmentProblemOut[];
  students: TeacherStudentProgress[];
}

export interface CommonMistakeItem {
  title: string;
  description: string;
  affectedStudentsCount: number;
  recommendation: string;
}

export interface TeacherAiSummaryResponse {
  overallSummary: string;
  commonMistakes: CommonMistakeItem[];
  analyzedSubmissionsCount: number;
  analyzedStudentsCount: number;
}

// --- API-вызовы ученика для групп (Срез 4) ---

export async function joinGroup(inviteCode: string, studentName: string): Promise<GroupJoinResponse> {
  const resp = await fetch(`${API_BASE}/groups/join`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ inviteCode, studentName }),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Не удалось вступить в группу");
    throw new Error(errorMsg);
  }
  return resp.json();
}

export async function fetchMyGroups(): Promise<StudentGroupOut[]> {
  const resp = await fetch(`${API_BASE}/groups/my`, {
    headers: getHeaders(),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Ошибка загрузки списка групп");
    throw new Error(errorMsg);
  }
  return resp.json();
}

// --- API-вызовы кабинета преподавателя (Срез 4) ---

export async function verifyTeacherKey(teacherKey: string): Promise<TeacherVerifyResponse> {
  const resp = await fetch(`${API_BASE}/teacher/verify`, {
    method: "POST",
    headers: getTeacherHeaders(teacherKey),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Неверный ключ доступа преподавателя");
    throw new Error(errorMsg);
  }
  return resp.json();
}

export async function fetchTeacherGroups(teacherKey: string): Promise<TeacherGroupListItem[]> {
  const resp = await fetch(`${API_BASE}/teacher/groups`, {
    headers: getTeacherHeaders(teacherKey),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Ошибка загрузки групп преподавателя");
    throw new Error(errorMsg);
  }
  return resp.json();
}

export async function createTeacherGroup(teacherKey: string, name: string): Promise<TeacherGroupListItem> {
  const resp = await fetch(`${API_BASE}/teacher/groups`, {
    method: "POST",
    headers: getTeacherHeaders(teacherKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Ошибка создания группы");
    throw new Error(errorMsg);
  }
  return resp.json();
}

export async function fetchTeacherGroupDetail(
  teacherKey: string,
  groupId: number
): Promise<TeacherGroupDetailResponse> {
  const resp = await fetch(`${API_BASE}/teacher/groups/${groupId}`, {
    headers: getTeacherHeaders(teacherKey),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Ошибка загрузки деталей группы");
    throw new Error(errorMsg);
  }
  return resp.json();
}

export async function createAssignment(
  teacherKey: string,
  groupId: number,
  title: string,
  problemIds: number[]
): Promise<TeacherAssignmentOut> {
  const resp = await fetch(`${API_BASE}/teacher/groups/${groupId}/assignments`, {
    method: "POST",
    headers: getTeacherHeaders(teacherKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title, problemIds }),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Ошибка создания задания");
    throw new Error(errorMsg);
  }
  return resp.json();
}

export async function fetchTeacherAiSummary(
  teacherKey: string,
  groupId: number,
  problemId: number | null
): Promise<TeacherAiSummaryResponse> {
  const resp = await fetch(`${API_BASE}/teacher/groups/${groupId}/ai-summary`, {
    method: "POST",
    headers: getTeacherHeaders(teacherKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ problemId }),
  });
  if (!resp.ok) {
    const errorMsg = await extractErrorMessage(resp, "Ошибка формирования ИИ-аналитики");
    throw new Error(errorMsg);
  }
  return resp.json();
}
