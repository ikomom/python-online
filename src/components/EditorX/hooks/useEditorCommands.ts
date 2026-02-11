import { useCallback } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { EditorCommand, EditorPlugin } from "../types";

export function useEditorCommands(args: {
  editor: MonacoEditor.IStandaloneCodeEditor | null;
  plugins: EditorPlugin[];
}) {
  const exec = useCallback(
    (cmd: EditorCommand) => {
      for (const plugin of args.plugins) {
        plugin.onCommand?.(cmd);
      }

      if (!args.editor) return;

      if (cmd.type === "undo") {
        args.editor.trigger("EditorX", "undo", null);
      } else if (cmd.type === "redo") {
        args.editor.trigger("EditorX", "redo", null);
      } else if (cmd.type === "format") {
        args.editor.getAction("editor.action.formatDocument")?.run();
      }
    },
    [args.editor, args.plugins],
  );

  return { exec };
}

