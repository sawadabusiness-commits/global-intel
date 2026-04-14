"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  code: string;
  id: string;
}

export default function MermaidDiagram({ code, id }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            fontSize: "12px",
            fontFamily: "system-ui, sans-serif",
          },
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(`mmd-${id}`, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="text-xs text-red-400 p-2 rounded bg-[var(--surface-2)]">
        図解の描画に失敗しました
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container overflow-x-auto py-2"
      style={{ maxWidth: "100%" }}
    />
  );
}
