import type { Bounds } from "./geometry";
import { boundsOf, sizeOf } from "./geometry";
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
  const { w, h } = sizeOf(node);
  const halfW = w / 2;
  const halfH = h / 2;
  const angle = ((node.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ].map(([x, y]) => ({ x: node.x + x * cos - y * sin, y: node.y + x * sin + y * cos }));
}

/** The area a tap can land on: points get a finger-sized tolerance. */
const areaOf = (node: Node) => {
  const { w, h } = sizeOf(node);
  return node.kind === "point" ? 0 : Math.max(0.01, w * h);
};

/**
 * How far below a footprint its label sits, in screen pixels. The label is part
 * of the target: on a phone the name is what people aim at.
 */
export const LABEL_PAD_PX = 14;

/**
 * True when a screen-space tap lands on a node, tightest target winning.
 * `labelPad` and `labelPadTop` extend the footprint downwards and upwards so
 * the name drawn beside it is part of the same target: on a phone the label is
 * what people aim at.
 *
 * A name is aimed at more precisely than a shape is, so a tap that lands on a
 * label always beats one that merely landed inside a bigger shape. Otherwise
 * a shelf standing in an aisle steals the aisle's name, and the junction point
 * above a door steals the room's.
 */
export function hitTest(
  nodes: Node[],
  camera: Camera,
  point: { x: number; y: number },
  size: Size,
  options: { tolerance?: number; labelPad?: number; labelPadTop?: number } = {},
): Node | undefined {
  const { tolerance = 22, labelPad = 0, labelPadTop = 0 } = options;
  const world = fromCanvas(camera, point, size);
  let named: Node | undefined;
  let namedArea = Infinity;
  let solid: Node | undefined;
  let solidArea = Infinity;
  for (const node of nodes) {
    const { w, h } = sizeOf(node);
    const area = areaOf(node);
    const withinWidth = Math.abs(world.x - node.x) <= w / 2;
    let onShape: boolean;
    if (node.kind === "point") {
      // World meters divided by meters-per-pixel = screen pixels.
      onShape = Math.hypot(node.x - world.x, node.y - world.y) / camera.scale <= tolerance;
    } else {
      onShape = withinWidth && Math.abs(world.y - node.y) <= h / 2;
    }
    if (onShape) {
      if (area < solidArea) {
        solid = node;
        solidArea = area;
      }
      continue;
    }
    if (node.kind === "point") continue;
    // Place names sit below their footprint, area names above it.
    const below = world.y - (node.y + h / 2);
    const above = node.y - h / 2 - world.y;
    if (withinWidth && below <= labelPad && above <= labelPadTop && area < namedArea) {
      named = node;
      namedArea = area;
    }
  }
  return named ?? solid;
}
