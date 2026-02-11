import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { usePythonStore } from "../store/usePythonStore";

let isSetup = false;

type MonacoEnvironment = {
  getWorker: (moduleId: string, label: string) => Worker;
};

function escapeMarkdownCode(value: string): string {
  return value.replaceAll("`", "\\`");
}

function tryGetPythonFunctionSignature(
  code: string,
  name: string,
): string | null {
  const escapedName = name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `^\\s*def\\s+${escapedName}\\s*\\(([^)]*)\\)\\s*:`,
    "m",
  );
  const match = code.match(re);
  if (!match) return null;
  const args = match[1]?.trim() ?? "";
  return `def ${name}(${args})`;
}

export function setupMonaco() {
  if (isSetup) return;
  isSetup = true;

  const monacoGlobal = globalThis as typeof globalThis & {
    MonacoEnvironment?: MonacoEnvironment;
  };

  monacoGlobal.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === "json") return new JsonWorker();
      if (label === "css" || label === "scss" || label === "less")
        return new CssWorker();
      if (label === "html" || label === "handlebars" || label === "razor")
        return new HtmlWorker();
      if (label === "typescript" || label === "javascript")
        return new TsWorker();
      return new EditorWorker();
    },
  };

  monaco.languages.registerHoverProvider("python", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const { variableScopes } = usePythonStore.getState();
      const hovered = word.word;

      const contents: { value: string }[] = [];

      for (const scope of variableScopes) {
        if (Object.prototype.hasOwnProperty.call(scope.variables, hovered)) {
          const raw = scope.variables[hovered];
          const scopeLabel = scope.name === "<module>" ? "全局" : scope.name;
          contents.push({
            value: `**${hovered}**  (${escapeMarkdownCode(scopeLabel)})\n\n\`\`\`\n${escapeMarkdownCode(String(raw))}\n\`\`\``,
          });
          break;
        }
      }

      const signature = tryGetPythonFunctionSignature(
        model.getValue(),
        hovered,
      );
      if (signature) {
        contents.push({ value: `\`\`\`python\n${signature}\n\`\`\`` });
      }

      if (contents.length === 0) return null;

      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
        contents,
      };
    },
  });

  loader.config({ monaco });
  void loader.init();
}
