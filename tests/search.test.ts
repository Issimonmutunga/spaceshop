import { beforeEach, describe, expect, it } from "vitest";
import supermarketSeed from "@/seed/supermarket.json";
import homeSeed from "@/seed/home.json";
import { importSeedFile } from "@/lib/seed";
import { db } from "@/lib/db";
import { didYouMean, expand, rank, reindexAll, search } from "@/lib/search";
import type { SeedFile } from "@/lib/types";

async function load(seed: unknown) {
  await db.delete();
  await db.open();
  const { space } = await importSeedFile(seed as SeedFile);
  const nodes = await db.nodes.toArray();
  const items = await db.items.toArray();
  reindexAll(items, nodes);
  return { spaceId: space.id, nodes, items };
}

const namesFor = (hits: { id: string }[], items: { id: string; name: string }[]) =>
  hits.map((h) => items.find((i) => i.id === h.id)!.name);

describe("search", () => {
  let ctx: Awaited<ReturnType<typeof load>>;

  beforeEach(async () => {
    ctx = await load(supermarketSeed);
  });

  it("finds an item by exact name in one query", () => {
    const hits = search("Chopped tomatoes", ctx.spaceId);
    expect(namesFor(hits, ctx.items)[0]).toBe("Chopped tomatoes");
    expect(hits[0].match).toBe("exact");
  });

  it("finds an item by tag", () => {
    const hits = search("crisps", ctx.spaceId);
    expect(namesFor(hits, ctx.items)).toContain("Salted crisps");
  });

  it("finds an item by place name", () => {
    const hits = search("Pastry case", ctx.spaceId);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => ctx.items.find((i) => i.id === h.id)!.name === "Butter croissant")).toBe(
      true,
    );
  });

  it("keeps a fuzzy near-miss last, never as the answer", () => {
    // "french" is one edit from "wrench", so a fuzzy hit is expected; it must
    // rank below every real match, and never be presented as one.
    const hits = search("wrench", ctx.spaceId);
    for (const hit of hits) expect(hit.match).toBe("fuzzy");
  });

  it("is fuzzy about typos", () => {
    const hits = search("choclate", ctx.spaceId);
    expect(namesFor(hits, ctx.items)).toContain("Pain au chocolat");
  });

  it("matches a prefix", () => {
    expect(namesFor(search("choc", ctx.spaceId), ctx.items)).toContain("Dark chocolate 70%");
  });

  it("is case and unit insensitive", () => {
    expect(search("CHOPPED TOMATOES", ctx.spaceId).length).toBeGreaterThan(0);
    expect(search("paracetamol 500mg", ctx.spaceId).length).toBe(
      search("paracetamol 500 mg", ctx.spaceId).length,
    );
  });

  it("never returns the same item twice when synonyms overlap", () => {
    const hits = search("cable", ctx.spaceId);
    expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length);
  });

  it("ranks a name match above a tag match", () => {
    const hits = search("ground coffee", ctx.spaceId);
    expect(namesFor(hits, ctx.items)[0]).toBe("Ground coffee 500 g");
    expect(hits[0].match).toBe("prefix");

    // Everything weaker than a name match ranks below it.
    const best = hits[0].score;
    const weaker = hits.filter((h) => h.match === "tag" || h.match === "fuzzy");
    expect(weaker.every((h) => h.score < best)).toBe(true);
  });

  it("stays well inside 50 ms on 5,000 items", () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      ...ctx.items[i % ctx.items.length],
      id: `bulk_${i}`,
      name: `Bulk item ${i} ${ctx.items[i % ctx.items.length].name}`,
      updatedAt: i,
    }));
    reindexAll(many, ctx.nodes);
    const started = performance.now();
    for (let i = 0; i < 20; i++) search("chopped tomatoes", ctx.spaceId);
    const perQuery = (performance.now() - started) / 20;
    expect(perQuery).toBeLessThan(50);
  });
});

describe("search, home seed", () => {
  it("finds the spanner in the toolbox", async () => {
    const ctx = await load(homeSeed);
    const hits = search("10mm spanner", ctx.spaceId);
    expect(namesFor(hits, ctx.items)[0]).toBe("10 mm spanner");
  });

  it("finds paracetamol by a colloquial tag", async () => {
    const ctx = await load(homeSeed);
    expect(namesFor(search("pills", ctx.spaceId), ctx.items)).toContain("Paracetamol");
  });

  it("finds the spanner by its synonym, wrench", async () => {
    const ctx = await load(homeSeed);
    expect(namesFor(search("wrench", ctx.spaceId), ctx.items)).toContain("10 mm spanner");
    expect(namesFor(search("10mm wrench", ctx.spaceId), ctx.items)).toContain("10 mm spanner");
  });
});

describe("ranking", () => {
  const doc = (over: Partial<Parameters<typeof rank>[0]>) => ({
    id: "x",
    name: "Blue toolbox",
    tags: "tool",
    place: "Garage",
    spaceId: "s",
    updatedAt: 0,
    deleted: 0 as const,
    ...over,
  });

  it("prefers exact name", () => {
    expect(rank(doc({ name: "Spanner" }), "spanner").match).toBe("exact");
    expect(rank(doc({ name: "Spanner set" }), "spanner").match).toBe("prefix");
    expect(rank(doc({ tags: "spanner" }), "spanner").match).toBe("tag");
    expect(rank(doc({ place: "Spanner rack" }), "spanner").match).toBe("place");
  });

  it("orders match kinds by strength", () => {
    const scores = [
      rank(doc({ name: "Spanner" }), "spanner").score,
      rank(doc({ name: "Spanner set" }), "spanner").score,
      rank(doc({ name: "Metric spanner 10" }), "spanner").score,
      rank(doc({ name: "Other", tags: "spanner" }), "spanner").score,
      rank(doc({ name: "Other", tags: "x", place: "Spanner aisle" }), "spanner").score,
    ];
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe("synonyms", () => {
  it("expands both directions", () => {
    expect(expand("wrench")).toContain("spanner");
    expect(expand("spanner")).toContain("wrench");
  });

  it("suggests the word the space actually uses", () => {
    expect(didYouMean("wrench")).toEqual(["spanner"]);
    expect(didYouMean("spanner")).toEqual([]);
  });
});
