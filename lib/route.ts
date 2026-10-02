import type { ID, Item, Node } from "./types";
import { bearingBetween, stepPhrase, turnBetween } from "./geometry";
import { byId, zoneOf } from "./labels";

/**
 * Wayfinding, as pure functions over the space: find the walkable path, decide
 * where the turns are, and say it in words a person can hold in their head.
 *
 * Two rules shape everything here. Compass bearings never appear in a
 * direction: "turn left at the bakery", never "north 12 metres". And a person
 * cannot remember four things at once, so a route is chunked before it is shown.
 */

export interface Leg {
  from: ID;
  to: ID;
  distance: number;
}

/** The graph as an adjacency list, dropping deleted rows and dead ends. */
export function graph(nodes: Node[], edges: Array<{ from: ID; to: ID; distance: number; deleted?: number }>) {
  const index = byId(nodes.filter((n) => !n.deleted));
  const adjacency = new Map<ID, Leg[]>();
  const link = (from: ID, to: ID, distance: number) => {
    adjacency.set(from, [...(adjacency.get(from) ?? []), { from, to, distance }]);
  };
  for (const edge of edges) {
    if (edge.deleted) continue;
    if (!index.has(edge.from) || !index.has(edge.to)) continue;
    link(edge.from, edge.to, edge.distance);
    link(edge.to, edge.from, edge.distance);
  }
  return { index, adjacency };
}

/**
 * Dijkstra on walking distance. The graph is a few dozen nodes, so a heap is
 * ceremony: a linear scan for the next cheapest node is faster in practice and
 * obviously correct.
 */
export function shortestPath(
  nodes: Node[],
  edges: Array<{ from: ID; to: ID; distance: number; deleted?: number }>,
  from: ID,
  to: ID,
): ID[] {
  if (from === to) return [from];
  const { index, adjacency } = graph(nodes, edges);
  if (!index.has(from) || !index.has(to)) return [];

  const cost = new Map<ID, number>([[from, 0]]);
  const previous = new Map<ID, ID>();
  const settled = new Set<ID>();

  while (settled.size < index.size) {
    let best: ID | undefined;
    let bestCost = Infinity;
    for (const [node, value] of cost) {
      if (!settled.has(node) && value < bestCost) {
        best = node;
        bestCost = value;
      }
    }
    if (best === undefined) break;
    if (best === to) break;
    settled.add(best);
    for (const leg of adjacency.get(best) ?? []) {
      const next = (cost.get(best) ?? 0) + leg.distance;
      if (next < (cost.get(leg.to) ?? Infinity)) {
        cost.set(leg.to, next);
        previous.set(leg.to, best);
      }
    }
  }

  if (!cost.has(to)) return [];
  const path: ID[] = [to];
  let current = to;
  while (current !== from) {
    const step = previous.get(current);
    if (!step) return [];
    path.unshift(step);
    current = step;
  }
  return path;
}

export type Turn = "left" | "right" | "straight";

/**
 * Where the walking direction changes. Under 20 degrees is not a turn worth
 * mentioning: people walk through those without noticing, and being told to
 * turn where there is no turn makes the whole route harder to trust.
 */
export function turnsAlong(path: ID[], index: Map<ID, Node>, threshold = 20): Array<Turn | undefined> {
  return path.map((_, at) => {
    if (at === 0 || at === path.length - 1) return undefined;
    const before = index.get(path[at - 1]);
    const here = index.get(path[at]);
    const after = index.get(path[at + 1]);
    if (!before || !here || !after) return undefined;
    const turn = turnBetween(bearingBetween(before, here), bearingBetween(here, after));
    if (Math.abs(turn) < threshold) return "straight";
    return turn > 0 ? "right" : "left";
  });
}

export interface Step {
  id: string;
  /** the node you are standing at when this step ends */
  nodeId: ID;
  /** one to five words, no bearings: "Bakery. Turn left." */
  text: string;
  turn?: Turn;
  /** a landmark worth showing large, when there is one here */
  landmark?: { id: ID; name: string };
  /** the area this step happens in, so a route can be chunked by common region */
  zoneId?: ID;
  /** walking distance covered getting here, for the step's quiet line */
  meters: number;
  /** the place to stop at, on the last step only */
  placeId?: ID;
  slot?: string;
  itemName?: string;
}

