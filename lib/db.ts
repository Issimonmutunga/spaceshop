"use client";

import Dexie, { type EntityTable } from "dexie";
import { newId, newLabelCode } from "./id";
import type {
  Edge,
  Event,
  ID,
  Item,
  Node,
  Photo,
  Settings,
  Space,
} from "./types";

/** IndexedDB is the source of truth. Everything works offline. */
export const db = new Dexie("locus") as Dexie & {
  spaces: EntityTable<Space, "id">;
  nodes: EntityTable<Node, "id">;
  edges: EntityTable<Edge, "id">;
  items: EntityTable<Item, "id">;
  events: EntityTable<Event, "id">;
  photos: EntityTable<Photo, "id">;
  settings: EntityTable<Settings, "id">;
};

db.version(1).stores({
  spaces: "id, name",
  nodes: "id, spaceId, [spaceId+kind], parentId, qr, name",
  edges: "id, spaceId, [spaceId+from], [from+to]",
  items: "id, spaceId, placeId, [spaceId+placeId], name, updatedAt, deleted",
  events: "id, spaceId, itemId, at",
  photos: "id, spaceId",
  settings: "id",
});

/* ---------------------------------------------------------------- queries */

export const liveNodes = (spaceId: ID) =>
  db.nodes.where("spaceId").equals(spaceId).filter((n) => !n.deleted).toArray();

export const liveEdges = (spaceId: ID) =>
  db.edges.where("spaceId").equals(spaceId).filter((e) => !e.deleted).toArray();

export const liveItems = (spaceId: ID) =>
  db.items.where("spaceId").equals(spaceId).filter((i) => !i.deleted).toArray();

export const liveItemsAt = (placeId: ID) =>
  db.items.where("placeId").equals(placeId).filter((i) => !i.deleted).toArray();

export const livePhotos = (spaceId: ID) =>
  db.photos.where("spaceId").equals(spaceId).toArray();

export async function getSettings(): Promise<Settings> {
  const found = await db.settings.get("default");
  return found ?? { id: "default", role: "manager", units: "m", theme: "auto" };
}

export async function putSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: "default" });
}

export const isEmpty = async () => (await db.spaces.count()) === 0;

export async function latestSpace(): Promise<Space | undefined> {
  return db.spaces.orderBy("id").last();
}

/* -------------------------------------------------------------- mutations */

function log(
  itemId: ID,
  spaceId: ID,
  type: Event["type"],
  extra: { from?: ID; to?: ID } = {},
) {
  return {
    id: newId("ev"),
    spaceId,
    itemId,
    type,
    at: Date.now(),
    ...extra,
  };
}

export async function createSpace(name: string) {
  const now = Date.now();
  const space: Space = { id: newId("sp"), name, createdAt: now, updatedAt: now };
  await db.spaces.add(space);
  return space;
}

export async function createNode(
  spaceId: ID,
  draft: Partial<Node> & { kind: Node["kind"]; name: string; x: number; y: number },
) {
  const now = Date.now();
  const node: Node = {
    id: newId("nd"),
    spaceId,
    parentId: null,
    qr: newLabelCode(),
    rotation: 0,
    ...draft,
    createdAt: now,
    updatedAt: now,
  };
  await db.nodes.add(node);
  return node;
}

export async function updateNode(id: ID, patch: Partial<Node>) {
  await db.nodes.update(id, { ...patch, updatedAt: Date.now() });
}

export async function softDeleteNode(id: ID) {
  await db.nodes.update(id, { deleted: 1, updatedAt: Date.now() });
  await db.edges
    .filter((e) => !e.deleted && (e.from === id || e.to === id))
    .modify({ deleted: 1, updatedAt: Date.now() });
}

export async function connect(spaceId: ID, from: ID, to: ID, distance?: number) {
  if (from === to) return null;
  const existing = await db.edges
    .filter(
      (e) =>
        !e.deleted &&
        ((e.from === from && e.to === to) || (e.from === to && e.to === from)),
    )
    .first();
  if (existing) return existing;
  const a = await db.nodes.get(from);
  const b = await db.nodes.get(to);
  if (!a || !b) return null;
  const now = Date.now();
  const edge: Edge = {
    id: newId("eg"),
    spaceId,
    from,
    to,
    distance: distance ?? straightDistance(a, b),
    createdAt: now,
    updatedAt: now,
  };
  await db.edges.add(edge);
  return edge;
}

