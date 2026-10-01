"use client";

import MiniSearch from "minisearch";
import type { ID, Item, Node } from "./types";

/**
 * Client-side search. Fully offline: names, tags and place names are indexed
 * with fuzzy + prefix matching, then ranked by our own rules so the ordering
 * is predictable and unit-testable. Reindexing is incremental.
 */

export interface SearchDoc {
  id: ID;
  name: string;
  tags: string;
  place: string;
  spaceId: ID;
  updatedAt: number;
  deleted: 0 | 1;
}

export interface Hit {
  id: ID;
  score: number;
  match: "exact" | "prefix" | "words" | "tag" | "place" | "fuzzy";
}

/** spanner/wrench, biscuit/cookie: the pairs people actually mistype. */
const SYNONYMS: Record<string, string[]> = {
  spanner: ["wrench"],
  wrench: ["spanner"],
  biscuit: ["cookie"],
  cookie: ["biscuit"],
  mobile: ["phone", "cellphone"],
  cellphone: ["mobile", "phone"],
  phone: ["mobile", "cellphone"],
  loo: ["toilet"],
  toilet: ["loo", "bathroom"],
  bathroom: ["toilet", "loo"],
  torch: ["flashlight"],
  flashlight: ["torch"],
  plug: ["socket"],
  socket: ["plug"],
  trowel: ["garden"],
  screwdriver: ["driver"],
  driver: ["screwdriver"],
  charger: ["lead", "cable"],
  cable: ["lead", "charger"],
  lead: ["cable", "charger"],
  meds: ["medicine", "tablet"],
  medicine: ["meds", "tablet"],
  pills: ["tablet", "medicine", "meds"],
  crisps: ["chips"],
  chips: ["crisps"],
  tin: ["can"],
  can: ["tin"],
  rubbish: ["waste", "trash"],
  trash: ["waste", "rubbish"],
  brolly: ["umbrella"],
  umbrella: ["brolly"],
  pliers: ["pincers"],
  lego: ["toy"],
};

const SUGGESTIONS: Record<string, string> = {
  wrench: "spanner",
  cellphone: "mobile",
  mobile: "cellphone",
  cookie: "biscuit",
  can: "tin",
  flashlight: "torch",
  trash: "rubbish",
  brolly: "umbrella",
  loo: "toilet",
  pincers: "pliers",
};

export const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2") // "10mm" -> "10 mm", "500mg" -> "500 mg"
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** The query plus its synonyms, so "wrench" finds the spanner. */
export const expand = (query: string): string[] => {
  const out = new Set<string>();
  for (const word of words(query)) {
    out.add(word);
    for (const alt of SYNONYMS[word] ?? []) out.add(alt);
  }
  return [...out];
};

export const didYouMean = (query: string) =>
  words(query)
    .map((w) => SUGGESTIONS[w])
    .filter((w): w is string => Boolean(w) && !words(query).includes(w as string));

const engine = new MiniSearch<SearchDoc>({
  fields: ["name", "tags", "place"],
  // name/tags/place must be stored: ranking reads them back off each hit.
  storeFields: ["name", "tags", "place", "spaceId", "updatedAt", "deleted"],
  searchOptions: {
    boost: { name: 4, tags: 2, place: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
});

export const toDoc = (item: Item, place: Node | undefined): SearchDoc => ({
  id: item.id,
  name: item.name,
  tags: item.tags.join(" "),
  place: place?.name ?? "",
  spaceId: item.spaceId,
  updatedAt: item.updatedAt,
  deleted: item.deleted ? 1 : 0,
});

export function reindexAll(items: Item[], nodes: Node[]) {
  const places = new Map(nodes.filter((n) => n.kind === "place").map((n) => [n.id, n]));
  engine.removeAll();
  engine.addAll(items.map((item) => toDoc(item, places.get(item.placeId))));
}

export function upsert(item: Item, place: Node | undefined) {
  if (engine.has(item.id)) engine.discard(item.id);
  if (!item.deleted) engine.add(toDoc(item, place));
}

export function remove(id: ID) {
  if (engine.has(id)) engine.discard(id);
}

const W = {
  exact: 100,
  prefix: 40,
  contains: 25,
  tag: 15,
  place: 8,
  fuzzy: 1,
} as const;

/** Ranking: exact name > prefix > name contains > tag > place name. */
export function rank(doc: SearchDoc, query: string): { score: number; match: Hit["match"] } {
  const q = query.trim().toLowerCase();
  const name = doc.name.toLowerCase();
  const tags = doc.tags.toLowerCase();
  const place = doc.place.toLowerCase();
  const parts = words(query);

  if (q && name === q) return { score: W.exact, match: "exact" };
  if (q && name.startsWith(q)) return { score: W.prefix, match: "prefix" };
  // "10mm spanner" against "10 mm spanner" and "spanner".
  if (parts.length > 1 && parts.every((w) => name.includes(w))) {
    return { score: W.contains, match: "words" };
  }
  if (q && name.includes(q)) return { score: W.contains, match: "words" };
  if (parts.some((w) => tags.includes(w))) return { score: W.tag, match: "tag" };
  if (q && place.includes(q)) return { score: W.place, match: "place" };
  return { score: W.fuzzy, match: "fuzzy" };
}

/** Recency only ever breaks a tie, so it cannot outrank a better match. */
const recency = (updatedAt: number) => (updatedAt % 100_000) / 100_000;

export function search(query: string, spaceId: ID, limit = 12): Hit[] {
  const terms = expand(query);
  if (!terms.length) return [];

  const docs = new Map<ID, SearchDoc>();
  for (const term of terms) {
    for (const result of engine.search(term)) {
      docs.set(result.id as ID, {
        id: result.id as ID,
        name: String(result.name),
        tags: String(result.tags),
        place: String(result.place),
        spaceId: String(result.spaceId),
        updatedAt: Number(result.updatedAt),
        deleted: Number(result.deleted) as 0 | 1,
      });
    }
  }

  return [...docs.values()]
    .filter((doc) => doc.spaceId === spaceId && doc.deleted !== 1)
    .map((doc) => {
      const { score, match } = rank(doc, query);
      return { id: doc.id, score: score + recency(doc.updatedAt), match };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const indexed = () => engine.documentCount;
