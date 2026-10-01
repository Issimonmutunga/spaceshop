import type { Node } from "./types";

/**
 * Canvas is x right, y down. Bearings are degrees clockwise from canvas up,
 * which is how a person holds a compass.
 */
export const bearingBetween = (from: Node, to: Node) =>
  normalizeBearing((Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI);

/** Advance a distance and a bearing from a point. The survey traverse. */
export const advance = (from: Node, bearing: number, meters: number) => {
  const rad = (bearing * Math.PI) / 180;
  return {
    x: from.x + meters * Math.sin(rad),
    y: from.y - meters * Math.cos(rad),
  };
};

export const normalizeBearing = (deg: number) => (deg % 360 + 360) % 360;

/** Smallest signed turn from a to b, in (-180, 180]. Positive = clockwise. */
export const turnBetween = (a: number, b: number) => {
  let d = normalizeBearing(b - a);
  if (d > 180) d -= 360;
  return d;
};

export const COMPASS = [
  { deg: 0, abbr: "N" },
  { deg: 45, abbr: "NE" },
  { deg: 90, abbr: "E" },
  { deg: 135, abbr: "SE" },
  { deg: 180, abbr: "S" },
  { deg: 225, abbr: "SW" },
  { deg: 270, abbr: "W" },
  { deg: 315, abbr: "NW" },
] as const;

/** A step is a comfortable stride. Distances are shown as steps, never metres. */
export const STEP_METERS = 0.75;

/**
 * Rounds to a round number of steps, because "about twenty steps" is something
 * people keep in their heads and "17 steps" is not. Sub-metre moves still get
 * a plural count rather than "1 step".
 */
export const toSteps = (meters: number) =>
  Math.max(5, Math.round(meters / STEP_METERS / 5) * 5);

export const stepPhrase = (meters: number) => `about ${toSteps(meters)} steps`;

export const formatDistance = (meters: number, units: "m" | "ft") => {
  if (units === "ft") {
    const ft = meters * 3.28084;
    return ft < 10 ? `${ft.toFixed(1)} ft` : `${Math.round(ft)} ft`;
  }
  return meters < 10 ? `${meters.toFixed(1)} m` : `${Math.round(meters)} m`;
};

export const snapToGrid = (value: number, step = 0.5) =>
  Math.round(value / step) * step;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(nodes: Node[]): Bounds | null {
  if (!nodes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const w = n.kind === "point" ? 0 : (n.w ?? 1);
    const h = n.kind === "point" ? 0 : (n.h ?? 1);
    minX = Math.min(minX, n.x - w / 2);
    maxX = Math.max(maxX, n.x + w / 2);
    minY = Math.min(minY, n.y - h / 2);
    maxY = Math.max(maxY, n.y + h / 2);
  }
  return { minX, minY, maxX, maxY };
}
