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

type ParsedContextSymbols = {
  functions: Map<string, string>;
  variables: Set<string>;
  modules: Set<string>;
};

let lastContextCode = "";
let lastContextSymbols: ParsedContextSymbols | null = null;

function parseContextSymbols(code: string): ParsedContextSymbols {
  if (code === lastContextCode && lastContextSymbols) return lastContextSymbols;

  const functions = new Map<string, string>();
  const variables = new Set<string>();
  const modules = new Set<string>();

  const defRe = /^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/gm;
  for (;;) {
    const m = defRe.exec(code);
    if (!m) break;
    const name = m[1] ?? "";
    const args = (m[2] ?? "").trim();
    if (name) functions.set(name, `def ${name}(${args})`);
  }

  const importRe = /^\s*import\s+(.+)$/gm;
  for (;;) {
    const m = importRe.exec(code);
    if (!m) break;
    const rest = String(m[1] ?? "");
    for (const part of rest.split(",")) {
      const s = part.trim();
      if (!s) continue;
      const asMatch = s.match(/^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (!asMatch) continue;
      const mod = asMatch[1] ?? "";
      const alias = asMatch[2] ?? "";
      if (mod) modules.add(mod);
      if (alias) variables.add(alias);
      else if (mod) variables.add(mod);
    }
  }

  const fromImportRe = /^\s*from\s+([A-Za-z_]\w*)\s+import\s+(.+)$/gm;
  for (;;) {
    const m = fromImportRe.exec(code);
    if (!m) break;
    const mod = String(m[1] ?? "").trim();
    const rest = String(m[2] ?? "");
    if (mod) modules.add(mod);
    for (const part of rest.split(",")) {
      const s = part.trim();
      if (!s) continue;
      const asMatch = s.match(/^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (!asMatch) continue;
      const name = asMatch[1] ?? "";
      const alias = asMatch[2] ?? "";
      if (alias) variables.add(alias);
      else if (name) variables.add(name);
    }
  }

  const assignRe = /^([A-Za-z_]\w*)\s*=/gm;
  for (;;) {
    const m = assignRe.exec(code);
    if (!m) break;
    const name = m[1] ?? "";
    if (name) variables.add(name);
  }

  lastContextCode = code;
  lastContextSymbols = { functions, variables, modules };
  return lastContextSymbols;
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

      const { variableScopes, contextCode } = usePythonStore.getState();
      const hovered = word.word;
      const contextSymbols = parseContextSymbols(contextCode);

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

      const signatureInMain = tryGetPythonFunctionSignature(
        model.getValue(),
        hovered,
      );
      if (signatureInMain) {
        contents.push({ value: `\`\`\`python\n${signatureInMain}\n\`\`\`` });
      } else {
        const signatureInContext =
          contextSymbols.functions.get(hovered) ?? null;
        if (signatureInContext) {
          contents.push({
            value: `\`\`\`python\n${signatureInContext}\n\`\`\`\n\n(上下文)`,
          });
        } else if (contextSymbols.variables.has(hovered)) {
          contents.push({ value: `**${hovered}**  (上下文变量)` });
        }
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

  monaco.languages.registerCompletionItemProvider("python", {
    provideCompletionItems(model, position) {
      const { contextCode } = usePythonStore.getState();
      const contextSymbols = parseContextSymbols(contextCode);

      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );

      const suggestions: monaco.languages.CompletionItem[] = [];

      for (const [name, signature] of contextSymbols.functions) {
        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: "上下文函数",
          documentation: signature,
          insertText: `${name}($0)`,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        });
      }

      for (const name of contextSymbols.variables) {
        if (contextSymbols.functions.has(name)) continue;
        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: "上下文变量",
          insertText: name,
          range,
        });
      }

      for (const name of contextSymbols.modules) {
        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Module,
          detail: "上下文模块",
          insertText: name,
          range,
        });
      }

      return { suggestions };
    },
  });

  loader.config({ monaco });
  void loader.init();
}
