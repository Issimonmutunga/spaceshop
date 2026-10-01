import type { ID, Item, Node } from "./types";

export const byId = (nodes: Node[]) => new Map(nodes.map((n) => [n.id, n]));

/** Walk up the tree to the zone a node belongs to. */
export function zoneOf(node: Node | undefined, index: Map<ID, Node>): Node | undefined {
  let current = node;
  const guard = new Set<ID>();
  while (current && current.kind !== "zone") {
    if (guard.has(current.id)) return undefined;
    guard.add(current.id);
    current = current.parentId ? index.get(current.parentId) : undefined;
  }
  return current;
}

export interface Where {
  zone: string;
  place: string;
  slot?: string;
  placeId: ID;
}

/** The answer, as three stacked lines: zone / place / slot. */
export function whereIs(
  item: Item,
  nodes: Node[],
  index?: Map<ID, Node>,
): Where | undefined {
  const map = index ?? byId(nodes);
  const place = map.get(item.placeId);
  if (!place) return undefined;
  const zone = zoneOf(place, map);
  return {
    zone: zone?.name ?? "",
    place: place.name,
    slot: item.slot,
    placeId: place.id,
  };
}

/** One quiet line: "Aisle 1 Grocery › Shelf 1 left › Level 3". */
export function whereLine(where: Where | undefined) {
  if (!where) return "Not placed";
  return [where.zone, where.place, where.slot].filter(Boolean).join(" › ");
}

/** Recent places, most recently used first. Powers the move and add chips. */
export function recentPlaces(items: Item[], nodes: Node[], _limit = 5) {
  const map = byId(nodes);
  const seen = new Map<ID, { node: Node; at: number }>();
  for (const item of items) {
    if (item.deleted) continue;
    const node = map.get(item.placeId);
    if (!node) continue;
    const at = seen.get(node.id)?.at ?? 0;
    seen.set(node.id, { node, at: Math.max(at, item.updatedAt) });
  }
  return [...seen.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, _limit)
    .map((v) => v.node);
}
