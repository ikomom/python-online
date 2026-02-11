import { create } from "zustand";
import type { RunStatus } from "../types";

export interface PythonState {
  // Editor State
  code: string;
  selectedTemplateId: string;
  breakpoints: number[];
  
  // Execution State
  isReady: boolean;
  isRunning: boolean;
  isPaused: boolean;
  runStatus: RunStatus;
  currentLine: number | null;
  hoverLine: number | null;
  
  // Output Data
  output: string[];
  variables: Record<string, string>;
  outputDurationMs: number | null;

  // Actions
  setCode: (code: string) => void;
  setSelectedTemplateId: (id: string) => void;
  setBreakpoints: (breakpoints: number[] | ((prev: number[]) => number[])) => void;
  toggleBreakpoint: (line: number) => void;
  
  setIsReady: (isReady: boolean) => void;
  setIsRunning: (isRunning: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setRunStatus: (status: RunStatus) => void;
  setCurrentLine: (line: number | null) => void;
  setHoverLine: (line: number | null) => void;
  
  setOutput: (output: string[] | ((prev: string[]) => string[])) => void;
  setVariables: (variables: Record<string, string>) => void;
  setOutputDurationMs: (ms: number | null) => void;
  
  resetExecution: () => void;
}

export const usePythonStore = create<PythonState>((set) => ({
  // Initial State
  code: "", // Will be set in App.tsx from templates
  selectedTemplateId: "basic",
  breakpoints: [],
  
  isReady: false,
  isRunning: false,
  isPaused: false,
  runStatus: "idle",
  currentLine: null,
  hoverLine: null,
  
  output: [],
  variables: {},
  outputDurationMs: null,

  // Actions
  setCode: (code) => set({ code }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setBreakpoints: (breakpoints) => set((state) => ({ 
    breakpoints: typeof breakpoints === 'function' ? breakpoints(state.breakpoints) : breakpoints 
  })),
  toggleBreakpoint: (line) => set((state) => {
    const exists = state.breakpoints.includes(line);
    return {
      breakpoints: exists
        ? state.breakpoints.filter((l) => l !== line)
        : [...state.breakpoints, line]
    };
  }),
  
  setIsReady: (isReady) => set({ isReady }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setRunStatus: (runStatus) => set({ runStatus }),
  setCurrentLine: (currentLine) => set({ currentLine }),
  setHoverLine: (hoverLine) => set({ hoverLine }),
  
  setOutput: (output) => set((state) => ({ 
    output: typeof output === 'function' ? output(state.output) : output 
  })),
  setVariables: (variables) => set({ variables }),
  setOutputDurationMs: (outputDurationMs) => set({ outputDurationMs }),
  
  resetExecution: () => set({
    isRunning: false,
    isPaused: false,
    runStatus: "idle",
    currentLine: null,
    hoverLine: null,
    variables: {},
    outputDurationMs: null,
  }),
}));
