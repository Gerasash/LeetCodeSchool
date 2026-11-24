import { useState } from "react";
import type { Problem } from "../api";

interface Props {
  problem: Problem;
}

const difficultyBadges: Record<string, { label: string; color: string }> = {
  easy: { label: "Лёгкая", color: "bg-emerald-900/50 text-emerald-300 border-emerald-700" },
  medium: { label: "Средняя", color: "bg-amber-900/50 text-amber-300 border-amber-700" },
  hard: { label: "Сложная", color: "bg-rose-900/50 text-rose-300 border-rose-700" },
};

/**
 * Простой и надёжный рендерер Markdown с поддержкой заголовков, абзацев и C++ блоков кода.
 */
function MarkdownViewer({ content }: { content: string }) {
  if (!content.trim()) {
    return <div className="text-gray-400 text-sm">Теоретический материал отсутствует.</div>;
  }

  // Разделяем на секции кода и обычного текста
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // Блок кода
          const lines = part.slice(3, -3).trim().split("\n");
          // Если первая строка - название языка (например "cpp"), отрезаем
          let codeContent = part.slice(3, -3);
          if (lines[0] && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
            codeContent = lines.slice(1).join("\n");
          }
          return (
            <div key={index} className="my-2 rounded-lg overflow-hidden border border-[#2d3748] bg-[#0d1117]">
              <div className="px-3 py-1 bg-[#161b22] text-xs font-mono text-gray-400 border-b border-[#2d3748]">
                C++
              </div>
              <pre className="p-3 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre">
                {codeContent.trim()}
              </pre>
            </div>
          );
        }

        // Обычный текст: разбиваем по строкам
        return (
          <div key={index} className="space-y-2">
            {part.split("\n\n").map((paragraph, pIdx) => {
              const trimmed = paragraph.trim();
              if (!trimmed) return null;

              // Заголовки ##
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={pIdx} className="text-base font-bold text-white mt-4 mb-2">
                    {trimmed.replace(/^##\s+/, "")}
                  </h3>
                );
              }
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={pIdx} className="text-sm font-bold text-indigo-300 mt-3 mb-1">
                    {trimmed.replace(/^###\s+/, "")}
                  </h4>
                );
              }

              // Маркированные списки
              if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                const items = trimmed.split("\n").filter((l) => l.trim());
                return (
                  <ul key={pIdx} className="list-disc list-inside space-y-1 pl-1">
                    {items.map((item, itemIdx) => (
                      <li key={itemIdx}>
                        {formatInline(item.replace(/^[-•]\s*/, ""))}
                      </li>
                    ))}
                  </ul>
                );
              }

              return <p key={pIdx}>{formatInline(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Форматирует inline-элементы: жирный текст **жирный** и `код`.
 */
function formatInline(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={i} className="bg-[#0d1117] text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-700">
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

export default function ProblemPanel({ problem }: Props) {
  const [activeTab, setActiveTab] = useState<"description" | "theory">("description");

  const diff = difficultyBadges[problem.difficulty] ?? difficultyBadges.easy;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Переключатель вкладок */}
      <div className="flex border-b border-[#0f3460] bg-[#12192f] shrink-0 px-4 pt-2">
        <button
          onClick={() => setActiveTab("description")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === "description"
              ? "border-indigo-500 text-white bg-[#16213e]/80"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>📝</span>
          Условие
        </button>
        <button
          onClick={() => setActiveTab("theory")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === "theory"
              ? "border-indigo-500 text-white bg-[#16213e]/80"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>📖</span>
          Краткая теория
        </button>
      </div>

      {/* Контент вкладок */}
      <div className="p-5 overflow-y-auto flex-1">
        {activeTab === "description" ? (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">{problem.title}</h2>
            
            {/* Бейджи */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${diff.color}`}>
                {diff.label}
              </span>
              <span className="bg-blue-900/40 border border-blue-700/60 text-blue-300 text-xs px-2.5 py-0.5 rounded-full">
                {problem.trackTitle || problem.grade}
              </span>
            </div>

            {/* Описание задачи */}
            <div className="mb-6">
              <MarkdownViewer content={problem.description} />
            </div>

            {/* Примеры */}
            {problem.examples.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Примеры входных и выходных данных
                </h3>
                <div className="space-y-2">
                  {problem.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="bg-[#12192f] border border-[#1f2d4e] rounded-lg p-3 font-mono text-xs"
                    >
                      <div className="mb-1.5">
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">Ввод:</span>
                        <pre className="text-emerald-300 mt-0.5 whitespace-pre-wrap">{ex.input}</pre>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">Вывод:</span>
                        <pre className="text-yellow-300 mt-0.5 whitespace-pre-wrap">{ex.expectedOutput}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#0f3460]">
              <span className="text-lg">📖</span>
              <h3 className="text-base font-bold text-white">Теоретическая справка к теме</h3>
            </div>
            <MarkdownViewer content={problem.theoryMarkdown} />
          </div>
        )}
      </div>
    </div>
  );
}
