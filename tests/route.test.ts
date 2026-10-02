import { describe, expect, it } from "vitest";
import supermarketSeed from "@/seed/supermarket.json";
import {
  CHUNK,
  chunkSteps,
  entranceOf,
  graph,
  orderStops,
  planRoute,
  routeMeters,
  shortestPath,
  stepNote,
  turnsAlong,
  type Step,
} from "@/lib/route";
import { db } from "@/lib/db";
import { byId } from "@/lib/labels";
import { importSeedFile } from "@/lib/seed";
import type { Item, Node, SeedFile } from "@/lib/types";

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

const item = (over: Partial<Item> & { id?: string } = {}): Item => ({
  id: "itm",
  spaceId: "s",
  placeId: "target",
  name: "Thing",
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

// A junction with three arms: entrance, a left turn, and the target.
const T = {
  junction: node({ id: "junction", name: "Front junction", x: 0, y: 0, landmark: true }),
  north: node({ id: "north", name: "North point", x: 0, y: -10 }),
  west: node({ id: "west", name: "West point", x: -10, y: 0 }),
  target: node({ id: "target", kind: "place", name: "Blue toolbox", x: -20, y: 0 }),
  entrance: node({ id: "entrance", name: "Entrance doors", x: 0, y: 10 }),
};
const T_NODES = Object.values(T);
const T_EDGES = [
  { from: "entrance", to: "junction", distance: 10 },
  { from: "junction", to: "north", distance: 10 },
  { from: "junction", to: "west", distance: 10 },
  { from: "west", to: "target", distance: 10 },
];

describe("the walking graph", () => {
  it("walks both ways along an edge", () => {
    const { adjacency } = graph(T_NODES, T_EDGES);
    expect(adjacency.get("junction")?.map((leg) => leg.to).sort()).toEqual([
      "entrance",
      "north",
      "west",
    ]);
    expect(adjacency.get("entrance")?.map((leg) => leg.to)).toEqual(["junction"]);
  });

  it("ignores deleted rows and nodes that are gone", () => {
    const { adjacency } = graph(T_NODES, [
      ...T_EDGES,
      { from: "junction", to: "north", distance: 10, deleted: 1 },
      { from: "junction", to: "ghost", distance: 1 },
    ]);
    expect(adjacency.get("junction")?.some((leg) => leg.to === "ghost")).toBe(false);
    expect(adjacency.get("junction")?.filter((leg) => leg.to === "north")).toHaveLength(1);
  });

  it("takes the shortest walk, not the fewest links", () => {
    // A long direct link from the entrance, versus two short hops.
    const nodes = [...T_NODES];
    const path = shortestPath(
      nodes,
      [...T_EDGES, { from: "entrance", to: "target", distance: 90 }],
      "entrance",
      "target",
    );
    expect(path).toEqual(["entrance", "junction", "west", "target"]);
  });

  it("says so when there is no way there", () => {
    // An island junction nobody linked to: no path, so no route.
    const island = node({ id: "island", name: "Isolated marker", x: 99, y: 99 });
    expect(shortestPath([...T_NODES, island], T_EDGES, "entrance", "island")).toEqual([]);
    // And a space with no walking graph at all guides nowhere.
    expect(planRoute(T_NODES, [], item({ placeId: "target" }))).toEqual([]);
  });

  it("walks to the junction that costs least, then strides in at the end", () => {
    // The shelf is not in the graph, so the route ends at a junction: the one
    // cheapest to walk to, with the shelf itself as the final stride.
    const shelf = node({ id: "shelf", kind: "place", name: "Shelf 2 left", x: -11, y: 0 });
    const steps = planRoute([...T_NODES, shelf], T_EDGES, item({ placeId: "shelf" }));
    expect(steps[0].text).toBe("Start at Entrance doors");
    expect(steps.at(-1)).toMatchObject({ text: "Shelf 2 left", placeId: "shelf" });
    expect(steps.map((step) => step.nodeId)).toEqual(["entrance", "junction", "shelf"]);
  });

  it("comes in from the nearer side when two junctions cost the same walk", () => {
    // Both junctions are about the same walk from the door, so the one nearer
    // the shelf is the one to arrive from.
    const near = node({ id: "near-side", name: "Aisle mouth", x: -11, y: 10 });
    const far = node({ id: "far-side", name: "Cross aisle", x: 0, y: 0 });
    const shelf = node({ id: "shelf", kind: "place", name: "Shelf 2 left", x: -11, y: 0 });
    const steps = planRoute([...T_NODES, near, far, shelf], [
      { from: "entrance", to: "far-side", distance: 10 },
      { from: "entrance", to: "near-side", distance: 11 },
      { from: "near-side", to: "shelf", distance: 10 },
    ], item({ placeId: "shelf" }));
    expect(steps.map((step) => step.nodeId)).toEqual(["entrance", "near-side", "shelf"]);
  });

  it("starts at the door when it has been labelled", () => {
    expect(entranceOf(T_NODES)?.name).toBe("Entrance doors");
    const anonymous = T_NODES.filter((n) => n.kind === "point" && n.id !== "entrance");
    expect(entranceOf(anonymous)?.id).toBe(anonymous[0].id);
  });
});

describe("turns", () => {
  const index = byId(T_NODES);

  it("calls the direction change at the junction a turn", () => {
    // Walking north, then west, is a left turn.
    expect(turnsAlong(["entrance", "junction", "west"], index)[1]).toBe("left");
    expect(turnsAlong(["entrance", "junction", "north"], index)[1]).toBe("straight");
  });

  it("calls it a right turn the other way round", () => {
    const east = node({ id: "east", name: "East point", x: 10, y: 0 });
    const nodes = [...T_NODES, east];
    expect(turnsAlong(["entrance", "junction", "east"], byId(nodes))[1]).toBe("right");
  });

  it("has no turn at the ends of a walk", () => {
    const turns = turnsAlong(["entrance", "junction", "west", "target"], index);
    expect(turns[0]).toBeUndefined();
    expect(turns.at(-1)).toBeUndefined();
  });
});

describe("phrasing", () => {
  const steps = planRoute(T_NODES, T_EDGES, item({ placeId: "target", slot: "Drawer 2" }));

  it("opens at the door and closes at the place", () => {
    expect(steps[0].text).toBe("Start at Entrance doors");
    expect(steps.at(-1)).toMatchObject({
      text: "Blue toolbox",
      placeId: "target",
      slot: "Drawer 2",
      itemName: "Thing",
    });
  });

  it("names the landmark a turn happens at", () => {
    expect(steps[1]).toMatchObject({ text: "Front junction. Turn left.", turn: "left" });
    expect(steps[1].landmark?.name).toBe("Front junction");
  });

  it("never mentions a bearing or a distance in the instruction", () => {
    for (const step of steps) {
      expect(step.text).not.toMatch(/\d/);
      expect(step.text.toLowerCase()).not.toMatch(/north|south|east|west|metre|meter| m\b/);
    }
  });

  it("keeps instructions to a handful of words", () => {
    for (const step of steps) {
      expect(step.text.split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });

  it("puts the distance in a quiet line, as steps", () => {
    expect(routeMeters(steps)).toBeCloseTo(30, 5);
    expect(stepNote(steps.at(-1)!)).toMatch(/steps/);
    // The first step is where you already are, so it claims no distance.
    expect(stepNote(steps[0])).toBe("");
  });

  it("drops a step that only says go straight", () => {
    // Straight on past the junction there is nothing to remember, so nothing is said.
    const straight = planRoute(T_NODES, T_EDGES, item({ placeId: "north" }));
    expect(straight.map((step) => step.text)).toEqual([
      "Start at Entrance doors",
      "North point",
    ]);
  });
});

describe("chunking", () => {
  const many = (count: number): Step[] =>
    Array.from({ length: count }, (_, at) => ({
      id: `s${at}`,
      nodeId: `n${at}`,
      text: `Step ${at}`,
      meters: at,
      zoneId: at < 6 ? "aisle-1" : at < 12 ? "aisle-2" : "checkout",
    }));

  it("never shows more than four steps at once", () => {
    for (const count of [1, 3, 4, 5, 9, 12, 30]) {
      for (const chunk of chunkSteps(many(count))) {
        expect(chunk.length).toBeLessThanOrEqual(CHUNK);
      }
    }
  });

  it("keeps every step, in order", () => {
    const flat = chunkSteps(many(13)).flat();
    expect(flat.map((step) => step.id)).toEqual(many(13).map((step) => step.id));
  });

  it("breaks where the walk changes area", () => {
    const chunks = chunkSteps(many(13));
    // The first chunk cannot straddle two aisles, so it is short enough to be safe.
    expect(chunks[0].every((step) => step.zoneId === "aisle-1")).toBe(true);
    expect(chunks[0].length).toBeLessThanOrEqual(CHUNK);
    expect(chunks.flatMap((chunk) => chunk).length).toBe(13);
  });

  it("gives the last step a screen of its own", () => {
    const chunks = chunkSteps(many(2));
    expect(chunks).toHaveLength(2);
    expect(chunks.at(-1)).toEqual([many(2).at(-1)]);
    // Even a long route keeps the payoff out of the crowd.
    for (const chunk of chunkSteps(many(30)).slice(-1)) expect(chunk).toHaveLength(1);
  });
});

describe("pick lists", () => {
  it("walks to the nearest stop first", () => {
    const order = orderStops(T_NODES, T_EDGES, "entrance", ["target", "north", "west"]);
    expect(order[0]).toBe("north");
    expect(order).toHaveLength(3);
    expect([...order].sort()).toEqual(["north", "target", "west"]);
  });

  it("leaves a single stop alone", () => {
    expect(orderStops(T_NODES, T_EDGES, "entrance", ["target"])).toEqual(["target"]);
  });

  it("never walks further than the order it was given", () => {
    const nodes = [
      ...T_NODES,
      node({ id: "far-1", kind: "place", name: "Far 1", x: -40, y: 0 }),
      node({ id: "far-2", kind: "place", name: "Far 2", x: -40, y: 5 }),
      node({ id: "mid-1", kind: "place", name: "Mid 1", x: -30, y: 0 }),
    ];
    const edges = [
      ...T_EDGES,
      { from: "target", to: "mid-1", distance: 10 },
      { from: "mid-1", to: "far-1", distance: 10 },
      { from: "far-1", to: "far-2", distance: 5 },
    ];
    const index = byId(nodes);
    const walk = (list: string[]) =>
      list.slice(1).reduce((sum, id, at) => {
        const path = shortestPath(nodes, edges, list[at], id);
        return sum + path.slice(1).reduce(
          (inner, step, leg) =>
            inner +
            Math.hypot(
              (index.get(step)?.x ?? 0) - (index.get(path[leg])?.x ?? 0),
              (index.get(step)?.y ?? 0) - (index.get(path[leg])?.y ?? 0),
            ),
          0,
        );
      }, 0);
    const ordered = orderStops(nodes, edges, "entrance", ["far-2", "mid-1", "target", "far-1"]);
    const naive = ["far-2", "mid-1", "target", "far-1"];
    expect(walk(ordered)).toBeLessThanOrEqual(walk(naive) + 1e-9);
    // And it beats the worst ordering, not just ties it.
    expect(walk(ordered)).toBeLessThan(walk(["far-2", "target", "far-1", "mid-1"]));
  });
});

describe("the demo space", () => {
  const freshDb = async () => {
    await db.delete();
    await db.open();
  };

  const load = async () => {
    await freshDb();
    await importSeedFile(supermarketSeed as SeedFile);
    const [nodes, items, edges] = await Promise.all([
      db.nodes.toArray(),
      db.items.toArray(),
      db.edges.toArray(),
    ]);
    return { nodes, items, edges, index: byId(nodes) };
  };

  it("guides to any seeded item", async () => {
    const { nodes, items, edges } = await load();
    for (const item of items.slice(0, 20)) {
      const steps = planRoute(nodes, edges, item);
      expect(steps.length).toBeGreaterThan(1);
      expect(steps[0].text).toMatch(/^Start at /);
      expect(steps.at(-1)?.placeId).toBe(item.placeId);
      expect(steps.at(-1)?.text).toBe(nodes.find((n) => n.id === item.placeId)?.name);
    }
  });

  it("never shows more than four steps at once across the whole seed", async () => {
    const { nodes, items, edges } = await load();
    for (const item of items) {
      const chunks = chunkSteps(planRoute(nodes, edges, item));
      for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK);
    }
  });

  it("plans a route fast enough to feel instant", async () => {
    const { nodes, items, edges } = await load();
    const started = performance.now();
    for (const item of items) planRoute(nodes, edges, item);
    const perRoute = (performance.now() - started) / items.length;
    expect(perRoute).toBeLessThan(100);
  });

  it("orders a pick list of eight items quickly", async () => {
    const { nodes, items, edges, index } = await load();
    const places = [...new Set(items.slice(0, 40).map((one) => one.placeId))].slice(0, 8);
    const start = entranceOf(nodes)!.id;
    expect(index.has(start)).toBe(true);
    const started = performance.now();
    const order = orderStops(nodes, edges, start, places);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(order).toHaveLength(places.length);
    expect(new Set(order)).toEqual(new Set(places));
  });
});
