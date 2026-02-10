"use client";

import type { BrailleCellPattern } from "@/braille/mapping";
import clsx from "clsx";

interface BrailleCellProps {
  pattern: BrailleCellPattern;
  isNew?: boolean;
}

export function BrailleCell({ pattern, isNew }: BrailleCellProps) {
  return (
    <div
      className={clsx(
        "inline-flex flex-col justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 mr-3",
        "shadow-sm",
        isNew && "animate-braille-flash"
      )}
      aria-hidden="true"
    >
      <div className="flex gap-2 mb-1">
        <BrailleDot on={pattern[0]} />
        <BrailleDot on={pattern[3]} />
      </div>
      <div className="flex gap-2 mb-1">
        <BrailleDot on={pattern[1]} />
        <BrailleDot on={pattern[4]} />
      </div>
      <div className="flex gap-2">
        <BrailleDot on={pattern[2]} />
        <BrailleDot on={pattern[5]} />
      </div>
    </div>
  );
}

function BrailleDot({ on }: { on: boolean }) {
  return (
    <div
      className={clsx(
        "h-4 w-4 rounded-full border border-slate-600",
        on ? "bg-slate-100 shadow-[0_0_0_2px_rgba(148,163,184,0.6)]" : "bg-slate-800"
      )}
    />
  );
}
