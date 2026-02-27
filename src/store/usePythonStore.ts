import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import type { Breakpoint, GraphData, PositioningData, PositioningResult, RunStatus, ShortestPathResult, VariableScope } from "../types";

export interface PythonState {
  // Editor State
  code: string;
  contextCode: string;
  selectedTemplateId: string;
  breakpoints: Breakpoint[];

  // Execution State
  isReady: boolean;
  isRunning: boolean;
  isPaused: boolean;
  runStatus: RunStatus;
  currentLine: number | null;
  hoverLine: number | null;
  pausedDepth: number;

  // Output Data
  output: string[];
  variableScopes: VariableScope[];
  outputDurationMs: number | null;
  graphData: GraphData | null;
  graphResult: ShortestPathResult | null;

  // Actions
  setCode: (code: string) => void;
  setContextCode: (code: string) => void;
  setSelectedTemplateId: (id: string) => void;
  setBreakpoints: (
    breakpoints: Breakpoint[] | ((prev: Breakpoint[]) => Breakpoint[]),
  ) => void;
  toggleBreakpoint: (line: number) => void;
  setBreakpointEnabled: (line: number, enabled: boolean) => void;
  removeBreakpoint: (line: number) => void;

  setIsReady: (isReady: boolean) => void;
  setIsRunning: (isRunning: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setRunStatus: (status: RunStatus) => void;
  setCurrentLine: (line: number | null) => void;
  setHoverLine: (line: number | null) => void;
  setPausedDepth: (depth: number) => void;

  setOutput: (output: string[] | ((prev: string[]) => string[])) => void;
  setVariableScopes: (scopes: VariableScope[]) => void;
  setOutputDurationMs: (ms: number | null) => void;
  setGraphData: (data: GraphData | null) => void;
  setGraphResult: (result: ShortestPathResult | null) => void;

  positioningData: PositioningData | null;
  positioningResult: PositioningResult | null;
  setPositioningData: (data: PositioningData | null) => void;
  setPositioningResult: (result: PositioningResult | null) => void;

  resetExecution: () => void;
}

export const usePythonStore = createWithEqualityFn<PythonState>()(
  (set) => ({
    // Initial State
    code: "", // Will be set in App.tsx from templates
    contextCode: "",
    selectedTemplateId: "basic",
    breakpoints: [],

    isReady: false,
    isRunning: false,
    isPaused: false,
    runStatus: "idle",
    currentLine: null,
    hoverLine: null,
    pausedDepth: 1,

    output: [],
    variableScopes: [],
    outputDurationMs: null,
    graphData: null,
    graphResult: null,
    positioningData: null,
    positioningResult: null,

    // Actions
    setCode: (code) => set({ code }),
    setContextCode: (contextCode) => set({ contextCode }),
    setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
    setBreakpoints: (breakpoints) =>
      set((state) => ({
        breakpoints:
          typeof breakpoints === "function"
            ? breakpoints(state.breakpoints)
            : breakpoints,
      })),
    toggleBreakpoint: (line) =>
      set((state) => {
        const exists = state.breakpoints.some((b) => b.line === line);
        return {
          breakpoints: exists
            ? state.breakpoints.filter((b) => b.line !== line)
            : [...state.breakpoints, { line, enabled: true }],
        };
      }),
    setBreakpointEnabled: (line, enabled) =>
      set((state) => ({
        breakpoints: state.breakpoints.map((b) =>
          b.line === line ? { ...b, enabled } : b,
        ),
      })),
    removeBreakpoint: (line) =>
      set((state) => ({
        breakpoints: state.breakpoints.filter((b) => b.line !== line),
      })),

    setIsReady: (isReady) => set({ isReady }),
    setIsRunning: (isRunning) => set({ isRunning }),
    setIsPaused: (isPaused) => set({ isPaused }),
    setRunStatus: (runStatus) => set({ runStatus }),
    setCurrentLine: (currentLine) => set({ currentLine }),
    setHoverLine: (hoverLine) => set({ hoverLine }),
    setPausedDepth: (pausedDepth) => set({ pausedDepth }),

    setOutput: (output) =>
      set((state) => ({
        output: typeof output === "function" ? output(state.output) : output,
      })),
    setVariableScopes: (variableScopes) => set({ variableScopes }),
    setOutputDurationMs: (outputDurationMs) => set({ outputDurationMs }),
    setGraphData: (graphData) => set({ graphData }),
    setGraphResult: (graphResult) => set({ graphResult }),
    setPositioningData: (positioningData) => set({ positioningData }),
    setPositioningResult: (positioningResult) => set({ positioningResult }),

    resetExecution: () =>
      set({
        isRunning: false,
        isPaused: false,
        runStatus: "idle",
        currentLine: null,
        hoverLine: null,
        pausedDepth: 1,
        variableScopes: [],
        outputDurationMs: null,
        graphResult: null,
        positioningResult: null,
      }),
  }),
  shallow,
);
