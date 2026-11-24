import { useState } from "react";
import type { Track, ProblemListItem } from "../api";

interface Props {
  tracks: Track[];
  activeProblemId: number;
  onSelectProblem: (id: number) => void;
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
  activeProblemId,
  onSelectProblem,
  isOpen,
  onClose,
}: Props) {
  const [filterCategory, setFilterCategory] = useState<"all" | "school" | "university">("all");

  const filteredTracks = tracks.filter((t) => {
    if (filterCategory === "all") return true;
    return t.category === filterCategory;
  });

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
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[#12192f] border-r border-[#1f2d4e] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Заголовок сайдбара */}
        <div className="p-4 border-b border-[#1f2d4e] flex items-center justify-between bg-[#16213e]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h2 className="font-bold text-white text-base">Каталог задач</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Фильтр: Все / Школа / ВУЗ */}
        <div className="p-3 border-b border-[#1f2d4e] bg-[#0f172a]">
          <div className="grid grid-cols-3 gap-1 bg-[#1e293b] p-1 rounded-lg text-xs font-medium">
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
              {/* Название трека */}
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <span>{track.category === "school" ? "🏫" : "🎓"}</span>
                <span>{track.title}</span>
              </div>

              {/* Темы трека */}
              <div className="space-y-3 pl-2 border-l border-[#1f2d4e] ml-2">
                {track.topics.map((topic) => (
                  <div key={topic.id} className="space-y-1">
                    <div className="text-xs font-semibold text-gray-300 px-2 py-0.5">
                      {topic.title}
                    </div>

                    {/* Список задач */}
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
                              {/* Иконка статуса */}
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold ${st.color}`}
                                title={st.title}
                              >
                                {st.icon}
                              </span>
                              <span className="truncate">{prob.title}</span>
                            </div>

                            {/* Индикатор сложности */}
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
      </aside>
    </>
  );
}
