export type RunStatus = "idle" | "running" | "success" | "error";

export type VariableRow = {
  key: string;
  name: string;
  value: string;
};

export type CodeTemplate = {
  id: string;
  label: string;
  description: string;
  code: string;
};
