"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { Space } from "./types";

/** The most recently created space is the active one. No auth, no accounts. */
export function useSpace(): { space: Space | undefined; ready: boolean } {
  const spaces = useLiveQuery(() => db.spaces.toArray(), [], undefined);
  const space = spaces
    ? [...spaces].sort((a, b) => b.createdAt - a.createdAt)[0]
    : undefined;
  return { space, ready: spaces !== undefined };
}
