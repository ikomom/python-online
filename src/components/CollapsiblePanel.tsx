import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

type CollapsiblePanelProps = {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: (nextOpen: boolean) => void;
};

export default function CollapsiblePanel({
  title,
  defaultOpen = true,
  children,
  isOpen: controlledOpen,
  onToggle,
}: CollapsiblePanelProps) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setLocalOpen(nextOpen);
      onToggle?.(nextOpen);
    },
    [controlledOpen, onToggle],
  );
  const indicator = useMemo(() => (open ? "▾" : "▸"), [open]);

  return (
    <div
      className={`border-y-1 border-black/15 grid min-h-0 overflow-hidden transition-[grid-template-rows] duration-200 ease-out ${
        open ? "h-full grid-rows-[auto_1fr]" : "grid-rows-[auto_0fr]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-start justify-between w-full px-2 py-1.5 bg-transparent border-none border-b border-black/15 text-xs font-semibold cursor-pointer shrink-0"
      >
        <span className="min-w-0">{title}</span>
        <span className="text-xs">{indicator}</span>
      </button>
      <div className="min-h-0 overflow-hidden">
        <div
          className={`h-full transition-[opacity,transform] duration-200 ease-out ${
            open
              ? "opacity-100 translate-y-0 overflow-auto pointer-events-auto"
              : "opacity-0 -translate-y-0.5 overflow-hidden pointer-events-none"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