/** Where you are standing when the route starts: the door, if it was labelled. */
export function entranceOf(nodes: Node[]): Node | undefined {
  const points = nodes
    .filter((n) => !n.deleted && n.kind === "point")
    .sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  return points.find((n) => /entrance|door|entry/i.test(n.name)) ?? points[0];
}

/** What to call a place in an instruction: its name, or the area it is in. */
function anchorName(node: Node | undefined, index: Map<ID, Node>): string {
  if (!node) return "the next junction";
  if (node.landmark) return node.name;
  if (node.kind === "zone") return node.name;
  const zone = zoneOf(node, index);
  return zone && zone.name !== node.name ? `${zone.name}` : node.name;
}

/**
 * Where a place is reached from. Places hang off the map rather than off the
 * walking graph, so a shelf is walked to by way of the junction nearest the
 * route, and the shelf itself is the last stride.
 *
 * The junction is the one that costs least walking. Where two are within a
 * stride of each other, the one nearer the place wins, so a shelf at the back
 * of an aisle comes in from the back of that aisle.
 */
export function anchorFor(
  nodes: Node[],
  edges: Array<{ from: ID; to: ID; distance: number; deleted?: number }>,
  place: ID,
  from: ID,
): ID | undefined {
  const index = byId(nodes.filter((n) => !n.deleted));
  const target = index.get(place);
  if (!target) return undefined;
  // A place that is itself walkable is its own anchor.
  if (shortestPath(nodes, edges, from, place).length) return place;

  let best: { id: ID; walk: number; stride: number } | undefined;
  for (const node of index.values()) {
    if (node.id === from || node.kind !== "point") continue;
    const path = shortestPath(nodes, edges, from, node.id);
    if (!path.length) continue;
    const walk = path
      .slice(1)
      .reduce((sum, id, at) => sum + distanceOf(index.get(path[at]), index.get(id)), 0);
    const stride = Math.hypot(target.x - node.x, target.y - node.y);
    if (!best || walk < best.walk - 1 || (walk < best.walk + 1 && stride < best.stride)) {
      best = { id: node.id, walk, stride };
    }
  }
  return best?.id;
}

/**
 * The route as steps. Each turn gets a step named after something recognisable
 * near it — a landmark if there is one, otherwise the place or area — so the
 * instruction is "turn left at the bakery" and not a distance.
 */
export function planRoute(
  nodes: Node[],
  edges: Array<{ from: ID; to: ID; distance: number; deleted?: number }>,
  item: Item,
  from?: ID,
): Step[] {
  const index = byId(nodes.filter((n) => !n.deleted));
  const place = index.get(item.placeId);
  const start = (from ? index.get(from) : undefined) ?? entranceOf(nodes);
  if (!place || !start) return [];

  const anchor = anchorFor(nodes, edges, place.id, start.id);
  if (!anchor) return [];
  const path = shortestPath(nodes, edges, start.id, anchor);
  if (!path.length) return [];

  // The walk really ends at the place, so its last stride counts for a turn.
  const walk = path[path.length - 1] === place.id ? path : [...path, place.id];
  const turns = turnsAlong(walk, index);
  const legs = new Map<ID, number>();
  walk.slice(1).forEach((id, at) => {
    legs.set(id, distanceOf(index.get(walk[at]), index.get(id)));
  });

  const steps: Step[] = [];
  let meters = 0;
  walk.forEach((nodeId, at) => {
    const node = index.get(nodeId);
    if (!node) return;
    meters += legs.get(nodeId) ?? 0;
    const turn = turns[at];
    const last = at === walk.length - 1;

    if (at === 0) {
      steps.push({
        id: `start:${node.id}`,
        nodeId: node.id,
        text: `Start at ${anchorName(node, index)}`,
        landmark: node.landmark ? { id: node.id, name: node.name } : undefined,
        zoneId: zoneOf(node, index)?.id,
        meters: 0,
      });
      return;
    }

    if (last) {
      // The last step is the thing being looked for, and the biggest thing on
      // screen: its photo, its name, its slot.
      const atAnchor = turns[at - 1];
      steps.push({
        id: `stop:${node.id}`,
        nodeId: node.id,
        text: node.name,
        turn: atAnchor === "straight" ? undefined : atAnchor,
        landmark: node.landmark ? { id: node.id, name: node.name } : undefined,
        zoneId: zoneOf(node, index)?.id,
        meters,
        placeId: node.id,
        slot: item.slot,
        itemName: item.name,
      });
      return;
    }

    // A turn with nothing to turn at is noise: say it only when it is a turn.
    if (!turn || turn === "straight") return;
    steps.push({
      id: `turn:${node.id}`,
      nodeId: node.id,
      text: `${anchorName(node, index)}. Turn ${turn}.`,
      turn,
      landmark: node.landmark ? { id: node.id, name: node.name } : undefined,
      zoneId: zoneOf(node, index)?.id,
      meters,
    });
  });

  return steps;
}

