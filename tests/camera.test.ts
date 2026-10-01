import { describe, expect, it } from "vitest";
import {
  FIT_MARGIN,
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fit,
  fromCanvas,
  hitTest,
  panBy,
  rectPoints,
  toCanvas,
  zoomAt,
  type Camera,
  type Size,
} from "@/lib/camera";
import {
  advance,
  bearingBetween,
  boundsOf,
  normalizeBearing,
  toSteps,
  turnBetween,
} from "@/lib/geometry";
import type { Node } from "@/lib/types";

const node = (over: Partial<Node> & { id: string }): Node => ({
  spaceId: "s",
  kind: "point",
  parentId: null,
  name: over.id,
  x: 0,
  y: 0,
  qr: "AAAAAA",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const size: Size = { width: 390, height: 844 };
const cam = (over: Partial<Camera> = {}): Camera => ({
  scale: 0.05,
  x: 0,
  y: 0,
  ...over,
});

describe("camera", () => {
  it("round-trips canvas and world coordinates", () => {
    const camera = cam({ x: 3, y: -2 });
    const world = { x: 5, y: 4 };
    const back = fromCanvas(camera, toCanvas(camera, world, size), size);
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });

  it("puts the world origin at the viewport centre when centred on it", () => {
    const screen = toCanvas(cam(), { x: 0, y: 0 }, size);
    expect(screen.x).toBe(size.width / 2);
    expect(screen.y).toBe(size.height / 2);
  });

  it("puts the fitted centre at the centre of the viewport", () => {
    const nodes = [node({ id: "a", x: 0, y: 0 }), node({ id: "b", x: 2, y: 1 })];
    const centre = toCanvas(fit(nodes, size), { x: 1, y: 0.5 }, size);
    expect(centre.x).toBeCloseTo(size.width / 2, 6);
    expect(centre.y).toBeCloseTo(size.height / 2, 6);
  });

  it("fits everything inside the viewport with margin", () => {
    // A real shop: 24 m by 30 m, plus a zone footprint.
    const nodes = [
      node({ id: "a", x: 0, y: 0 }),
      node({ id: "b", x: 24, y: -30, kind: "zone", w: 8, h: 6 }),
    ];
    const camera = fit(nodes, size);
    expect(camera.scale).toBeGreaterThan(MIN_SCALE);
    expect(camera.scale).toBeLessThanOrEqual(MAX_SCALE);
    for (const n of nodes) {
      const p = toCanvas(camera, n, size);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(size.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(size.height);
    }
  });

  it("scales so a 24 m room fills a phone", () => {
    // The unit that matters: m/px. 24 m across 390 px, with a 1.35 margin,
    // is about 290 px of separation. Getting this backwards silently pins the
    // camera at its zoom limit and the whole shop collapses to a dot.
    const nodes = [node({ id: "a", x: 0, y: 0 }), node({ id: "b", x: 24, y: 0 })];
    const camera = fit(nodes, size);
    const separation = Math.abs(toCanvas(camera, nodes[1], size).x - toCanvas(camera, nodes[0], size).x);
    expect(separation).toBeGreaterThan(size.width / FIT_MARGIN - 1);
    expect(separation).toBeLessThan(size.width / FIT_MARGIN + 1);
  });

  it("uses metres per pixel, not pixels per metre", () => {
    const nodes = [node({ id: "a", x: 0, y: 0 }), node({ id: "b", x: 10, y: 0 })];
    const camera = fit(nodes, size);
    // 10 m wide, margin 1.35, on a 390 px phone: 10 * 1.35 / 390 m/px.
    expect(camera.scale).toBeCloseTo((10 * FIT_MARGIN) / size.width, 4);
  });

  it("falls back to the identity camera for an empty space", () => {
    expect(fit([], size)).toEqual(IDENTITY);
  });

  it("clamps the zoom range", () => {
    expect(clampScale(0.0000001)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
  });

  it("keeps the anchored point still while zooming", () => {
    const camera = cam({ x: 4, y: 6 });
    const anchor = { x: 120, y: 400 };
    const worldBefore = fromCanvas(camera, anchor, size);
    const zoomed = zoomAt(camera, anchor, 2, size);
    const worldAfter = fromCanvas(zoomed, anchor, size);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
    expect(zoomed.scale).toBeCloseTo(0.1, 6);
  });

  it("pans by a screen delta, in meters", () => {
    const camera = cam({ x: 4, y: 6 });
    const panned = panBy(camera, 100, -50);
    expect(panned.x).toBeCloseTo(4 - 100 * 0.05, 6);
    expect(panned.y).toBeCloseTo(6 + 50 * 0.05, 6);
    expect(panned.scale).toBe(camera.scale);
  });

  it("never zooms out past the clamp while pinching", () => {
    const zoomed = zoomAt(cam({ scale: 0.02 }), { x: 0, y: 0 }, 0.01, size);
    expect(zoomed.scale).toBe(MIN_SCALE);
  });
});

describe("hit testing", () => {
  const camera = cam(); // 1 m = 20 px
  const nodes = [
    node({ id: "point", x: 0, y: 0 }),
    node({ id: "zone", kind: "zone", x: 5, y: 0, w: 4, h: 4 }),
    node({ id: "place", kind: "place", x: -5, y: 0, w: 0.8, h: 3 }),
  ];

  it("selects a point within the finger tolerance", () => {
    expect(hitTest(nodes, camera, { x: 210, y: 432 }, size)?.id).toBe("point");
  });

  it("ignores a point beyond the tolerance", () => {
    // 30 px away: outside the 22 px target, and on empty ground.
    expect(hitTest(nodes, camera, { x: 240, y: 432 }, size)).toBeUndefined();
  });

  it("selects the tightest footprint under the finger", () => {
    const overlapping = [
      node({ id: "big", kind: "zone", x: 0, y: 0, w: 10, h: 10 }),
      node({ id: "small", kind: "place", x: 0, y: 0, w: 1, h: 1 }),
      node({ id: "dot", x: 0, y: 0 }),
    ];
    expect(hitTest(overlapping, camera, { x: 195, y: 422 }, size)?.id).toBe("dot");
    expect(hitTest(overlapping.slice(0, 2), camera, { x: 205, y: 432 }, size)?.id).toBe(
      "small",
    );
  });

  it("selects a zone anywhere inside it", () => {
    // 4.9 m east of the origin is inside the zone (3 m to 7 m).
    expect(hitTest(nodes, camera, { x: 195 + 4.9 * 20, y: 422 }, size)?.id).toBe("zone");
  });

  it("misses empty ground", () => {
    expect(hitTest(nodes, camera, { x: 300, y: 700 }, size)).toBeUndefined();
  });

  it("treats the name under a place as part of it", () => {
    // 14 px below a 0.6 m tall place: outside the shape, inside the label.
    const place = node({ id: "p", kind: "place", x: 0, y: 0, w: 0.8, h: 0.6 });
    const below = { x: size.width / 2, y: size.height / 2 + 0.3 * 20 + 8 };
    expect(hitTest([place], camera, below, size)).toBeUndefined();
    expect(
      hitTest([place], camera, below, size, { labelPad: 14 * camera.scale })?.id,
    ).toBe("p");
  });

  it("treats the name above an area as part of it", () => {
    const zone = node({ id: "z", kind: "zone", x: 0, y: 0, w: 6, h: 7 });
    const above = { x: size.width / 2, y: size.height / 2 - 3.5 * 20 - 8 };
    expect(hitTest([zone], camera, above, size)).toBeUndefined();
    expect(
      hitTest([zone], camera, above, size, { labelPadTop: 14 * camera.scale })?.id,
    ).toBe("z");
  });

  it("prefers a place over the area it sits in, label taps included", () => {
    // Seeded places have no stored size: they fall back to the same footprint
    // the drawing uses, so a tap on the name picks the place and not the room.
    const room = node({ id: "room", kind: "zone", x: 0, y: 0, w: 6, h: 7 });
    const shelf = node({ id: "shelf", kind: "place", x: 0, y: -1.5 });
    const pad = { labelPad: 14 * camera.scale, labelPadTop: 14 * camera.scale };
    const middle = size.height / 2 - 1.5 * 20;
    expect(hitTest([room, shelf], camera, { x: size.width / 2, y: middle }, size, pad)?.id).toBe(
      "shelf",
    );
    // Its name sits about 0.7 m below its centre, still inside the room.
    const onLabel = { x: size.width / 2, y: middle + 0.7 * 20 };
    expect(hitTest([room, shelf], camera, onLabel, size, pad)?.id).toBe("shelf");
  });

  it("prefers a name to a shape it happens to overlap", () => {
    // The name above the room sits right by the junction point at its top edge.
    const room = node({ id: "room", kind: "zone", x: 0, y: 0, w: 6, h: 7 });
    const door = node({ id: "door", kind: "point", x: 0, y: -3 });
    const pad = { labelPad: 14 * camera.scale, labelPadTop: 14 * camera.scale };
    const onRoomName = { x: size.width / 2, y: size.height / 2 - 3.5 * 20 - 4 };
    expect(hitTest([room, door], camera, onRoomName, size, pad)?.id).toBe("room");
    // The junction itself is still tappable.
    expect(
      hitTest([room, door], camera, { x: size.width / 2, y: size.height / 2 - 3 * 20 }, size, pad)
        ?.id,
    ).toBe("door");
  });
});

describe("rectangles", () => {
  it("returns four corners around the centre", () => {
    const points = rectPoints(node({ id: "z", kind: "zone", x: 2, y: 3, w: 4, h: 2 }));
    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(Math.abs(p.x - 2)).toBeLessThanOrEqual(2.0001);
      expect(Math.abs(p.y - 3)).toBeLessThanOrEqual(1.0001);
    }
  });

  it("rotates the corners around the centre", () => {
    const [first] = rectPoints(
      node({ id: "z", kind: "zone", x: 0, y: 0, w: 4, h: 2, rotation: 90 }),
    );
    expect(first.x).toBeCloseTo(1, 6);
    expect(first.y).toBeCloseTo(-2, 6);
  });
});

describe("bearings and distances", () => {
  const origin = node({ id: "o", x: 0, y: 0 });

  it("measures bearings clockwise from canvas up", () => {
    expect(bearingBetween(origin, node({ id: "n", x: 0, y: -5 }))).toBeCloseTo(0, 3);
    expect(bearingBetween(origin, node({ id: "e", x: 5, y: 0 }))).toBeCloseTo(90, 3);
    expect(bearingBetween(origin, node({ id: "s", x: 0, y: 5 }))).toBeCloseTo(180, 3);
    expect(bearingBetween(origin, node({ id: "w", x: -5, y: 0 }))).toBeCloseTo(270, 3);
  });

  it("normalises into 0..360", () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(450)).toBe(90);
  });

  it("advances a bearing and a distance from a point", () => {
    expect(advance(origin, 0, 10).x).toBeCloseTo(0, 6);
    expect(advance(origin, 0, 10).y).toBeCloseTo(-10, 6);
    expect(advance(origin, 90, 10).x).toBeCloseTo(10, 6);
    expect(advance(origin, 180, 10).y).toBeCloseTo(10, 6);
    expect(advance(origin, 270, 10).x).toBeCloseTo(-10, 6);
  });

  it("round-trips advance and bearing", () => {
    const from = node({ id: "f", x: 3, y: -2 });
    const to = advance(from, 47, 6.5);
    const round = bearingBetween(from, node({ id: "t", ...to }));
    expect(round).toBeCloseTo(47, 3);
  });

  it("describes turns the way a person would", () => {
    expect(turnBetween(0, 90)).toBeCloseTo(90, 3);
    expect(turnBetween(90, 0)).toBeCloseTo(-90, 3);
    expect(turnBetween(350, 10)).toBeCloseTo(20, 3); // across north
    expect(Math.abs(turnBetween(0, 180))).toBeCloseTo(180, 3);
  });

  it("counts steps in a round scale", () => {
    expect(toSteps(7.5)).toBe(10);
    expect(toSteps(30)).toBe(40);
    expect(toSteps(0.1)).toBe(5);
  });
});

describe("bounds", () => {
  it("covers zone footprints, not just centres", () => {
    const b = boundsOf([
      node({ id: "a", kind: "zone", x: 0, y: 0, w: 4, h: 2 }),
      node({ id: "b", x: 10, y: 0 }),
    ])!;
    expect(b.minX).toBe(-2);
    expect(b.maxX).toBe(10);
    expect(b.maxY).toBe(1);
  });

  it("is null when there is nothing to show", () => {
    expect(boundsOf([])).toBeNull();
  });
});
