import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface HighlightRange {
  start: number;
  end: number;
  hintText: string;
}

interface Props {
  code: string;
  onChange: (value: string) => void;
  highlightLines: HighlightRange | null;
  goToLine: number | null;
  onGoToLineHandled: () => void;
}

export default function CodeEditor({
  code,
  onChange,
  highlightLines,
  goToLine,
  onGoToLineHandled,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
  };

  // Подсветка строк
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    // Снять предыдущие декорации
    if (decorationsRef.current) {
      decorationsRef.current.clear();
      decorationsRef.current = null;
    }

    if (!highlightLines) return;

    const { start, end, hintText } = highlightLines;

    const decorations: editor.IModelDeltaDecoration[] = [];
    for (let line = start; line <= end; line++) {
      decorations.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "hint-line-highlight",
          glyphMarginClassName: "hint-glyph-margin",
          glyphMarginHoverMessage: { value: hintText },
          hoverMessage: { value: `💡 ${hintText}` },
        },
      });
    }

    decorationsRef.current = ed.createDecorationsCollection(decorations);
  }, [highlightLines]);

  // Прокрутка к строке
  useEffect(() => {
    if (goToLine == null || !editorRef.current) return;
    editorRef.current.revealLineInCenter(goToLine);
    editorRef.current.setPosition({ lineNumber: goToLine, column: 1 });
    editorRef.current.focus();
    onGoToLineHandled();
  }, [goToLine, onGoToLineHandled]);

  return (
    <div className="flex-1 overflow-hidden">
      <style>{`
        .hint-line-highlight {
          background-color: rgba(255, 170, 50, 0.15) !important;
          border-left: 3px solid #f59e0b !important;
        }
        .hint-glyph-margin {
          background-color: #f59e0b;
          border-radius: 50%;
          margin-left: 4px;
          width: 8px !important;
          height: 8px !important;
          margin-top: 6px;
        }
      `}</style>
      <Editor
        height="100%"
        defaultLanguage="cpp"
        theme="vs-dark"
        value={code}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          lineNumbers: "on",
          roundedSelection: true,
          automaticLayout: true,
          tabSize: 4,
          glyphMargin: true,
        }}
      />
    </div>
  );
}
