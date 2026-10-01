import type { Bounds } from "./geometry";
import { boundsOf } from "./geometry";
import type { Node } from "./types";

/**
 * A 2D camera over the space, in meters. The canvas has no boundary: the view
 * is whatever the camera says it is, and it fits the content with margin.
 *
 * Pure functions only, so panning and zooming are testable without a browser.
 */
export interface Camera {
  /** meters per css pixel */
  scale: number;
  /** canvas point shown at the centre of the viewport */
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const IDENTITY: Camera = { scale: 0.05, x: 0, y: 0 };

/** Meters per pixel. Small = far out, large = close in. */
export const MIN_SCALE = 0.005; // a 390 px phone sees 2 m across
export const MAX_SCALE = 0.5; // and 195 m across
export const FIT_MARGIN = 1.35; // generous empty space, per section 5

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clampScale = (scale: number) => clamp(scale, MIN_SCALE, MAX_SCALE);

/** Canvas coordinates, origin at the centre of the viewport. */
export const toCanvas = (camera: Camera, point: { x: number; y: number }, size: Size) => ({
  x: (point.x - camera.x) / camera.scale + size.width / 2,
  y: (point.y - camera.y) / camera.scale + size.height / 2,
});

export const fromCanvas = (camera: Camera, point: { x: number; y: number }, size: Size) => ({
  x: camera.x + (point.x - size.width / 2) * camera.scale,
  y: camera.y + (point.y - size.height / 2) * camera.scale,
});

/** Fits the given nodes with a generous margin. Returns a centred camera. */
export function fit(nodes: Node[], size: Size, bounds?: Bounds | null): Camera {
  const b = bounds ?? boundsOf(nodes);
  if (!b || size.width === 0 || size.height === 0) return IDENTITY;
  const w = Math.max(0.5, b.maxX - b.minX);
  const h = Math.max(0.5, b.maxY - b.minY);
  // Pixels per metre that fit, then inverted: the camera stores m/px.
  const pixelsPerMeter = Math.min(
    size.width / (w * FIT_MARGIN),
    size.height / (h * FIT_MARGIN),
  );
  const scale = clamp(1 / pixelsPerMeter, MIN_SCALE, MAX_SCALE);
  return { scale, x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

export function zoomAt(
  camera: Camera,
  anchor: { x: number; y: number },
  factor: number,
  size: Size,
): Camera {
  const scale = clampScale(camera.scale * factor);
  // Keep the point under the fingers where it is.
  const before = fromCanvas(camera, anchor, size);
  const after = fromCanvas({ ...camera, scale }, anchor, size);
  return {
    scale,
    x: camera.x + (before.x - after.x),
    y: camera.y + (before.y - after.y),
  };
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  // dx/dy are screen pixels, so they must be converted to meters.
  return {
    ...camera,
    x: camera.x - dx * camera.scale,
    y: camera.y - dy * camera.scale,
  };
}

/** A rectangle drawn with rotation, as a polygon of points. */
export function rectPoints(node: Node): Array<{ x: number; y: number }> {
  const w = (node.w ?? 1) / 2;
  const h = (node.h ?? 1) / 2;
  const angle = ((node.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-w, -h],
    [w, -h],
    [w, h],
    [-w, h],
  ].map(([x, y]) => ({ x: node.x + x * cos - y * sin, y: node.y + x * sin + y * cos }));
}

/** The area a tap can land on: points get a finger-sized tolerance. */
const areaOf = (node: Node) =>
  node.kind === "point" ? 0 : Math.max(0.01, (node.w ?? 1) * (node.h ?? 1));

/**
 * True when a screen-space tap lands on a node, tightest target winning.
 * `labelPad` extends a footprint downwards, so the name under a place is part
 * of the same target: on a phone the label is what people aim at.
 */
export function hitTest(
  nodes: Node[],
  camera: Camera,
  point: { x: number; y: number },
  size: Size,
  options: { tolerance?: number; labelPad?: number } = {},
): Node | undefined {
  const { tolerance = 22, labelPad = 0 } = options;
  const world = fromCanvas(camera, point, size);
  let best: Node | undefined;
  let bestArea = Infinity;
  for (const node of nodes) {
    let inside: boolean;
    if (node.kind === "point") {
      // World meters divided by meters-per-pixel = screen pixels.
      inside = Math.hypot(node.x - world.x, node.y - world.y) / camera.scale <= tolerance;
    } else {
      const dx = Math.abs(world.x - node.x) - (node.w ?? 1) / 2;
      const dy = Math.abs(world.y - node.y) - (node.h ?? 1) / 2 - labelPad;
      inside = dx <= 0 && dy <= 0;
    }
    if (!inside) continue;
    const area = areaOf(node);
    if (area < bestArea) {
      best = node;
      bestArea = area;
    }
  }
  return best;
}
