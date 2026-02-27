import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";

export type DebugPanel = {
  key: string;
  title: ReactNode;
  content: ReactNode;
};

const HEADER_HEIGHT = 28; // px, approximate header height

export default function DebugPanelStack({ panels }: { panels: DebugPanel[] }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(panels.map((p) => p.key)),
  );
  const [heights, setHeights] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ key: string; startY: number; startHeight: number } | null>(null);

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Initialize heights equally among open panels
  useEffect(() => {
    if (!containerRef.current) return;
    const totalH = containerRef.current.clientHeight;
    const openPanels = panels.filter((p) => openKeys.has(p.key));
    const closedCount = panels.length - openPanels.length;
    const available = totalH - closedCount * HEADER_HEIGHT - openPanels.length * HEADER_HEIGHT;
    const perPanel = Math.max(60, available / Math.max(openPanels.length, 1));
    setHeights((prev) => {
      const next = { ...prev };
      for (const p of openPanels) {
        if (!next[p.key]) next[p.key] = perPanel;
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panels.map((p) => p.key).join(",")]);

  const onMouseDown = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    dragging.current = {
      key,
      startY: e.clientY,
      startHeight: heights[key] ?? 100,
    };
  }, [heights]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { key, startY, startHeight } = dragging.current;
      const delta = e.clientY - startY;
      setHeights((prev) => ({
        ...prev,
        [key]: Math.max(40, startHeight + delta),
      }));
    };
    const onMouseUp = () => { dragging.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {panels.map((panel) => {
        const isOpen = openKeys.has(panel.key);
        const contentHeight = heights[panel.key] ?? 120;
        return (
          <div
            key={panel.key}
            className="flex flex-col border-b border-black/8 shrink-0"
            style={isOpen ? { height: contentHeight + HEADER_HEIGHT } : undefined}
          >
            <button
              type="button"
              onClick={() => toggle(panel.key)}
              className="flex items-center justify-between w-full px-2 py-1.5 bg-white border-none border-b border-black/8 text-xs font-semibold cursor-pointer shrink-0 text-left hover:bg-black/[0.02]"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="min-w-0 flex items-center gap-2">{panel.title}</span>
              <span className="text-[10px] text-black/40 ml-2 shrink-0">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <>
                <div className="overflow-auto" style={{ height: contentHeight }}>
                  {panel.content}
                </div>
                <div
                  onMouseDown={(e) => onMouseDown(e, panel.key)}
                  className="shrink-0 h-1 cursor-row-resize bg-transparent hover:bg-blue-400/40 active:bg-blue-400/60 transition-colors"
                  style={{ marginTop: -4 }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
