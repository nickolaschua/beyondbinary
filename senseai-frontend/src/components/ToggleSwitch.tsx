"use client";

export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-slate-200">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-9 w-16 rounded-full border transition ${
          checked ? "border-cyan-300 bg-cyan-500/70" : "border-slate-500 bg-slate-800"
        }`}
      >
        <span
          className={`absolute top-0.5 h-7 w-7 rounded-full bg-white transition ${
            checked ? "left-8" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
