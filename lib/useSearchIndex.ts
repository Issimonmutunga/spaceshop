"use client";

import { useEffect, useState } from "react";
import { db } from "./db";
import { reindexAll, search, upsert, remove as removeFromIndex } from "./search";
import type { ID, Item, Node } from "./types";

/**
 * Keeps the search index in step with the database. The index is rebuilt once
 * per space load and then maintained per mutation, so a query never waits.
 */
export function useSearchIndex(spaceId: ID | undefined) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    (async () => {
      const [items, nodes] = await Promise.all([
        db.items.where("spaceId").equals(spaceId).toArray(),
        db.nodes.where("spaceId").equals(spaceId).toArray(),
      ]);
      if (cancelled) return;
      reindexAll(items.filter((i) => !i.deleted), nodes);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  return ready;
}

/** Reindex a single item after it changes. */
export function reindexItem(item: Item, place: Node | undefined) {
  if (item.deleted) removeFromIndex(item.id);
  else upsert(item, place);
}

export { search };