const distanceOf = (a: Node | undefined, b: Node | undefined) =>
  a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;

/**
 * Miller's chunking, near enough: never more than four steps at a time, and a
 * new chunk only when the walk actually changes area. Four at once is what a
 * person holds; a boundary that follows the aisles is the next best thing.
 *
 * The last step is always alone on its screen. The thing being looked for is
 * the loudest thing in the whole sequence, and it only reads that way if it is
 * not competing with a turn for the same screen.
 */
export const CHUNK = 4;

export function chunkSteps(steps: Step[], size = CHUNK): Step[][] {
  if (steps.length <= 1) return steps.length ? [steps] : [];
  const chunks: Step[][] = [];
  const heading = steps.slice(0, -1);
  const last = steps.at(-1)!;
  let current: Step[] = [];
  for (const step of heading) {
    const areaChanged = current.length > 0 && current[0].zoneId !== step.zoneId;
    if (current.length >= size || (areaChanged && current.length >= 2)) {
      chunks.push(current);
      current = [];
    }
    current.push(step);
  }
  if (current.length) chunks.push(current);
  chunks.push([last]);
  return chunks;
}

/** Total walking distance of a route, in metres. */
export const routeMeters = (steps: Step[]) => steps.at(-1)?.meters ?? 0;

/** The quiet line under a step: distance as steps, never as metres. */
export const stepNote = (step: Step) => (step.meters < 1 ? "" : stepPhrase(step.meters));

/**
 * A pick list, in the order worth walking: nearest stop first, then 2-opt until
 * no swap of two stops makes the walk shorter. Small lists only, as promised.
 */
export function orderStops(
  nodes: Node[],
  edges: Array<{ from: ID; to: ID; distance: number; deleted?: number }>,
  start: ID,
  places: ID[],
): ID[] {
  if (places.length < 2) return [...places];
  const index = byId(nodes);
  const between = (a: ID, b: ID) => {
    const path = shortestPath(nodes, edges, a, b);
    if (!path.length) return Infinity;
    return path.slice(1).reduce((sum, id, at) => sum + distanceOf(index.get(path[at]), index.get(id)), 0);
  };

  // Nearest neighbour from the start.
  const remaining = [...places];
  const order: ID[] = [];
  let here = start;
  while (remaining.length) {
    let bestAt = 0;
    let bestCost = Infinity;
    remaining.forEach((id, at) => {
      const cost = between(here, id);
      if (cost < bestCost) {
        bestCost = cost;
        bestAt = at;
      }
    });
    const [next] = remaining.splice(bestAt, 1);
    order.push(next);
    here = next;
  }

  const walk = (list: ID[]) =>
    list.reduce(
      (sum, id, at) => (at === 0 ? sum : sum + between(list[at - 1], id)),
      0,
    );
  // 2-opt: reverse a span if it shortens the walk. Small lists converge fast.
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < order.length - 1; a++) {
      for (let b = a + 1; b < order.length; b++) {
        const candidate = [
          ...order.slice(0, a),
          ...order.slice(a, b + 1).reverse(),
          ...order.slice(b + 1),
        ];
        if (walk(candidate) < walk(order) - 1e-9) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
}
