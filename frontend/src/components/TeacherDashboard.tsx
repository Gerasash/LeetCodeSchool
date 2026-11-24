import { useState, useEffect, useCallback } from "react";
import {
  getTeacherKey,
  setTeacherKey,
  clearTeacherKey,
  verifyTeacherKey,
  fetchTeacherGroups,
  createTeacherGroup,
  fetchTeacherGroupDetail,
  createAssignment,
  fetchTeacherAiSummary,
} from "../api";
import type {
  Track,
  TeacherGroupListItem,
  TeacherGroupDetailResponse,
  TeacherAiSummaryResponse,
} from "../api";

interface Props {
  tracks: Track[];
  onExitToProblems: () => void;
}

const diffDots: Record<string, string> = {
  easy: "bg-emerald-400",
  medium: "bg-amber-400",
  hard: "bg-rose-400",
};

export default function TeacherDashboard({ tracks, onExitToProblems }: Props) {
  // Авторизация
  const [teacherKey, setLocalTeacherKey] = useState<string | null>(() => getTeacherKey());
  const [isVerified, setIsVerified] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Данные групп
  const [groups, setGroups] = useState<TeacherGroupListItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupDetail, setGroupDetail] = useState<TeacherGroupDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Вкладка правой области
  const [activeTab, setActiveTab] = useState<"progress" | "assignments" | "ai">("progress");

  // Создание новой группы
  const [newGroupName, setNewGroupName] = useState("");
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  // Создание задания (ДЗ)
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [selectedProblemIds, setSelectedProblemIds] = useState<number[]>([]);
  const [createAssignmentLoading, setCreateAssignmentLoading] = useState(false);
  const [createAssignmentError, setCreateAssignmentError] = useState<string | null>(null);

  // ИИ-аналитика
  const [aiProblemId, setAiProblemId] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState<TeacherAiSummaryResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Буфер обмена
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Загрузка деталей выбранной группы
  const loadGroupDetail = useCallback(async (key: string, groupId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await fetchTeacherGroupDetail(key, groupId);
      setGroupDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Ошибка загрузки карточки группы");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Загрузка списка групп
  const loadGroups = useCallback(async (key: string, autoSelectFirst = true) => {
    setGroupsLoading(true);
    try {
      const list = await fetchTeacherGroups(key);
      setGroups(list);
      if (autoSelectFirst && list.length > 0) {
        setSelectedGroupId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0].id));
      }
    } catch (err) {
      console.error("Ошибка загрузки групп:", err);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  // Первоначальная проверка сохранённого ключа
  useEffect(() => {
    const key = getTeacherKey();
    if (!key) return;

    let isMounted = true;
    verifyTeacherKey(key)
      .then(() => {
        if (!isMounted) return;
        setIsVerified(true);
        loadGroups(key);
      })
      .catch(() => {
        if (!isMounted) return;
        clearTeacherKey();
        setLocalTeacherKey(null);
        setIsVerified(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadGroups]);

  // Загрузка деталей при смене выбранной группы
  useEffect(() => {
    if (isVerified && teacherKey && selectedGroupId) {
      loadGroupDetail(teacherKey, selectedGroupId);
      // Сбрасываем ИИ-сводку при смене группы
      setAiSummary(null);
      setAiError(null);
      setAiProblemId(null);
    }
  }, [isVerified, teacherKey, selectedGroupId, loadGroupDetail]);

  // Вход по ключу
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = inputKey.trim();
    if (!trimmedKey) {
      setAuthError("Введите ключ доступа преподавателя");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      await verifyTeacherKey(trimmedKey);
      setTeacherKey(trimmedKey);
      setLocalTeacherKey(trimmedKey);
      setIsVerified(true);
      setInputKey("");
      await loadGroups(trimmedKey);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Неверный ключ доступа");
    } finally {
      setAuthLoading(false);
    }
  };

  // Выход
  const handleLogout = () => {
    clearTeacherKey();
    setLocalTeacherKey(null);
    setIsVerified(false);
    setGroups([]);
    setSelectedGroupId(null);
    setGroupDetail(null);
    setAiSummary(null);
  };

  // Создание группы
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherKey) return;
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      setCreateGroupError("Укажите название группы");
      return;
    }

    setCreateGroupLoading(true);
    setCreateGroupError(null);
    try {
      const created = await createTeacherGroup(teacherKey, trimmedName);
      setNewGroupName("");
      await loadGroups(teacherKey, false);
      setSelectedGroupId(created.id);
    } catch (err) {
      setCreateGroupError(err instanceof Error ? err.message : "Ошибка создания группы");
    } finally {
      setCreateGroupLoading(false);
    }
  };

  // Копирование кода приглашения
  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Переключение выбора задачи для нового ДЗ
  const toggleProblemSelection = (probId: number) => {
    setSelectedProblemIds((prev) =>
      prev.includes(probId) ? prev.filter((id) => id !== probId) : [...prev, probId]
    );
  };

  // Создание задания (ДЗ)
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherKey || !selectedGroupId) return;
    const title = newAssignmentTitle.trim();
    if (!title) {
      setCreateAssignmentError("Укажите название задания");
      return;
    }
    if (selectedProblemIds.length === 0) {
      setCreateAssignmentError("Выберите хотя бы одну задачу");
      return;
    }

    setCreateAssignmentLoading(true);
    setCreateAssignmentError(null);
    try {
      await createAssignment(teacherKey, selectedGroupId, title, selectedProblemIds);
      setNewAssignmentTitle("");
      setSelectedProblemIds([]);
      // Перезагружаем детали группы и счётчики групп
      await loadGroupDetail(teacherKey, selectedGroupId);
      await loadGroups(teacherKey, false);
    } catch (err) {
      setCreateAssignmentError(err instanceof Error ? err.message : "Ошибка выдачи задания");
    } finally {
      setCreateAssignmentLoading(false);
    }
  };

  // Запрос ИИ-сводки
  const handleRequestAiSummary = async () => {
    if (!teacherKey || !selectedGroupId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetchTeacherAiSummary(teacherKey, selectedGroupId, aiProblemId);
      setAiSummary(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Не удалось сформировать ИИ-сводку");
    } finally {
      setAiLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Экран 1: Форма входа (если не авторизован)
  // ---------------------------------------------------------------------------
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#12192f] border border-[#1f2d4e] rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="text-center space-y-1.5">
            <div className="text-4xl">👨‍🏫</div>
            <h1 className="text-xl font-bold text-white">Кабинет преподавателя</h1>
            <p className="text-xs text-gray-400">
              Управление учебными группами, выдача заданий и аналитика ошибок учеников через DeepSeek
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Ключ доступа преподавателя
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Введите ключ (например, teacher123)"
                  className="w-full px-3 py-2 pr-10 rounded-xl bg-[#0f172a] border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs px-1"
                  title={showPassword ? "Скрыть" : "Показать"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs leading-snug">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Проверка ключа...</span>
                </>
              ) : (
                <span>Войти в кабинет</span>
              )}
            </button>

            <div className="pt-2 border-t border-[#1f2d4e]/70 flex items-center justify-between text-xs">
              <span className="text-gray-500 text-[11px]">
                💡 Ключ по умолчанию: <code className="text-indigo-400 font-mono">teacher123</code>
              </span>
              <button
                type="button"
                onClick={onExitToProblems}
                className="text-gray-400 hover:text-white transition-colors text-[11px]"
              >
                ← К задачам
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Экран 2: Основной кабинет преподавателя
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col bg-[#1a1a2e]">
      {/* Шапка кабинета */}
      <header className="bg-[#12192f] border-b border-[#1f2d4e] px-5 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="text-2xl">👨‍🏫</div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Кабинет преподавателя</span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                SchoolLeetCode
              </span>
            </h1>
            <div className="text-[11px] text-gray-400">
              Управление группами · Матрица успеваемости · ИИ-анализ ошибок DeepSeek
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onExitToProblems}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#2d3748] text-gray-200 text-xs font-semibold border border-gray-700/60 transition-all active:scale-95"
          >
            <span>←</span>
            <span>К задачам</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 text-xs font-semibold border border-rose-800/60 transition-all active:scale-95"
            title="Выйти из кабинета"
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Двухколоночный макет */}
      <div className="flex flex-1 overflow-hidden">
        {/* Левая колонка: Учебные группы */}
        <div className="w-80 border-r border-[#1f2d4e] bg-[#12192f]/70 flex flex-col shrink-0">
          {/* Создание новой группы */}
          <div className="p-3.5 border-b border-[#1f2d4e] bg-[#16213e]/60">
            <form onSubmit={handleCreateGroup} className="space-y-2">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <span>➕</span>
                <span>Новая группа</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="напр. 10А класс"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0d1326] border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={createGroupLoading}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  {createGroupLoading ? "..." : "Создать"}
                </button>
              </div>
              {createGroupError && (
                <div className="text-[11px] text-rose-300 bg-rose-950/50 p-1.5 rounded border border-rose-800">
                  {createGroupError}
                </div>
              )}
            </form>
          </div>

          {/* Список групп */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
              Группы ({groups.length})
            </div>

            {groupsLoading ? (
              <div className="text-center py-8 text-xs text-gray-400">
                <span className="inline-block animate-spin mr-1.5">⏳</span>
                Загрузка групп...
              </div>
            ) : groups.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-700 bg-gray-900/30 text-center text-xs text-gray-400">
                Групп пока нет. Создайте первую группу в форме выше.
              </div>
            ) : (
              groups.map((g) => {
                const isSelected = selectedGroupId === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-950/50 border-indigo-500 shadow-md"
                        : "bg-[#16213e]/40 border-[#23355e] hover:bg-[#16213e] hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="font-bold text-white text-xs truncate">{g.name}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyInviteCode(g.inviteCode);
                        }}
                        className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 hover:text-white font-mono text-[10px] border border-indigo-800 hover:border-indigo-600 shrink-0 flex items-center gap-1 transition-colors"
                        title="Скопировать инвайт-код для учеников"
                      >
                        <span>{copiedCode === g.inviteCode ? "✓ Скопировано!" : g.inviteCode}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span>👥 {g.studentCount} уч.</span>
                      <span>·</span>
                      <span>📝 {g.assignmentCount} ДЗ</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Правая рабочая область: Выбранная группа */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
          {detailLoading && !groupDetail ? (
            <div className="flex-1 flex items-center justify-center text-indigo-300 text-sm">
              <span className="animate-spin mr-2">⏳</span>
              Загрузка карточки группы...
            </div>
          ) : detailError ? (
            <div className="p-6 text-rose-300 text-sm">{detailError}</div>
          ) : !groupDetail ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Выберите группу из списка слева
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Шапка выбранной группы */}
              <div className="p-4 border-b border-[#1f2d4e] bg-[#12192f] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{groupDetail.group.name}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyInviteCode(groupDetail.group.inviteCode)}
                        className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 hover:text-white font-mono text-xs border border-indigo-700/60 flex items-center gap-1.5 transition-colors"
                        title="Скопировать код для учеников"
                      >
                        <span>Код: {groupDetail.group.inviteCode}</span>
                        <span className="text-[10px]">
                          {copiedCode === groupDetail.group.inviteCode ? "✓" : "📋"}
                        </span>
                      </button>
                    </h2>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Учеников: {groupDetail.students.length} · Заданий: {groupDetail.assignments.length} · Уникальных задач: {groupDetail.problems.length}
                    </div>
                  </div>
                </div>

                {/* Переключатель вкладок */}
                <div className="flex items-center gap-1 bg-[#1e293b] p-1 rounded-xl border border-gray-700/60 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("progress")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === "progress"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    📊 Успеваемость
                  </button>
                  <button
                    onClick={() => setActiveTab("assignments")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === "assignments"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    📝 Задания (ДЗ)
                  </button>
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === "ai"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🤖 ИИ-аналитика ошибок
                  </button>
                </div>
              </div>

              {/* Содержимое вкладки 1: Матрица успеваемости */}
              {activeTab === "progress" && (
                <div className="flex-1 overflow-auto p-4">
                  {groupDetail.students.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-gray-700 bg-[#12192f]/40 text-center max-w-lg mx-auto my-12 space-y-2">
                      <div className="text-3xl">👥</div>
                      <div className="font-bold text-white text-sm">В группе пока нет учеников</div>
                      <p className="text-xs text-gray-400">
                        Поделитесь кодом приглашения{" "}
                        <span className="font-mono text-indigo-400 font-bold bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800">
                          {groupDetail.group.inviteCode}
                        </span>{" "}
                        с учениками. Они смогут вступить в группу через кнопку «📚 Каталог задач» → «📋 Мои задания».
                      </p>
                    </div>
                  ) : groupDetail.problems.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-gray-700 bg-[#12192f]/40 text-center max-w-lg mx-auto my-12 space-y-2">
                      <div className="text-3xl">📝</div>
                      <div className="font-bold text-white text-sm">В группе пока нет заданий</div>
                      <p className="text-xs text-gray-400">
                        Перейдите во вкладку «📝 Задания (ДЗ)» выше и выдайте первое домашнее задание с задачами из каталога.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-[#1f2d4e] rounded-xl overflow-hidden bg-[#12192f]/50 shadow-md">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#16213e] border-b border-[#1f2d4e] text-gray-300">
                            <th className="p-3 font-semibold min-w-[180px]">Ученик</th>
                            <th className="p-3 font-semibold w-28 text-center">Решено</th>
                            {groupDetail.problems.map((p) => (
                              <th
                                key={p.id}
                                className="p-3 font-semibold text-center border-l border-[#1f2d4e]/70 min-w-[110px]"
                                title={p.title}
                              >
                                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                  <span
                                    className={`w-2 h-2 rounded-full ${diffDots[p.difficulty] ?? diffDots.easy}`}
                                  />
                                  <span className="font-mono text-[11px]">#{p.id}</span>
                                </div>
                                <div className="truncate max-w-[120px] text-[11px] text-gray-400 font-normal">
                                  {p.title}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f2d4e]/60">
                          {groupDetail.students.map((st) => (
                            <tr key={st.studentKey} className="hover:bg-[#16213e]/30 transition-colors">
                              <td className="p-3">
                                <div className="font-semibold text-white">{st.studentName}</div>
                                <div className="text-[10px] text-gray-500 font-mono">
                                  {st.studentKey}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-bold text-xs border border-indigo-800/60">
                                  {st.solvedCount} / {groupDetail.problems.length}
                                </span>
                              </td>
                              {groupDetail.problems.map((prob) => {
                                const prog = st.progress.find((p) => p.problemId === prob.id);
                                const status = prog ? prog.status : "not_started";
                                const attempts = prog ? prog.attempts : 0;
                                const lastStatus = prog?.lastStatus;

                                return (
                                  <td
                                    key={prob.id}
                                    className="p-3 text-center border-l border-[#1f2d4e]/60"
                                  >
                                    {status === "solved" ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 font-semibold text-[11px]"
                                        title={`Решено! Попыток: ${attempts}`}
                                      >
                                        <span>✓</span>
                                        <span className="text-[10px] opacity-75">({attempts})</span>
                                      </span>
                                    ) : status === "attempted" ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-950/70 text-rose-300 border border-rose-600/60 font-semibold text-[11px]"
                                        title={`Были попытки (${attempts}). Последний статус: ${lastStatus}`}
                                      >
                                        <span>✗</span>
                                        <span className="text-[10px] opacity-75">({attempts})</span>
                                      </span>
                                    ) : (
                                      <span className="text-gray-600 font-bold text-sm">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Содержимое вкладки 2: Задания (ДЗ) */}
              {activeTab === "assignments" && (
                <div className="flex-1 overflow-auto p-4 space-y-6">
                  {/* Форма создания задания */}
                  <form
                    onSubmit={handleCreateAssignment}
                    className="p-4 rounded-xl bg-[#12192f] border border-[#1f2d4e] shadow-md space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>➕</span>
                        <span>Выдать новое задание</span>
                      </div>
                      <div className="text-xs text-indigo-300">
                        Выбрано задач: <span className="font-bold">{selectedProblemIds.length}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Название задания (например, Домашняя работа №2: Поиск в массиве)
                      </label>
                      <input
                        type="text"
                        value={newAssignmentTitle}
                        onChange={(e) => setNewAssignmentTitle(e.target.value)}
                        placeholder="Введите название задания"
                        className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Выбор задач из каталога */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">
                        Выберите задачи для включения в задание:
                      </label>
                      <div className="max-h-56 overflow-y-auto space-y-3 p-3 rounded-xl bg-[#0f172a] border border-gray-800">
                        {tracks.map((track) => (
                          <div key={track.id} className="space-y-1.5">
                            <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                              {track.title}
                            </div>
                            <div className="space-y-1 pl-2">
                              {track.topics.map((topic) => (
                                <div key={topic.id} className="space-y-1">
                                  <div className="text-[11px] text-gray-400 font-semibold">
                                    {topic.title}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                                    {topic.problems.map((prob) => {
                                      const isChecked = selectedProblemIds.includes(prob.id);
                                      return (
                                        <label
                                          key={prob.id}
                                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                                            isChecked
                                              ? "bg-indigo-950/70 border-indigo-500 text-white"
                                              : "bg-[#16213e]/40 border-gray-800 text-gray-300 hover:bg-[#16213e]"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleProblemSelection(prob.id)}
                                            className="rounded border-gray-700 text-indigo-600 focus:ring-0"
                                          />
                                          <span
                                            className={`w-2 h-2 rounded-full shrink-0 ${diffDots[prob.difficulty] ?? diffDots.easy}`}
                                          />
                                          <span className="truncate">{prob.title}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {createAssignmentError && (
                      <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                        {createAssignmentError}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={createAssignmentLoading || selectedProblemIds.length === 0}
                        className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm active:scale-95 flex items-center gap-2"
                      >
                        {createAssignmentLoading ? (
                          <>
                            <span className="inline-block animate-spin">⏳</span>
                            <span>Создание задания...</span>
                          </>
                        ) : (
                          <span>Создать задание</span>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Список уже созданных заданий */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Выданные задания группы ({groupDetail.assignments.length})
                    </div>

                    {groupDetail.assignments.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-gray-700 bg-[#12192f]/30 text-center text-xs text-gray-400">
                        В этой группе пока нет выданных заданий
                      </div>
                    ) : (
                      groupDetail.assignments.map((asgn) => (
                        <div
                          key={asgn.id}
                          className="p-4 rounded-xl bg-[#12192f] border border-[#1f2d4e] shadow-sm space-y-2.5"
                        >
                          <div className="flex items-center justify-between border-b border-[#1f2d4e] pb-2">
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>📝</span>
                              <span>{asgn.title}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-xs border border-indigo-800">
                              Задач: {asgn.problems.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {asgn.problems.map((prob) => (
                              <div
                                key={prob.id}
                                className="p-2 rounded-lg bg-[#0f172a] border border-gray-800 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${diffDots[prob.difficulty] ?? diffDots.easy}`}
                                  />
                                  <span className="text-gray-200 truncate">{prob.title}</span>
                                </div>
                                <span className="font-mono text-[10px] text-gray-500">#{prob.id}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Содержимое вкладки 3: ИИ-аналитика типичных ошибок */}
              {activeTab === "ai" && (
                <div className="flex-1 overflow-auto p-4 space-y-5">
                  {/* Панель управления аналитикой */}
                  <div className="p-4 rounded-xl bg-[#12192f] border border-[#1f2d4e] shadow-md flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🤖</div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          ИИ-анализ типичных ошибок группы
                        </div>
                        <div className="text-xs text-gray-400">
                          DeepSeek агрегирует неуспешные попытки, выделяет пробелы и даёт советы для урока
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <select
                        value={aiProblemId ?? ""}
                        onChange={(e) =>
                          setAiProblemId(e.target.value ? Number(e.target.value) : null)
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#0f172a] border border-gray-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Все задачи группы</option>
                        {groupDetail.problems.map((p) => (
                          <option key={p.id} value={p.id}>
                            Задача #{p.id}: {p.title}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={handleRequestAiSummary}
                        disabled={aiLoading}
                        className="py-1.5 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md active:scale-95 flex items-center gap-1.5"
                      >
                        {aiLoading ? (
                          <>
                            <span className="inline-block animate-spin">⏳</span>
                            <span>DeepSeek анализирует...</span>
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            <span>Сгенерировать ИИ-сводку</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Ошибка аналитики */}
                  {aiError && (
                    <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs space-y-1">
                      <div className="font-bold text-sm">Ошибка формирования аналитики</div>
                      <div>{aiError}</div>
                    </div>
                  )}

                  {/* Загрузка */}
                  {aiLoading && (
                    <div className="p-12 rounded-2xl border border-indigo-800/50 bg-indigo-950/20 text-center space-y-3">
                      <div className="text-3xl animate-bounce">🤖</div>
                      <div className="font-bold text-white text-sm">
                        DeepSeek анализирует код неуспешных решений...
                      </div>
                      <p className="text-xs text-gray-400 max-w-md mx-auto">
                        Изучаем паттерны ошибок компиляции, неправильных ответов и граничных условий без раскрытия персональных данных учеников.
                      </p>
                    </div>
                  )}

                  {/* Результат ИИ-аналитики */}
                  {!aiLoading && aiSummary && (
                    <div className="space-y-4">
                      {/* Карточка общего вывода */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-[#12192f] border border-indigo-700/50 shadow-md space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                            <span>📌</span>
                            <span>Общий педагогический вывод</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 text-xs border border-indigo-700/40">
                            Попыток: {aiSummary.analyzedSubmissionsCount} · Учеников: {aiSummary.analyzedStudentsCount}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">
                          {aiSummary.overallSummary}
                        </p>
                      </div>

                      {/* Список типичных ошибок */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Выявленные типичные ошибки ({aiSummary.commonMistakes.length})
                        </div>

                        {aiSummary.commonMistakes.length === 0 ? (
                          <div className="p-6 rounded-xl border border-dashed border-gray-700 bg-[#12192f]/40 text-center text-xs text-gray-400">
                            Системных типовых ошибок не выявлено! Ученики справляются с заданиями хорошо.
                          </div>
                        ) : (
                          aiSummary.commonMistakes.map((mistake, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-xl bg-[#12192f] border border-[#1f2d4e] shadow-sm space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-bold text-white text-sm flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 flex items-center justify-center text-xs">
                                    {idx + 1}
                                  </span>
                                  <span>{mistake.title}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 text-xs border border-rose-800 shrink-0">
                                  Затронуто: {mistake.affectedStudentsCount} уч.
                                </span>
                              </div>

                              <p className="text-xs text-gray-300 leading-relaxed">
                                {mistake.description}
                              </p>

                              {/* Блок методической рекомендации */}
                              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs leading-relaxed flex items-start gap-2">
                                <span className="text-base shrink-0">💡</span>
                                <div>
                                  <span className="font-bold">Что разобрать на уроке: </span>
                                  <span>{mistake.recommendation}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {!aiLoading && !aiSummary && !aiError && (
                    <div className="p-12 rounded-2xl border border-dashed border-gray-700 bg-[#12192f]/30 text-center space-y-2 max-w-md mx-auto my-8">
                      <div className="text-3xl">✨</div>
                      <div className="font-bold text-white text-sm">Сводка ещё не сгенерирована</div>
                      <p className="text-xs text-gray-400">
                        Нажмите кнопку «Сгенерировать ИИ-сводку» выше, чтобы запустить анализ ошибок решений группы через DeepSeek.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
