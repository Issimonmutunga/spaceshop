"use client";

import supermarketSeed from "@/seed/supermarket.json";
import homeSeed from "@/seed/home.json";
import { db, createSpace, straightDistance } from "./db";
import { newId, newLabelCode } from "./id";
import type { Edge, ID, Item, Node, SeedFile } from "./types";

/** Imported, not fetched: the demo must work offline and with no round trip. */
export const SEEDS: Record<string, SeedFile> = {
  supermarket: supermarketSeed as SeedFile,
  home: homeSeed as SeedFile,
};

export type SeedName = keyof typeof SEEDS;

/**
 * Loads a demo space. Keys in the seed file are resolved to real ids and label
 * codes are minted here, so the same seed can be loaded twice.
 */
export async function loadSeed(name: SeedName) {
  return importSeedFile(SEEDS[name]);
}

/** The seed file itself, so tests and import can both use it without fetch. */
export async function importSeedFile(seed: SeedFile) {
  const now = Date.now();
  const space = { id: newId("sp"), name: seed.space.name, createdAt: now, updatedAt: now };

  const byKey = new Map<string, ID>();
  const nodes: Node[] = seed.nodes.map((n) => {
    const id = newId("nd");
    byKey.set(n.key, id);
    return {
      id,
      spaceId: space.id,
      kind: n.kind,
      parentId: null,
      name: n.name,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      rotation: n.rotation ?? 0,
      landmark: n.landmark,
      qr: newLabelCode(),
      createdAt: now,
      updatedAt: now,
    };
  });
  // Second pass: seed keys become ids.
  seed.nodes.forEach((n, i) => {
    const parentId = n.parentId ? byKey.get(n.parentId) : undefined;
    if (parentId) nodes[i].parentId = parentId;
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const e of seed.edges) {
    const from = byKey.get(e.from);
    const to = byKey.get(e.to);
    if (!from || !to) continue;
    const key = [from, to].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const a = byId.get(from)!;
    const b = byId.get(to)!;
    edges.push({
      id: newId("eg"),
      spaceId: space.id,
      from,
      to,
      distance: straightDistance(a, b),
      createdAt: now,
      updatedAt: now,
    });
  }

  const items: Item[] = seed.items
    .map((i, index) => ({
      id: newId("it"),
      spaceId: space.id,
      placeId: byKey.get(i.place) ?? "",
      name: i.name,
      tags: i.tags ?? [],
      slot: i.slot,
      qty: i.qty,
      // Spread creation times so recency ranking has something to work with.
      createdAt: now - (seed.items.length - index) * 60_000,
      updatedAt: now - (seed.items.length - index) * 60_000,
    }))
    .filter((i) => i.placeId);

  await db.transaction("rw", [db.spaces, db.nodes, db.edges, db.items, db.events], async () => {
    await db.spaces.put(space);
    await db.nodes.bulkPut(nodes);
    await db.edges.bulkPut(edges);
    await db.items.bulkPut(items);
    await db.events.bulkAdd(
      items.map((item) => ({
        id: newId("ev"),
        spaceId: space.id,
        itemId: item.id,
        type: "add" as const,
        to: item.placeId,
        at: item.createdAt,
      })),
    );
  });

  // Ask the browser not to evict the space. Silently ignored where unsupported.
  if (typeof navigator !== "undefined") navigator.storage?.persist?.().catch(() => {});

  return { space, nodeCount: nodes.length, itemCount: items.length };
}

/** "Start blank" is not a dead end: a space with an entrance and no map yet. */
export async function loadBlank() {
  const space = await createSpace("New space");
  return { space, nodeCount: 0, itemCount: 0 };
}
