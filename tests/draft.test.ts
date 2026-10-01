import { describe, expect, it } from "vitest";
import {
  MIN_ZONE,
  TOUCH,
  canConnect,
  containsPoint,
  edgeMeasures,
  measures,
  nextName,
  parentFor,
  problems,
  rectFromDrag,
  zoneAt,
} from "@/lib/draft";
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

describe("zones and parents", () => {
  const shop = node({ id: "shop", kind: "zone", x: 10, y: 10, w: 20, h: 12 });
  const freezer = node({
    id: "freezer",
    kind: "zone",
    x: 16,
    y: 10,
    w: 4,
    h: 4,
    parentId: "shop",
  });
  const nodes = [shop, freezer];

  it("finds the zone a tap landed in", () => {
    expect(zoneAt(nodes, { x: 12, y: 11 })?.id).toBe("shop");
  });

  it("prefers the smallest zone, so nested rooms win", () => {
    expect(zoneAt(nodes, { x: 16, y: 10 })?.id).toBe("freezer");
  });

  it("finds nothing outside every zone", () => {
    expect(zoneAt(nodes, { x: 40, y: 40 })).toBeUndefined();
  });

  it("gives a new place the zone it sits in", () => {
    expect(parentFor(nodes, "place", { x: 16, y: 10 })).toBe("freezer");
    expect(parentFor(nodes, "point", { x: 16, y: 10 })).toBeNull();
  });

  it("tests containment with a finger's slack", () => {
    // 10 m half-width: the edge is at x = 20.
    expect(containsPoint(shop, { x: 19.95, y: 16 })).toBe(true);
    expect(containsPoint(shop, { x: 20.05, y: 16 })).toBe(false);
    expect(containsPoint(shop, { x: 20, y: 16 })).toBe(true);
    expect(containsPoint(node({ id: "p", x: 5, y: 5 }), { x: 5, y: 5 })).toBe(true);
    expect(containsPoint(node({ id: "p", x: 5, y: 5 }), { x: 5.5, y: 5 })).toBe(false);
    expect(TOUCH).toBeGreaterThan(0);
  });
});

describe("drawing a zone", () => {
  it("normalises a drag in any direction", () => {
    const dragged = rectFromDrag({ x: 10, y: 4 }, { x: 2, y: 8 });
    expect(dragged).toEqual({ x: 6, y: 6, w: 8, h: 4 });
  });

  it("snaps to a 10 cm grid", () => {
    const dragged = rectFromDrag({ x: 0.04, y: 0.02 }, { x: 4.07, y: 2.03 });
    // Not a modulo check: floats. Each corner lands on the grid.
    for (const value of [dragged.x - dragged.w / 2, dragged.x + dragged.w / 2]) {
      expect(value / 0.1).toBeCloseTo(Math.round(value / 0.1), 6);
    }
  });

  it("refuses to make a sliver", () => {
    const dragged = rectFromDrag({ x: 0, y: 0 }, { x: 0.1, y: 0.02 });
    expect(dragged.w).toBe(MIN_ZONE);
    expect(dragged.h).toBe(MIN_ZONE);
  });

  it("centres on the midpoint of the drag", () => {
    const dragged = rectFromDrag({ x: 0, y: 0 }, { x: 10, y: 6 });
    expect(dragged.x).toBe(5);
    expect(dragged.y).toBe(3);
  });
});

describe("measurements", () => {
  it("reads distance and bearing off two points", () => {
    expect(measures({ x: 0, y: 0 }, { x: 0, y: -4 })).toEqual({ distance: 4, bearing: 0 });
    const east = measures({ x: 0, y: 0 }, { x: 3, y: 0 });
    expect(east.distance).toBeCloseTo(3, 6);
    expect(east.bearing).toBeCloseTo(90, 6);
  });

  it("rounds to a tenth, which is finer than a person can stand", () => {
    const m = edgeMeasures(node({ id: "a", x: 0, y: 0 }), node({ id: "b", x: 1.234, y: 0.678 }));
    expect(m.distance).toBe(1.4);
    expect(Number.isInteger(m.distance * 10)).toBe(true);
    expect(m.bearing).toBeGreaterThanOrEqual(0);
    expect(m.bearing).toBeLessThan(360);
  });
});

describe("naming", () => {
  it("numbers from what already exists", () => {
    const nodes = [
      node({ id: "a", kind: "zone", name: "Zone 1" }),
      node({ id: "b", kind: "zone", name: "Zone 2" }),
      node({ id: "c", kind: "zone", name: "Zone 9" }),
    ];
    expect(nextName("zone", nodes)).toBe("Zone 10");
  });

  it("ignores names that are not from the series", () => {
    expect(nextName("zone", [node({ id: "a", kind: "zone", name: "Pantry" })])).toBe(
      "Zone 1",
    );
    expect(nextName("place", [node({ id: "a", name: "Zone 7" })])).toBe("Place 1");
  });

  it("takes a stem, for a surveyor's shorthand", () => {
    expect(nextName("zone", [], "Aisle")).toBe("Aisle 1");
  });
});

describe("validation", () => {
  it("wants a name", () => {
    expect(problems({ name: "  ", kind: "place" })).toEqual([
      { field: "name", message: "Give it a name" },
    ]);
  });

  it("wants a zone big enough to stand in", () => {
    expect(problems({ name: "Freezer", kind: "zone", w: 0.1, h: 2 })).toEqual([
      { field: "size", message: "Too small to be real" },
    ]);
  });

  it("lets points be small", () => {
    expect(problems({ name: "Corner", kind: "point" })).toEqual([]);
  });
});

describe("connecting", () => {
  const zone = node({ id: "z", kind: "zone", x: 0, y: 0, w: 4, h: 4 });
  const place = node({ id: "p", kind: "place", x: 5, y: 0 });
  const corner = node({ id: "c", x: 9, y: 0 });

  it("connects places and points, but not rooms to rooms", () => {
    expect(canConnect(place, corner)).toBe(true);
    expect(canConnect(corner, place)).toBe(true);
    expect(canConnect(zone, place)).toBe(true);
    expect(canConnect(zone, node({ id: "z2", kind: "zone", x: 20, y: 0 }))).toBe(false);
  });

  it("never connects a node to itself", () => {
    expect(canConnect(place, place)).toBe(false);
    expect(canConnect(undefined, place)).toBe(false);
  });
});
