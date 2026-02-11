import { useEffect } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { EditorCommand } from "../types";

export function useEditorShortcuts({
  editor,
  onCommand,
}: {
  editor: MonacoEditor.IStandaloneCodeEditor | null;
  onCommand: (cmd: EditorCommand) => void;
}) {
  useEffect(() => {
    const dom = editor?.getDomNode();
    if (!dom) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? event.metaKey : event.ctrlKey;

      if (!mod) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        onCommand({ type: "save" });
        return;
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        onCommand({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
    };

    dom.addEventListener("keydown", onKeyDown);
    return () => dom.removeEventListener("keydown", onKeyDown);
  }, [editor, onCommand]);
}
