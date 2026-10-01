import { beforeEach, describe, expect, it } from "vitest";
import supermarketSeed from "@/seed/supermarket.json";
import homeSeed from "@/seed/home.json";
import {
  db,
  addItem,
  removeItem,
  restoreItem,
  undoAdd,
  moveItem,
  connect,
  disconnect,
  remeasureEdges,
  softDeleteNode,
  updateEdge,
  updateNode,
} from "@/lib/db";
import { importSeedFile } from "@/lib/seed";
import type { SeedFile } from "@/lib/types";

async function freshDb() {
  await db.delete();
  await db.open();
}

describe("seed loading", () => {
  beforeEach(freshDb);

  it("loads the demo supermarket with 60+ items", async () => {
    const { itemCount, nodeCount } = await importSeedFile(supermarketSeed as SeedFile);
    expect(itemCount).toBeGreaterThanOrEqual(60);
    expect(nodeCount).toBeGreaterThan(20);

    const items = await db.items.toArray();
    const nodes = await db.nodes.toArray();
    const edges = await db.edges.toArray();
    expect(items.length).toBe(itemCount);
    expect(nodes.length).toBe(nodeCount);
    expect(edges.length).toBeGreaterThan(10);

    // Every item points at a real place node, and every node has a label code.
    const nodeIds = new Set(nodes.map((n) => n.id));
    const placeIds = new Set(nodes.filter((n) => n.kind === "place").map((n) => n.id));
    for (const item of items) {
      expect(nodeIds.has(item.placeId)).toBe(true);
      expect(placeIds.has(item.placeId)).toBe(true);
    }
    for (const node of nodes) expect(node.qr).toMatch(/^[234679ACDEFGHJKLMNPQRTUVWXYZ]{6}$/);
    for (const edge of edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
      expect(edge.distance).toBeGreaterThan(0);
    }
  });

  it("keeps the home seed walkable and small", async () => {
    const { itemCount } = await importSeedFile(homeSeed as SeedFile);
    expect(itemCount).toBeGreaterThan(30);
    expect(await db.nodes.count()).toBeGreaterThan(15);
    expect(await db.edges.count()).toBeGreaterThanOrEqual(6);
  });

  it("mints unique label codes", async () => {
    await importSeedFile(supermarketSeed as SeedFile);
    const codes = (await db.nodes.toArray()).map((n) => n.qr);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("mutations", () => {
  beforeEach(async () => {
    await freshDb();
    await importSeedFile(homeSeed as SeedFile);
  });

  const spaceId = async () => (await db.spaces.toArray())[0].id;

  it("writes an event for every add", async () => {
    const sid = await spaceId();
    const place = (await db.nodes.filter((n) => n.kind === "place").toArray())[0];
    const item = await addItem(sid, { placeId: place.id, name: "Test spanner", tags: ["tool"] });
    const events = await db.events.where("itemId").equals(item.id).toArray();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("add");
    expect(events[0].to).toBe(place.id);
  });

  it("decrements quantity before soft deleting", async () => {
    const sid = await spaceId();
    const place = (await db.nodes.filter((n) => n.kind === "place").toArray())[0];
    const item = await addItem(sid, { placeId: place.id, name: "Batteries", qty: 3 });

    await removeItem(item.id);
    expect((await db.items.get(item.id))!.qty).toBe(2);
    expect((await db.items.get(item.id))!.deleted).toBeUndefined();

    await removeItem(item.id);
    await removeItem(item.id);
    const gone = await db.items.get(item.id);
    expect(gone!.deleted).toBe(1);
    expect(await db.items.filter((i) => !i.deleted).count()).toBe(61);

    // Soft delete keeps the row so undo and history work.
    await restoreItem(item.id);
    expect((await db.items.get(item.id))!.deleted).toBeUndefined();
  });

  it("moves an item and logs from/to", async () => {
    const sid = await spaceId();
    const places = await db.nodes.filter((n) => n.kind === "place").toArray();
    const item = await addItem(sid, { placeId: places[0].id, name: "Hex key set" });
    const moved = await moveItem(item.id, places[1].id);
    expect(moved!.placeId).toBe(places[1].id);
    // The row keeps its identity, so the photo and any links survive a move.
    expect(moved!.id).toBe(item.id);

    const events = await db.events.where("itemId").equals(item.id).toArray();
    const move = events.filter((e) => e.type === "move");
    expect(move).toHaveLength(1);
    expect(move[0].from).toBe(places[0].id);
    expect(move[0].to).toBe(places[1].id);
    expect(events).toHaveLength(2); // add + move
  });

  it("undoes an add", async () => {
    const sid = await spaceId();
    const place = (await db.nodes.filter((n) => n.kind === "place").toArray())[0];
    const item = await addItem(sid, { placeId: place.id, name: "Temporary" });
    await undoAdd(item.id);
    expect(await db.items.get(item.id)).toBeUndefined();
    expect(await db.events.where("itemId").equals(item.id).count()).toBe(0);
  });

  it("never creates a duplicate edge", async () => {
    const sid = await spaceId();
    const points = await db.nodes.filter((n) => n.kind === "point").toArray();
    const pairs = new Set(
      (await db.edges.toArray()).map((e) => [e.from, e.to].sort().join("|")),
    );
    const isJoined = (a: string, b: string) => pairs.has([a, b].sort().join("|"));

    const a = points[0];
    const joined = points.find((p) => p.id !== a.id && isJoined(a.id, p.id))!;
    const unjoined = points.find((p) => p.id !== a.id && !isJoined(a.id, p.id))!;
    expect(joined).toBeDefined();
    expect(unjoined).toBeDefined();

    // An existing pair is returned as-is, not duplicated.
    const before = await db.edges.count();
    const again = await connect(sid, joined.id, a.id);
    expect(again).not.toBeNull();
    expect(await db.edges.count()).toBe(before);

    // A new pair is linked once.
    const created = await connect(sid, a.id, unjoined.id);
    expect(created).not.toBeNull();
    expect(await db.edges.count()).toBe(before + 1);

    // The same pair, reversed, must not add a second edge.
    await connect(sid, unjoined.id, a.id);
    expect(await db.edges.count()).toBe(before + 1);
  });

  it("soft deleting a node drops its edges", async () => {
    const node = (await db.nodes.filter((n) => n.kind === "point").toArray())[0];
    const edges = await db.edges
      .filter((e) => e.from === node.id || e.to === node.id)
      .count();
    expect(edges).toBeGreaterThan(0);
    await softDeleteNode(node.id);
    expect(
      await db.edges.filter((e) => (e.from === node.id || e.to === node.id) && !e.deleted).count(),
    ).toBe(0);
    // The rows survive, so undo is possible.
    expect(
      await db.edges.filter((e) => e.from === node.id || e.to === node.id).count(),
    ).toBe(edges);
  });

  it("stores a link's measured bearing on creation", async () => {
    const sid = await spaceId();
    const [a, b] = await db.nodes.filter((n) => n.kind === "point").limit(2).toArray();
    const edge = await connect(sid, a.id, b.id);
    expect(edge?.bearing).toBeGreaterThanOrEqual(0);
    expect(edge?.bearing).toBeLessThan(360);
    expect(edge?.distance).toBeGreaterThan(0);
  });

  it("keeps a hand-set distance instead of re-deriving it", async () => {
    const sid = await spaceId();
    const [a, b] = await db.nodes.filter((n) => n.kind === "point").limit(2).toArray();
    const edge = (await connect(sid, a.id, b.id))!;
    await updateEdge(edge.id, { distance: 7.5, bearing: 42 });
    const stored = (await db.edges.get(edge.id))!;
    expect(stored.distance).toBe(7.5);
    expect(stored.bearing).toBe(42);
  });

  it("re-measures the links a moved node touches", async () => {
    const sid = await spaceId();
    const [a, b] = await db.nodes.filter((n) => n.kind === "point").limit(2).toArray();
    const edge = (await connect(sid, a.id, b.id))!;
    // Put b due north of a, five metres away. Canvas y runs down, so north is -y.
    await updateNode(b.id, { x: a.x, y: a.y - 5 });
    const touched = await remeasureEdges(sid, [b.id]);
    expect(touched).toBeGreaterThanOrEqual(1);

    const stored = (await db.edges.get(edge.id))!;
    expect(stored.distance).toBeCloseTo(5, 5);
    expect(stored.bearing).toBeCloseTo(0, 5);
  });

  it("unlinks softly", async () => {
    const sid = await spaceId();
    const [a, b] = await db.nodes.filter((n) => n.kind === "point").limit(2).toArray();
    const edge = (await connect(sid, a.id, b.id))!;
    await disconnect(edge.id);
    expect((await db.edges.get(edge.id))!.deleted).toBe(1);
    // Still there for undo, and re-connecting makes a live link again.
    expect(await db.edges.get(edge.id)).toBeDefined();
  });
});
