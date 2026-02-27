import { useMemo, useRef, useState, useCallback } from "react";
import { usePythonStore } from "../store/usePythonStore";
import { GRAPH_COLS, GRAPH_ROWS } from "../utils/generateGraph";

const SVG_W = 640;
const SVG_H = 520;

const BASE_EDGE = { stroke: "#e2e8f0", width: 1, opacity: 0.7 };
const BASE_NODE = { fill: "#e2e8f0", r: 2 };

export default function GraphPanel() {
  const { graphData, graphResult } = usePythonStore((s) => ({
    graphData: s.graphData,
    graphResult: s.graphResult,
  }));

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  }, [offset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + e.clientX - dragRef.current.sx,
      y: dragRef.current.oy + e.clientY - dragRef.current.sy,
    });
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(5, Math.max(0.3, s - e.deltaY * 0.001)));
  }, []);

  const resetView = useCallback(() => { setOffset({ x: 0, y: 0 }); setScale(1); }, []);

  const { optEdgeSet, optNodeSet, userEdgeSet, userNodeSet } = useMemo(() => {
    const optEdgeSet = new Set<string>();
    const optNodeSet = new Set<string>(graphResult?.path ?? []);
    const userEdgeSet = new Set<string>();
    const userNodeSet = new Set<string>(graphResult?.userPath ?? []);
    if (graphResult?.path) {
      for (let i = 0; i < graphResult.path.length - 1; i++) {
        const a = graphResult.path[i], b = graphResult.path[i + 1];
        optEdgeSet.add(`${a}-${b}`); optEdgeSet.add(`${b}-${a}`);
      }
    }
    if (graphResult?.userPath) {
      for (let i = 0; i < graphResult.userPath.length - 1; i++) {
        const a = graphResult.userPath[i], b = graphResult.userPath[i + 1];
        userEdgeSet.add(`${a}-${b}`); userEdgeSet.add(`${b}-${a}`);
      }
    }
    return { optEdgeSet, optNodeSet, userEdgeSet, userNodeSet };
  }, [graphResult]);

  if (!graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-black/30 bg-slate-50">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="8" cy="8" r="4" fill="#cbd5e1"/>
          <circle cx="32" cy="8" r="4" fill="#cbd5e1"/>
          <circle cx="8" cy="32" r="4" fill="#cbd5e1"/>
          <circle cx="32" cy="32" r="4" fill="#cbd5e1"/>
          <circle cx="20" cy="20" r="4" fill="#94a3b8"/>
          <line x1="8" y1="8" x2="20" y2="20" stroke="#cbd5e1" strokeWidth="1.5"/>
          <line x1="32" y1="8" x2="20" y2="20" stroke="#cbd5e1" strokeWidth="1.5"/>
          <line x1="8" y1="32" x2="20" y2="20" stroke="#cbd5e1" strokeWidth="1.5"/>
          <line x1="32" y1="32" x2="20" y2="20" stroke="#cbd5e1" strokeWidth="1.5"/>
        </svg>
        <span className="text-xs">暂无图数据</span>
      </div>
    );
  }

  const nodeMap = Object.fromEntries(graphData.nodes.map((n) => [n.id, n]));
  const hasUserPath = (graphResult?.userPath?.length ?? 0) > 0;
  const hasOptPath = (graphResult?.path?.length ?? 0) > 0;
  const endNodeId = String(GRAPH_ROWS * GRAPH_COLS - 1);

  const isOptimal = graphResult?.optimalWeight !== undefined &&
    graphResult.optimalWeight > 0 &&
    graphResult.totalWeight === graphResult.optimalWeight;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none bg-slate-50">
      {/* info bar */}
      <div className="px-3 shrink-0 flex items-center gap-3 min-h-[36px] bg-white border-b border-slate-100 flex-wrap">
        {graphResult && (hasOptPath || hasUserPath) ? (
          <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap py-1">
            {hasUserPath && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-1 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-700 font-medium">你的路径</span>
                <span className="text-xs font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  {graphResult.totalWeight}
                </span>
              </span>
            )}
            {hasOptPath && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-1 rounded-full bg-blue-500" />
                <span className="text-xs text-blue-700 font-medium">最优路径</span>
                {graphResult.optimalWeight !== undefined && graphResult.optimalWeight > 0 && (
                  <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {graphResult.optimalWeight}
                  </span>
                )}
              </span>
            )}
            {graphResult.optimalWeight !== undefined && graphResult.optimalWeight > 0 && hasUserPath && (
              isOptimal ? (
                <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                  ✓ 最优解
                </span>
              ) : (
                <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                  +{graphResult.totalWeight - graphResult.optimalWeight}（
                  {(((graphResult.totalWeight - graphResult.optimalWeight) / graphResult.optimalWeight) * 100).toFixed(1)}%）
                </span>
              )
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 py-1">运行后显示路径（起点 0，终点 {endNodeId}）</span>
        )}
        <button
          className="ml-auto shrink-0 text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors px-1 py-1"
          onClick={resetView}
          title="重置视图"
        >
          ⟳ 重置
        </button>
      </div>

      {/* legend */}
      <div className="px-3 py-1 flex items-center gap-4 bg-white border-b border-slate-100 shrink-0">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="inline-block w-5 h-0.5 bg-slate-200 rounded" />路网
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="inline-block w-5 h-0.5 bg-blue-500 rounded" />最优路径
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="inline-block w-5 h-0.5 bg-amber-400 rounded" style={{ backgroundImage: "repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 6px,transparent 6px,transparent 9px)" }} />你的路径
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />起点
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm" />终点
        </span>
      </div>

      {/* canvas */}
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block" }}>
          <defs>
            <filter id="glow-blue" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-amber" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="#f8fafc" />

          <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
            {/* base road edges */}
            {graphData.edges.map((e, i) => {
              const a = nodeMap[e.from], b = nodeMap[e.to];
              if (!a || !b) return null;
              if (optEdgeSet.has(`${e.from}-${e.to}`) || userEdgeSet.has(`${e.from}-${e.to}`)) return null;
              return (
                <line key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={BASE_EDGE.stroke}
                  strokeWidth={BASE_EDGE.width}
                  strokeOpacity={BASE_EDGE.opacity}
                  strokeLinecap="round"
                />
              );
            })}

            {/* optimal path edges */}
            {graphData.edges.map((e, i) => {
              const a = nodeMap[e.from], b = nodeMap[e.to];
              if (!a || !b || !optEdgeSet.has(`${e.from}-${e.to}`)) return null;
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={`opt-${i}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#3b82f6" strokeWidth={4} strokeLinecap="round" strokeOpacity={1}
                    filter="url(#glow-blue)"
                  />
                  <text x={mx} y={my - 5} textAnchor="middle" fontSize={8}
                    fill="#1d4ed8" fontWeight="700" fontFamily="monospace"
                    stroke="#fff" strokeWidth={2.5} paintOrder="stroke">
                    {e.weight}
                  </text>
                </g>
              );
            })}

            {/* user path edges */}
            {graphData.edges.map((e, i) => {
              const a = nodeMap[e.from], b = nodeMap[e.to];
              if (!a || !b || !userEdgeSet.has(`${e.from}-${e.to}`)) return null;
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={`user-${i}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#f59e0b" strokeWidth={4} strokeLinecap="round"
                    strokeDasharray="6 3" strokeOpacity={1}
                    filter="url(#glow-amber)"
                  />
                  <text x={mx} y={my + 13} textAnchor="middle" fontSize={8}
                    fill="#b45309" fontWeight="700" fontFamily="monospace"
                    stroke="#fff" strokeWidth={2.5} paintOrder="stroke">
                    {e.weight}
                  </text>
                </g>
              );
            })}

            {/* base nodes */}
            {graphData.nodes.map((n) => {
              const isOpt = optNodeSet.has(n.id);
              const isUser = userNodeSet.has(n.id);
              const isStart = n.id === graphData.start;
              const isEnd = n.id === graphData.end;
              if (isStart || isEnd || isOpt || isUser) return null;
              return (
                <circle key={n.id} cx={n.x} cy={n.y} r={BASE_NODE.r}
                  fill={BASE_NODE.fill} stroke="none"
                />
              );
            })}

            {/* path nodes */}
            {graphData.nodes.map((n) => {
              const isOpt = optNodeSet.has(n.id);
              const isUser = userNodeSet.has(n.id);
              const isStart = n.id === graphData.start;
              const isEnd = n.id === graphData.end;
              if (isStart || isEnd) return null;
              if (!isOpt && !isUser) return null;

              if (isUser && isOpt) {
                return (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r={7} fill="#3b82f6" stroke="#fff" strokeWidth={2} filter="url(#glow-blue)"/>
                    <circle cx={n.x} cy={n.y} r={3.5} fill="#f59e0b" stroke="none"/>
                  </g>
                );
              }
              if (isUser) {
                return (
                  <circle key={n.id} cx={n.x} cy={n.y} r={6}
                    fill="#f59e0b" stroke="#fff" strokeWidth={2} filter="url(#glow-amber)"/>
                );
              }
              return (
                <circle key={n.id} cx={n.x} cy={n.y} r={6}
                  fill="#3b82f6" stroke="#fff" strokeWidth={2} filter="url(#glow-blue)"/>
              );
            })}

            {/* start / end nodes */}
            {[graphData.start, graphData.end].map((id) => {
              const n = nodeMap[id];
              if (!n) return null;
              const isStart = id === graphData.start;
              const color = isStart ? "#10b981" : "#ef4444";
              return (
                <g key={id}>
                  <circle cx={n.x} cy={n.y} r={10} fill={color} fillOpacity={0.15} stroke="none"/>
                  <circle cx={n.x} cy={n.y} r={7} fill={color} stroke="#fff" strokeWidth={2}/>
                  <text x={n.x} y={n.y + 0.5} textAnchor="middle"
                    dominantBaseline="middle" fontSize={7} fontWeight="700" fill="#fff">
                    {isStart ? "S" : "E"}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
