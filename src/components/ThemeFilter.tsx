"use client";

import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/types";

interface Props {
  selected: ThemeId | null;
  onSelect: (id: ThemeId | null) => void;
}

export default function ThemeFilter({ selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{
          background: selected === null ? "#E2E8F0" : "var(--surface-2)",
          color: selected === null ? "#06080E" : "var(--muted)",
          border: `1px solid ${selected === null ? "#E2E8F0" : "var(--border)"}`,
        }}
      >
        ALL
      </button>
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          onClick={() => onSelect(theme.id)}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            background: selected === theme.id ? theme.color + "20" : "var(--surface-2)",
            color: selected === theme.id ? theme.color : "var(--muted)",
            border: `1px solid ${selected === theme.id ? theme.color : "var(--border)"}`,
          }}
        >
          {theme.icon} {theme.labelJa}
        </button>
      ))}
    </div>
  );
}
