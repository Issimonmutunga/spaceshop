import { bearingBetween, normalizeBearing, snapToGrid } from "./geometry";
import type { ID, Node, NodeKind } from "./types";

/**
 * Editing maths, kept pure so the tools can be reasoned about and tested
 * without a canvas. Nothing here touches the database.
 */

/** A point in world meters. */
export interface Point {
  x: number;
  y: number;
}

/** How close to a shape still counts as touching it, in meters. */
export const TOUCH = 0.05;

export const snap = (value: number, step = 0.1) => snapToGrid(value, step);

/**
 * The smallest zone containing a point: the natural parent for a new place, so
 * "Add here" lands inside the room you tapped without being asked.
 */
export function zoneAt(nodes: Node[], world: Point): Node | undefined {
  let best: Node | undefined;
  let bestArea = Infinity;
  for (const node of nodes) {
    if (node.kind !== "zone") continue;
    if (!containsPoint(node, world)) continue;
    const area = (node.w ?? 1) * (node.h ?? 1);
    if (area < bestArea) {
      best = node;
      bestArea = area;
    }
  }
  return best;
}

/** Inside a node's footprint, rotation ignored: zones are axis-aligned. */
export function containsPoint(node: Node, world: Point, pad = 0): boolean {
  if (node.kind === "point") {
    return Math.hypot(node.x - world.x, node.y - world.y) <= TOUCH + pad;
  }
  return (
    Math.abs(world.x - node.x) <= (node.w ?? 1) / 2 + pad &&
    Math.abs(world.y - node.y) <= (node.h ?? 1) / 2 + pad
  );
}

/** A zone drawn by dragging between two corners, in any direction. */
export function rectFromDrag(a: Point, b: Point, step = 0.1): Rect {
  const ax = snap(a.x, step);
  const ay = snap(a.y, step);
  const bx = snap(b.x, step);
  const by = snap(b.y, step);
  const w = Math.max(MIN_ZONE, Math.abs(bx - ax));
  const h = Math.max(MIN_ZONE, Math.abs(by - ay));
  return { x: (ax + bx) / 2, y: (ay + by) / 2, w, h };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_ZONE = 0.4;

/** Distance and bearing between two points, the survey's two measurements. */
export function measures(a: Point, b: Point) {
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    bearing: normalizeBearing(
      (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI,
    ),
  };
}

/** The same measurements, rounded for display and for storage. */
export const roundMeasure = (value: number) => Math.round(value * 10) / 10;

/**
 * A rounded bearing that is still a bearing. Rounding a normalized angle can
 * land on 360, and nothing downstream should ever have to know that.
 */
export const roundBearing = (deg: number) => {
  const rounded = roundMeasure(deg) % 360;
  return rounded < 0 ? rounded + 360 : rounded;
};

export const edgeMeasures = (a: Node, b: Node) => {
  const m = measures(a, b);
  return { distance: roundMeasure(m.distance), bearing: roundBearing(m.bearing) };
};

/** "Zone 3": names people can say out loud, numbered from what exists. */
export function nextName(kind: NodeKind, nodes: Node[], stem = ""): string {
  const base: Record<NodeKind, string> = {
    zone: stem || "Zone",
    place: stem || "Place",
    point: stem || "Point",
  };
  const prefix = `${base[kind]} `;
  const highest = nodes
    .filter((node) => node.kind === kind && node.name.startsWith(prefix))
    .reduce((max, node) => {
      const value = Number(node.name.slice(prefix.length).trim());
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
  return `${prefix}${highest + 1}`;
}

/** Which node a new node belongs under, if any. */
export function parentFor(nodes: Node[], kind: NodeKind, world: Point): ID | null {
  if (kind !== "place") return null;
  return zoneAt(nodes, world)?.id ?? null;
}

export interface DraftProblem {
  field: "name" | "size";
  message: string;
}

/** Enough validation to stop a nameless node or a zero-size zone. */
export function problems(draft: { name: string; kind: NodeKind; w?: number; h?: number }) {
  const found: DraftProblem[] = [];
  if (!draft.name.trim()) found.push({ field: "name", message: "Give it a name" });
  // Only zones are floored: a place can be a 40 cm gap, a room cannot.
  if (
    draft.kind === "zone" &&
    ((draft.w ?? 0) < MIN_ZONE || (draft.h ?? 0) < MIN_ZONE)
  ) {
    found.push({ field: "size", message: "Too small to be real" });
  }
  return found;
}

/** Turn on a tap into an edge between two nodes. */
export function canConnect(a: Node | undefined, b: Node | undefined): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return false;
  return a.kind !== "zone" || b.kind !== "zone";
}

export { bearingBetween };
