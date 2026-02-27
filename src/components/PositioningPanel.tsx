import { useCallback, useMemo, useRef, useState } from "react";
import { usePythonStore } from "../store/usePythonStore";

const SVG_W = 640;
const SVG_H = 520;
const PAD = 48;

function toSvg(
  lng: number, lat: number,
  minLng: number, maxLng: number, minLat: number, maxLat: number,
): [number, number] {
  const rangeLng = maxLng - minLng || 1;
  const rangeLat = maxLat - minLat || 1;
  const sx = PAD + ((lng - minLng) / rangeLng) * (SVG_W - PAD * 2);
  // flip lat: lat increases up, SVG y increases down
  const sy = (SVG_H - PAD) - ((lat - minLat) / rangeLat) * (SVG_H - PAD * 2);
  return [sx, sy];
}

// Clip a ray (ox, oy) + t*(dx, dy), t>=0, to SVG bounds [0,W]x[0,H]
function rayClip(ox: number, oy: number, dx: number, dy: number): [number, number] | null {
  let tMax = Infinity;
  if (dx > 0) tMax = Math.min(tMax, (SVG_W - ox) / dx);
  else if (dx < 0) tMax = Math.min(tMax, -ox / dx);
  if (dy > 0) tMax = Math.min(tMax, (SVG_H - oy) / dy);
  else if (dy < 0) tMax = Math.min(tMax, -oy / dy);
  if (!isFinite(tMax) || tMax < 0) return null;
  return [ox + tMax * dx, oy + tMax * dy];
}

// __CONTINUE_HERE__

export default function PositioningPanel() {
  const { positioningData, positioningResult } = usePythonStore((s) => ({
    positioningData: s.positioningData,
    positioningResult: s.positioningResult,
  }));

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  }, [offset]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({ x: dragRef.current.ox + e.clientX - dragRef.current.sx, y: dragRef.current.oy + e.clientY - dragRef.current.sy });
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(5, Math.max(0.2, s - e.deltaY * 0.001)));
  }, []);
  const resetView = useCallback(() => { setOffset({ x: 0, y: 0 }); setScale(1); }, []);

  const { minLng, maxLng, minLat, maxLat } = useMemo(() => {
    if (!positioningData) return { minLng: 116.3, maxLng: 116.5, minLat: 39.8, maxLat: 40.0 };
    const lngs = positioningData.stations.map((s) => s.lng).concat(positioningData.trueTarget.lng);
    const lats = positioningData.stations.map((s) => s.lat).concat(positioningData.trueTarget.lat);
    if (positioningResult) {
      lngs.push(positioningResult.userLng);
      lats.push(positioningResult.userLat);
    }
    const pad = 0.02;
    return {
      minLng: Math.min(...lngs) - pad,
      maxLng: Math.max(...lngs) + pad,
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
    };
  }, [positioningData, positioningResult]);

  if (!positioningData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-black/30 bg-slate-50">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="14" stroke="#cbd5e1" strokeWidth="2" fill="none"/>
          <line x1="20" y1="6" x2="20" y2="20" stroke="#94a3b8" strokeWidth="2"/>
          <circle cx="20" cy="20" r="2" fill="#94a3b8"/>
        </svg>
        <span className="text-xs">暂无定位数据</span>
      </div>
    );
  }

  const measurementMap = Object.fromEntries(positioningData.measurements.map((m) => [m.stationId, m.bearingDeg]));

  const userDist = positioningResult
    ? (() => {
        const latM = (positioningResult.userLat - positioningData.trueTarget.lat) * 111000;
        const lngM = (positioningResult.userLng - positioningData.trueTarget.lng)
          * 111000 * Math.cos((positioningData.trueTarget.lat * Math.PI) / 180);
        return Math.sqrt(latM ** 2 + lngM ** 2);
      })()
    : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none bg-slate-50">
      {/* info bar */}
      <div className="px-3 shrink-0 flex items-center gap-3 min-h-[36px] bg-white border-b border-slate-100 flex-wrap">
        {positioningResult ? (
          <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap py-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-700 font-medium">你的解</span>
              {userDist !== null && (
                <span className="text-xs font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  误差 {userDist < 1000 ? `${userDist.toFixed(0)}m` : `${(userDist / 1000).toFixed(2)}km`}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-700 font-medium">真实目标</span>
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 py-1">运行后显示定位结果</span>
        )}
        <button className="ml-auto shrink-0 text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors px-1 py-1" onClick={resetView} title="重置视图">
          ⟳ 重置
        </button>
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
          <rect width={SVG_W} height={SVG_H} fill="#f8fafc" />
          <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
            {/* bearing lines */}
            {positioningData.stations.map((st) => {
              const bearingDeg = measurementMap[st.id];
              if (bearingDeg === undefined) return null;
              const [sx, sy] = toSvg(st.lng, st.lat, minLng, maxLng, minLat, maxLat);
              const theta = (bearingDeg * Math.PI) / 180;
              const dx = Math.sin(theta);
              const dy = -Math.cos(theta); // flip y for SVG
              const end = rayClip(sx, sy, dx, dy);
              if (!end) return null;
              return (
                <line key={`bl-${st.id}`}
                  x1={sx} y1={sy} x2={end[0]} y2={end[1]}
                  stroke="#94a3b8" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="4 3"
                />
              );
            })}

            {/* true target */}
            {(() => {
              const [tx, ty] = toSvg(positioningData.trueTarget.lng, positioningData.trueTarget.lat, minLng, maxLng, minLat, maxLat);
              return (
                <g key="true-target">
                  <circle cx={tx} cy={ty} r={10} fill="#10b981" fillOpacity={0.15} stroke="none"/>
                  <circle cx={tx} cy={ty} r={6} fill="#10b981" stroke="#fff" strokeWidth={2}/>
                  <text x={tx} y={ty + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight="700" fill="#fff">T</text>
                </g>
              );
            })()}

            {/* optimal solution */}
            {/* removed: no optimal solution concept for bearing positioning */}

            {/* user solution */}
            {positioningResult && (() => {
              const [ux, uy] = toSvg(positioningResult.userLng, positioningResult.userLat, minLng, maxLng, minLat, maxLat);
              return (
                <g key="user">
                  <circle cx={ux} cy={uy} r={8} fill="#f59e0b" fillOpacity={0.2} stroke="none"/>
                  <circle cx={ux} cy={uy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2}/>
                </g>
              );
            })()}

            {/* stations */}
            {positioningData.stations.map((st) => {
              const [sx, sy] = toSvg(st.lng, st.lat, minLng, maxLng, minLat, maxLat);
              return (
                <g key={`st-${st.id}`}>
                  <circle cx={sx} cy={sy} r={7} fill="#1d4ed8" stroke="#fff" strokeWidth={2}/>
                  <text x={sx} y={sy + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight="700" fill="#fff">{st.id}</text>
                  <text x={sx + 10} y={sy - 8} fontSize={9} fill="#1d4ed8" fontWeight="600">{measurementMap[st.id]?.toFixed(1)}°</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

