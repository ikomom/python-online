import { useCallback, useEffect, useRef, useState } from "react";
import PyodideWorker from "../../worker/pyodide.worker?worker";
import type { TestCase } from "./challenges";

export type TestResult = {
  passed: boolean;
  actual: string;
  expected: string;
  description: string;
};

export type RunState = "idle" | "loading" | "running" | "done";

export function useChallengeRunner() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [runState, setRunState] = useState<RunState>("loading");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const stdoutRef = useRef<string[]>([]);
  const testCasesRef = useRef<TestCase[]>([]);

  useEffect(() => {
    const worker = new PyodideWorker();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const { type, message } = e.data;
      if (type === "READY") {
        setIsReady(true);
        setRunState("idle");
      } else if (type === "STDOUT") {
        stdoutRef.current.push(String(message));
      } else if (type === "DONE") {
        const resultLine = stdoutRef.current.find((l) =>
          l.startsWith("__RESULTS__:"),
        );
        const otherLines = stdoutRef.current.filter(
          (l) => !l.startsWith("__RESULTS__:"),
        );
        setConsoleOutput(otherLines);
        if (resultLine) {
          try {
            const parsed: { passed: boolean; actual: string; expected: string }[] =
              JSON.parse(resultLine.slice("__RESULTS__:".length));
            setResults(
              parsed.map((r, i) => ({
                ...r,
                description: testCasesRef.current[i]?.description ?? `测试 ${i + 1}`,
              })),
            );
          } catch {
            setResults(null);
          }
        }
        setRunState("done");
      } else if (type === "ERROR") {
        setConsoleOutput([`错误：${String(e.data.message ?? "")}`]);
        setResults(null);
        setRunState("done");
      }
    };

    return () => worker.terminate();
  }, []);

  const runTests = useCallback(
    (userCode: string, testCases: TestCase[]) => {
      if (!workerRef.current || !isReady) return;
      testCasesRef.current = testCases;
      stdoutRef.current = [];
      setResults(null);
      setConsoleOutput([]);
      setRunState("running");

      const tcJson = JSON.stringify(
        testCases.map((tc) => ({ args: tc.args, expected: tc.expected })),
      )
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");

      const contextCode = `import json as __json__
__TEST_CASES__ = __json__.loads('${tcJson}')`;

      workerRef.current.postMessage({
        type: "RUN_CODE",
        payload: { code: userCode, contextCode, breakpoints: [] },
      });
    },
    [isReady],
  );

  return { isReady, runState, results, consoleOutput, runTests };
}