export const straightDistance = (a: Node, b: Node) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export async function addItem(
  spaceId: ID,
  data: { placeId: ID; name: string; slot?: string; tags?: string[]; qty?: number; photoId?: ID },
) {
  const now = Date.now();
  const item: Item = {
    id: newId("it"),
    spaceId,
    placeId: data.placeId,
    name: data.name.trim() || "Unnamed",
    slot: data.slot,
    tags: data.tags ?? [],
    qty: data.qty,
    photoId: data.photoId,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", db.items, db.events, async () => {
    await db.items.add(item);
    await db.events.add(log(item.id, spaceId, "add", { to: item.placeId }));
  });
  return item;
}

export async function editItem(id: ID, patch: Partial<Item>) {
  const before = await db.items.get(id);
  if (!before) return;
  await db.items.update(id, { ...patch, updatedAt: Date.now() });
  if (patch.placeId && patch.placeId !== before.placeId) {
    await db.events.add(log(id, before.spaceId, "move", { from: before.placeId, to: patch.placeId }));
  } else if (patch.name || patch.slot || patch.tags || patch.qty) {
    await db.events.add(log(id, before.spaceId, "edit"));
  }
}

/** Move. The row is updated in place so the item keeps its identity; the
 *  event log records from/to for history. */
export async function moveItem(id: ID, toPlaceId: ID) {
  const before = await db.items.get(id);
  if (!before || before.placeId === toPlaceId) return before;
  await db.transaction("rw", db.items, db.events, async () => {
    await db.items.update(id, { placeId: toPlaceId, updatedAt: Date.now() });
    await db.events.add(
      log(id, before.spaceId, "move", { from: before.placeId, to: toPlaceId }),
    );
  });
  return db.items.get(id);
}

/** Remove. Quantity items decrement first; then soft delete. */
export async function removeItem(id: ID) {
  const item = await db.items.get(id);
  if (!item) return null;
  const now = Date.now();
  await db.transaction("rw", db.items, db.events, async () => {
    if (item.qty && item.qty > 1) {
      await db.items.update(id, { qty: item.qty - 1, updatedAt: now });
      await db.events.add(log(id, item.spaceId, "edit"));
    } else {
      await db.items.update(id, { deleted: 1, updatedAt: now });
      await db.events.add(log(id, item.spaceId, "remove", { from: item.placeId }));
    }
  });
  return item;
}

/** Undo for the 5-second window after an add or remove. */
export async function restoreItem(id: ID) {
  const item = await db.items.get(id);
  if (!item) return;
  await db.items.update(id, { deleted: undefined, updatedAt: Date.now() });
}

export async function hardDeleteItem(id: ID) {
  await db.items.delete(id);
}

export async function undoAdd(id: ID) {
  const item = await db.items.get(id);
  if (!item) return;
  await db.items.delete(id);
  await db.events.where("itemId").equals(id).delete();
}

export async function addPhoto(spaceId: ID, full: Blob, thumb: Blob, width: number, height: number) {
  const photo: Photo = { id: newId("ph"), spaceId, full, thumb, width, height, createdAt: Date.now() };
  await db.photos.add(photo);
  return photo;
}

export async function getPhoto(id?: ID) {
  if (!id) return undefined;
  return db.photos.get(id);
}

export async function recentEvents(spaceId: ID, limit = 30) {
  const rows = await db.events.where("spaceId").equals(spaceId).reverse().sortBy("at");
  return rows.slice(0, limit);
}

export async function resetAll() {
  await db.transaction(
    "rw",
    [db.spaces, db.nodes, db.edges, db.items, db.events, db.photos, db.settings],
    async () => {
      await Promise.all([
        db.spaces.clear(),
        db.nodes.clear(),
        db.edges.clear(),
        db.items.clear(),
        db.events.clear(),
        db.photos.clear(),
        db.settings.clear(),
      ]);
    },
  );
}
