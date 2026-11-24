import { useState } from "react";
import type { Track, ProblemListItem, StudentGroupOut } from "../api";

interface Props {
  tracks: Track[];
  myGroups: StudentGroupOut[];
  activeProblemId: number;
  onSelectProblem: (id: number) => void;
  onJoinGroup: (inviteCode: string, studentName: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const statusIcons: Record<string, { icon: string; title: string; color: string }> = {
  solved: { icon: "✓", title: "Решено", color: "text-emerald-400 bg-emerald-950/60 border-emerald-500/50" },
  attempted: { icon: "•", title: "Были попытки", color: "text-amber-400 bg-amber-950/60 border-amber-500/50 text-base leading-none" },
  not_started: { icon: "", title: "Не начато", color: "border-gray-600 bg-gray-800/40" },
};

const diffDots: Record<string, string> = {
  easy: "bg-emerald-400",
  medium: "bg-amber-400",
  hard: "bg-rose-400",
};

export default function NavigationSidebar({
  tracks,
  myGroups,
  activeProblemId,
  onSelectProblem,
  onJoinGroup,
  isOpen,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"catalog" | "homework">("catalog");
  const [filterCategory, setFilterCategory] = useState<"all" | "school" | "university">("all");

  // Состояние формы вступления в группу
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem("school_leetcode_student_name") || "";
  });
  const [inviteCode, setInviteCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const filteredTracks = tracks.filter((t) => {
    if (filterCategory === "all") return true;
    return t.category === filterCategory;
  });

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = inviteCode.trim().toUpperCase();
    const trimmedName = studentName.trim();

    if (!trimmedName) {
      setJoinError("Пожалуйста, укажите ваше имя");
      return;
    }
    if (!trimmedCode) {
      setJoinError("Пожалуйста, введите код группы");
      return;
    }

    setJoinLoading(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      localStorage.setItem("school_leetcode_student_name", trimmedName);
      await onJoinGroup(trimmedCode, trimmedName);
      setInviteCode("");
      setJoinSuccess(`Вы успешно вступили в группу по коду ${trimmedCode}!`);
      setTimeout(() => setJoinSuccess(null), 4000);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Не удалось вступить в группу");
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <>
      {/* Затемнение фона при открытом сайдбаре */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Выдвижная панель слева */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-84 max-w-[88vw] bg-[#12192f] border-r border-[#1f2d4e] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Заголовок сайдбара */}
        <div className="p-4 border-b border-[#1f2d4e] flex items-center justify-between bg-[#16213e]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <h2 className="font-bold text-white text-base">Учебные материалы</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Переключатель разделов: «Каталог» / «Мои задания» */}
        <div className="p-2.5 border-b border-[#1f2d4e] bg-[#0f172a]">
          <div className="grid grid-cols-2 gap-1 bg-[#1e293b] p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "catalog"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span>📚</span>
              <span>Каталог</span>
            </button>
            <button
              onClick={() => setActiveTab("homework")}
              className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "homework"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span>📋</span>
              <span>Мои задания</span>
              {myGroups.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-900 text-indigo-300 text-[10px] border border-indigo-700/50">
                  {myGroups.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Вкладка 1: Каталог задач */}
        {activeTab === "catalog" && (
          <>
            {/* Фильтр: Все / Школа / ВУЗ */}
            <div className="px-3 py-2 border-b border-[#1f2d4e] bg-[#12192f]/60">
              <div className="grid grid-cols-3 gap-1 bg-[#1e293b]/70 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`py-1 rounded transition-colors ${
                    filterCategory === "all"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => setFilterCategory("school")}
                  className={`py-1 rounded transition-colors ${
                    filterCategory === "school"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🏫 Школа
                </button>
                <button
                  onClick={() => setFilterCategory("university")}
                  className={`py-1 rounded transition-colors ${
                    filterCategory === "university"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🎓 ВУЗ
                </button>
              </div>
            </div>

            {/* Дерево курсов */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {filteredTracks.map((track) => (
                <div key={track.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-400">
                    <span>{track.category === "school" ? "🏫" : "🎓"}</span>
                    <span>{track.title}</span>
                  </div>

                  <div className="space-y-3 pl-2 border-l border-[#1f2d4e] ml-2">
                    {track.topics.map((topic) => (
                      <div key={topic.id} className="space-y-1">
                        <div className="text-xs font-semibold text-gray-300 px-2 py-0.5">
                          {topic.title}
                        </div>

                        <div className="space-y-0.5">
                          {topic.problems.map((prob: ProblemListItem) => {
                            const isActive = prob.id === activeProblemId;
                            const st = statusIcons[prob.status] ?? statusIcons.not_started;
                            const dotColor = diffDots[prob.difficulty] ?? diffDots.easy;

                            return (
                              <button
                                key={prob.id}
                                onClick={() => {
                                  onSelectProblem(prob.id);
                                  onClose();
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-all ${
                                  isActive
                                    ? "bg-indigo-600/30 text-white border border-indigo-500/60 shadow-sm font-medium"
                                    : "text-gray-300 hover:bg-[#1f2d4e]/60 hover:text-white"
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <span
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold ${st.color}`}
                                    title={st.title}
                                  >
                                    {st.icon}
                                  </span>
                                  <span className="truncate">{prob.title}</span>
                                </div>

                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
                                  title={`Сложность: ${prob.difficulty}`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {filteredTracks.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-xs">
                  Задачи в этой категории не найдены
                </div>
              )}
            </div>
          </>
        )}

        {/* Вкладка 2: Мои задания (Группы и ДЗ) */}
        {activeTab === "homework" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Форма вступления в группу */}
            <form
              onSubmit={handleJoinSubmit}
              className="p-3 rounded-xl bg-[#16213e]/90 border border-[#23355e] shadow-md space-y-2.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <span>➕</span>
                <span>Вступить в учебную группу</span>
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Ваше имя (ФИО для учителя)
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="например, Иван Петров"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1326] border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Код приглашения
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="например, DEMO9A"
                  maxLength={12}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1326] border border-gray-700 text-xs text-white placeholder-gray-500 font-mono tracking-wider uppercase focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {joinError && (
                <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] leading-tight">
                  {joinError}
                </div>
              )}

              {joinSuccess && (
                <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] leading-tight">
                  {joinSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={joinLoading}
                className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                {joinLoading ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span>Вступаю...</span>
                  </>
                ) : (
                  <>
                    <span>Войти в группу</span>
                  </>
                )}
              </button>
            </form>

            {/* Список групп и заданий */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                Мои группы ({myGroups.length})
              </div>

              {myGroups.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-gray-700 bg-gray-900/30 text-center text-xs text-gray-400">
                  <div className="text-2xl mb-1">📬</div>
                  <div>Вы пока не состоите ни в одной группе.</div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Введите код, полученный от учителя (например, <span className="font-mono text-indigo-400">DEMO9A</span>), в форме выше.
                  </div>
                </div>
              ) : (
                myGroups.map((group) => (
                  <div
                    key={group.groupId}
                    className="p-3 rounded-xl bg-[#16213e]/70 border border-[#23355e] space-y-2.5"
                  >
                    {/* Шапка группы */}
                    <div className="flex items-start justify-between gap-2 border-b border-[#23355e] pb-2">
                      <div>
                        <div className="font-bold text-white text-xs">{group.groupName}</div>
                        <div className="text-[11px] text-gray-400">
                          Ученик: <span className="text-gray-300 font-medium">{group.studentName}</span>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800 shrink-0">
                        {group.inviteCode}
                      </span>
                    </div>

                    {/* Задания группы */}
                    {group.assignments.length === 0 ? (
                      <div className="text-[11px] text-gray-500 italic py-1">
                        Преподаватель пока не назначил заданий
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {group.assignments.map((asgn) => (
                          <div key={asgn.id} className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                              <span>📝</span>
                              <span>{asgn.title}</span>
                            </div>

                            <div className="space-y-1 pl-2 border-l border-[#23355e] ml-1">
                              {asgn.problems.map((prob) => {
                                const isActive = prob.id === activeProblemId;
                                const st = statusIcons[prob.status] ?? statusIcons.not_started;
                                const dotColor = diffDots[prob.difficulty] ?? diffDots.easy;

                                return (
                                  <button
                                    key={prob.id}
                                    onClick={() => {
                                      onSelectProblem(prob.id);
                                      onClose();
                                    }}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
                                      isActive
                                        ? "bg-indigo-600/30 text-white border border-indigo-500/60 shadow-sm font-medium"
                                        : "text-gray-300 hover:bg-[#1f2d4e]/60 hover:text-white"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <span
                                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 text-[9px] font-bold ${st.color}`}
                                        title={st.title}
                                      >
                                        {st.icon}
                                      </span>
                                      <span className="truncate">{prob.title}</span>
                                    </div>

                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
                                      title={`Сложность: ${prob.difficulty}`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
