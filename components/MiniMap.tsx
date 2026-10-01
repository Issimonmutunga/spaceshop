"use client";

import { boundsOf } from "@/lib/geometry";
import type { Node } from "@/lib/types";
import { Glyph } from "./Glyph";

/**
 * The quiet map under the answer. Static, auto-fitted, no interaction: the map
 * confirms the answer, it is not the answer. The accent marks one thing only.
 */
export default function MiniMap({
  nodes,
  targetId,
  className = "",
  height = 180,
}: {
  nodes: Node[];
  targetId: string;
  className?: string;
  height?: number;
}) {
  const bounds = boundsOf(nodes.filter((n) => n.kind !== "point" || n.landmark));
  if (!bounds) {
    return (
      <div
        aria-hidden
        className={`rounded-md bg-surface/40 ${className}`}
        style={{ height }}
      />
    );
  }

  const margin = 1.5;
  const w = Math.max(1, bounds.maxX - bounds.minX + margin * 2);
  const h = Math.max(1, bounds.maxY - bounds.minY + margin * 2);
  const target = nodes.find((n) => n.id === targetId);
  const pinX = target ? target.x - (bounds.minX - margin) : w / 2;
  const pinY = target ? target.y - (bounds.minY - margin) : h / 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Where on the map"
      className={`w-full ${className}`}
      style={{ height }}
    >
      {nodes
        .filter((n) => n.kind === "zone")
        .map((zone) => (
          <rect
            key={zone.id}
            x={zone.x - (zone.w ?? 1) / 2 - (bounds.minX - margin)}
            y={zone.y - (zone.h ?? 1) / 2 - (bounds.minY - margin)}
            width={zone.w ?? 1}
            height={zone.h ?? 1}
            rx={0.4}
            fill="var(--surface)"
            stroke="var(--line)"
            strokeWidth={0.05}
          />
        ))}
      {nodes
        .filter((n) => n.kind === "place" && n.id !== targetId)
        .map((place) => (
          <circle
            key={place.id}
            cx={place.x - (bounds.minX - margin)}
            cy={place.y - (bounds.minY - margin)}
            r={0.18}
            fill="var(--ink-quiet)"
            opacity={0.5}
          />
        ))}
      <circle cx={pinX} cy={pinY} r={0.5} fill="var(--accent)" opacity={0.2} />
      <circle cx={pinX} cy={pinY} r={0.22} fill="var(--accent)" />
    </svg>
  );
}

export { Glyph };
