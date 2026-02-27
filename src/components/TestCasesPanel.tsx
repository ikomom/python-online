import { CheckCircle, XCircle } from "lucide-react";
import type { TestCase } from "../pages/ChallengePage/challenges";
import type { TestResult } from "../pages/ChallengePage/useChallengeRunner";

type Props = {
  testCases: TestCase[];
  results: TestResult[] | null;
  consoleOutput: string[];
  allPassed: boolean;
};

export default function TestCasesPanel({ testCases, results, consoleOutput, allPassed }: Props) {
  return (
    <div className="px-3 py-2 space-y-2">
      {testCases.map((tc, i) => {
        const result = results?.[i];
        const status = result === undefined ? "pending" : result.passed ? "pass" : "fail";
        return (
          <div
            key={i}
            className={`rounded border text-xs p-2.5 ${
              status === "pass"
                ? "border-green-200 bg-green-50"
                : status === "fail"
                  ? "border-red-200 bg-red-50"
                  : "border-black/10 bg-white"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {status === "pass" ? (
                <CheckCircle size={13} className="text-green-500 shrink-0" />
              ) : status === "fail" ? (
                <XCircle size={13} className="text-red-400 shrink-0" />
              ) : (
                <div className="w-[13px] h-[13px] rounded-full border border-black/20 shrink-0" />
              )}
              <span className="font-medium text-black/70">
                测试 {i + 1}：{tc.description}
              </span>
            </div>
            <div className="ml-5 space-y-0.5 text-black/50">
              <div>
                <span className="text-black/40">输入：</span>
                {tc.args.map((a) => JSON.stringify(a)).join(", ")}
              </div>
              <div>
                <span className="text-black/40">期望：</span>
                {tc.checkIsPosition ? "返回 (lng, lat) 坐标" : JSON.stringify(tc.expected)}
              </div>
              {result && !result.passed && (
                <div className="text-red-500">
                  <span className="text-black/40">实际：</span>
                  {result.actual}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {consoleOutput.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-black/40 mb-1">控制台输出</div>
          <pre className="text-xs bg-black/4 rounded p-2 text-black/60 whitespace-pre-wrap m-0">
            {consoleOutput.join("\n")}
          </pre>
        </div>
      )}
      {allPassed && (
        <div className="mt-2 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700 font-medium text-center">
          🎉 全部通过！
        </div>
      )}
    </div>
  );
}
