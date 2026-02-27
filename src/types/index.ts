export type RunStatus = "idle" | "running" | "success" | "error";

export type VariableRow = {
  key: string;
  name: string;
  value: string;
};

export type VariableScope = {
  id: string;
  name: string;
  lineno: number;
  variables: Record<string, string>;
};

export type Breakpoint = {
  line: number;
  enabled: boolean;
};

export type CodeTemplate = {
  id: string;
  label: string;
  description: string;
  code: string;
  deps?: string[];
};

export type GraphNode = { id: string; label: string; x: number; y: number };
export type GraphEdge = { from: string; to: string; weight: number };
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  start: string;
  end: string;
};
export type ShortestPathResult = {
  path: string[];        // optimal path (from __path_solve__)
  totalWeight: number;   // user's algorithm result
  optimalWeight?: number;
  userPath?: string[];   // user's algorithm path (if returned as dict)
};

export type ObserverStation = { id: string; lng: number; lat: number };
export type PositioningData = {
  stations: ObserverStation[];
  measurements: { stationId: string; bearingDeg: number }[];
  trueTarget: { lng: number; lat: number };
};
export type PositioningResult = {
  userLng: number;
  userLat: number;
  optimalLng?: number;
  optimalLat?: number;
};
