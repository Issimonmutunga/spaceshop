"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  fit,
  fromCanvas,
  hitTest,
  LABEL_PAD_PX,
  panBy,
  rectPoints,
  zoomAt,
  type Camera,
  type Size,
} from "@/lib/camera";
import { sizeOf } from "@/lib/geometry";
import type { Edge, ID, Item, Node } from "@/lib/types";

/**
 * The map: an SVG canvas with no boundary. Everything is in meters, so the
 * drawing is data, not pixels, and a survey stays honest.
 *
 * One accent thing at a time: the selected node, or the answer's pin.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Drag gestures, in world meters. The canvas already knows its camera, so it
 * hands over coordinates and the node under the finger: no editor should ever
 * have to reverse-engineer a transform.
 */
export interface DrawHandlers {
  start: (world: Point, hit: Node | undefined) => void;
  move: (world: Point) => void;
  end: (world: Point, hit: Node | undefined) => void;
}

export default function MapCanvas({
  nodes,
  edges = [],
  items = [],
  selectedId = null,
  onSelect,
  /** when set, drags draw instead of panning: the editor's gesture channel */
  draw = null,
  targetId = null,
  fitKey = "",
  className = "",
  height,
  overlay,
}: {
  nodes: Node[];
  edges?: Edge[];
  items?: Item[];
  selectedId?: ID | null;
  onSelect?: (id: ID | null) => void;
  draw?: DrawHandlers | null;
  /** the answer's node: drawn as the single accent */
  targetId?: ID | null;
  /** change this to re-fit, e.g. when the space or seed changes */
  fitKey?: string;
  className?: string;
  height?: number | string;
  /** a draft shape or measure line, drawn above the map */
  overlay?: React.ReactNode;
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  // The auto-fitted camera is derived, not stored, so it always matches the
  // data. `manual` is the user's own pan/zoom, valid until the key changes.
  const [manual, setManual] = useState<{ key: string; camera: Camera } | null>(null);
  const key = `${fitKey}:${nodes.length}`;
  const auto = useMemo(() => (size.width > 0 ? fit(nodes, size) : null), [nodes, size]);
  const camera = (manual && manual.key === key && auto ? manual.camera : auto) ?? null;

  // Live ref: pointer moves must not read a camera captured at render time.
  // A layout effect, not a passive one, so a tap in the first frame after the
  // map appears finds a camera instead of being swallowed.
  const cameraRef = useRef<Camera | null>(camera);
  useLayoutEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  const origin = useRef({ left: 0, top: 0 });

  const measure = useCallback((element: SVGSVGElement | null) => {
    if (!element) return;
    const box = element.getBoundingClientRect();
    origin.current = { left: box.left, top: box.top };
    setSize({ width: box.width, height: box.height });
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const countByPlace = useMemo(() => {
    const counts = new Map<ID, number>();
    for (const item of items) counts.set(item.placeId, (counts.get(item.placeId) ?? 0) + 1);
    return counts;
  }, [items]);

  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ last: Point; moved: number; at: number } | null>(null);
  const pinch = useRef<{ distance: number } | null>(null);

  /**
   * The name under a place and the name above an area are part of the target,
   * so every tap is tested with that extra reach. `scale` is meters per pixel,
   * hence pixels * scale meters.
   */
  const pad = (camera: Camera) => ({
    labelPad: LABEL_PAD_PX * camera.scale,
    labelPadTop: LABEL_PAD_PX * camera.scale,
  });

  const local = (event: { clientX: number; clientY: number }): Point => ({
    x: event.clientX - origin.current.left,
    y: event.clientY - origin.current.top,
  });

  const apply = (next: Camera | null) => {
    if (!next) return;
    cameraRef.current = next;
    setManual({ key, camera: next });
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const camera = cameraRef.current;
    if (!camera) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      drag.current = { last: point, moved: 0, at: Date.now() };
      pinch.current = null;
      // In draw mode a finger means one thing only: edit, not navigate.
      if (draw) {
        draw.start(fromCanvas(camera, point, size), hitTest(nodes, camera, point, size, pad(camera)));
      }
    } else if (pointers.current.size === 2) {
      drag.current = null;
      pinch.current = { distance: spread(pointers.current) };
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = cameraRef.current;
    if (!current || !pointers.current.has(event.pointerId)) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size === 2 && pinch.current) {
      const distance = spread(pointers.current);
      const factor = distance / (pinch.current.distance || distance);
      pinch.current = { distance };
      if (factor > 0) apply(zoomAt(current, point, factor, size));
      return;
    }

    if (draw) {
      draw.move(fromCanvas(current, point, size));
      return;
    }

    if (!drag.current) return;
    const dx = point.x - drag.current.last.x;
    const dy = point.y - drag.current.last.y;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    drag.current.last = point;
    if (dx || dy) apply(panBy(current, dx, dy));
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = local(event);
    const camera = cameraRef.current;
    if (draw) {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (camera) {
        draw.end(fromCanvas(camera, point, size), hitTest(nodes, camera, point, size, pad(camera)));
      }
      return;
    }
    const wasTap =
      drag.current !== null &&
      drag.current.moved < 8 &&
      Date.now() - drag.current.at < 500 &&
      pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!wasTap || !camera || !onSelect) return;
    onSelect(hitTest(nodes, camera, point, size, pad(camera))?.id ?? null);
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!cameraRef.current) return;
    apply(zoomAt(cameraRef.current, local(event), Math.exp(-event.deltaY * 0.0015), size));
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const current = cameraRef.current;
    if (!current) return;
    const centre = { x: size.width / 2, y: size.height / 2 };
    const step = 40;
    const actions: Record<string, Camera> = {
      ArrowLeft: panBy(current, step, 0),
      ArrowRight: panBy(current, -step, 0),
      ArrowUp: panBy(current, 0, step),
      ArrowDown: panBy(current, 0, -step),
      "+": zoomAt(current, centre, 1.2, size),
      "=": zoomAt(current, centre, 1.2, size),
      "-": zoomAt(current, centre, 1 / 1.2, size),
    };
    const next = actions[event.key];
    if (!next) return;
    event.preventDefault();
    apply(next);
  };

  // Screen = world / scale, so a size that must look N pixels tall is
  // N * scale meters. Getting this backwards puts labels kilometres away.
  const hairline = camera ? camera.scale : 0.001;
  const labelSize = camera ? 12 * camera.scale : 0.01;
  const dot = (meters: number, minPixels: number) =>
    camera ? Math.max(meters, minPixels * camera.scale) : meters;
  const transform = camera
    ? `translate(${size.width / 2} ${size.height / 2}) scale(${1 / camera.scale}) translate(${
        -camera.x
      } ${-camera.y})`
    : "";

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height }}>
      <svg
        ref={measure}
        role="application"
        aria-label="Map of the space. Drag to pan, pinch to zoom, tap a node to open it."
        tabIndex={0}
        className="block h-full w-full touch-none select-none outline-none"
        style={{ background: "var(--paper)", overscrollBehavior: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {camera && (
          <g transform={transform}>
            {edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;
              const touches = from.id === selectedId || to.id === selectedId;
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={touches ? "var(--accent)" : "var(--line)"}
                  strokeWidth={(touches ? 2.5 : 1.5) * hairline}
                  strokeLinecap="round"
                />
              );
            })}

            {nodes
              .filter((node) => node.kind === "zone")
              .map((zone) => {
                const selected = zone.id === selectedId;
                return (
                  <g key={zone.id}>
                    <polygon
                      points={rectPoints(zone)
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      fill={selected ? "var(--accent-soft)" : "var(--surface)"}
                      stroke={selected ? "var(--accent)" : "var(--line)"}
                      strokeWidth={(selected ? 2 : 1) * hairline}
                    />
                    <text
                      x={zone.x}
                      y={zone.y - (zone.h ?? 1) / 2 - labelSize * 0.4}
                      textAnchor="middle"
                      fontSize={labelSize}
                      fill="var(--ink-quiet)"
                    >
                      {zone.name}
                    </text>
                  </g>
                );
              })}

            {nodes
              .filter((node) => node.kind === "place")
              .map((place) => {
                const selected = place.id === selectedId;
                const { w, h } = sizeOf(place);
                return (
                  <g key={place.id} opacity={place.id === targetId ? 0.5 : 1}>
                    <rect
                      x={place.x - w / 2}
                      y={place.y - h / 2}
                      width={w}
                      height={h}
                      rx={0.12}
                      fill={selected ? "var(--accent-soft)" : "var(--surface-2)"}
                      stroke={selected ? "var(--accent)" : "var(--line)"}
                      strokeWidth={(selected ? 2 : 1) * hairline}
                    />
                    <text
                      x={place.x}
                      y={place.y + h / 2 + labelSize * 0.9}
                      textAnchor="middle"
                      fontSize={labelSize}
                      fill="var(--ink-quiet)"
                    >
                      {place.name}
                    </text>
                    {(countByPlace.get(place.id) ?? 0) > 0 && (
                      <circle
                        cx={place.x + w / 2 + labelSize * 0.3}
                        cy={place.y - h / 2}
                        r={labelSize * 0.3}
                        fill="var(--ink-quiet)"
                        opacity={0.6}
                      />
                    )}
                  </g>
                );
              })}

            {nodes
              .filter((node) => node.kind === "point")
              .map((point) => {
                const selected = point.id === selectedId;
                return (
                  <circle
                    key={point.id}
                    cx={point.x}
                    cy={point.y}
                    r={dot(point.landmark ? 0.28 : 0.15, 6) + (selected ? dot(0, 8) : 0)}
                    fill={selected ? "var(--accent)" : "var(--ink-quiet)"}
                    opacity={point.landmark || selected ? 1 : 0.5}
                  />
                );
              })}

            {nodes
              .filter((node) => node.id === targetId)
              .map((point) => (
                <g key={`pin-${point.id}`}>
                  <circle cx={point.x} cy={point.y} r={dot(0.6, 6)} fill="var(--accent)" opacity={0.18} />
                  <circle cx={point.x} cy={point.y} r={dot(0.18, 4)} fill="var(--accent)" />
                </g>
              ))}
          </g>
        )}
      </svg>

      {camera && (
        <div className="pointer-events-none absolute bottom-2 left-2">
          <ScaleBar camera={camera} />
        </div>
      )}
      {overlay}
      <button
        type="button"
        onClick={() => setManual(null)}
        className="absolute bottom-2 right-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs text-ink shadow-sm"
      >
        Fit
      </button>
    </div>
  );
}

/** A human scale bar: the biggest round distance that fits the width. */
function ScaleBar({ camera }: { camera: Camera }) {
  const choice = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]
    .map((metres) => ({ metres, pixels: metres / camera.scale }))
    .filter((c) => c.pixels <= 140)
    .pop();
  if (!choice) return null;
  return (
    <span className="flex flex-col items-start gap-0.5 text-[11px] text-quiet">
      <span
        className="border-x border-b border-ink/40"
        style={{ width: Math.max(12, choice.pixels), height: 6 }}
      />
      {choice.metres < 1 ? `${Math.round(choice.metres * 100)} cm` : `${choice.metres} m`}
    </span>
  );
}

const spread = (points: Map<number, Point>) => {
  const [a, b] = [...points.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
