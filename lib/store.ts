"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ID } from "./types";

export type Role = "manager" | "staff" | "visitor";
export type Units = "m" | "ft";
export type Theme = "auto" | "light" | "dark";

export interface RecentSearch {
  query: string;
  itemId: ID;
  at: number;
}

interface UIState {
  role: Role;
  units: Units;
  theme: Theme;
  /** Space code used for the optional light backend. */
  syncCode: string | null;
  hasChosenRole: boolean;
  recents: RecentSearch[];
  setRole: (role: Role) => void;
  setUnits: (units: Units) => void;
  setTheme: (theme: Theme) => void;
  setSyncCode: (code: string | null) => void;
  /** Up to three, most recent first, no duplicates by query. */
  addRecent: (query: string, itemId: ID) => void;
}

/** UI state only. Domain data is read live from Dexie (lib/db.ts). */
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      role: "manager",
      units: "m",
      theme: "auto",
      syncCode: null,
      hasChosenRole: false,
      recents: [],
      setRole: (role) => set({ role, hasChosenRole: true }),
      setUnits: (units) => set({ units }),
      setTheme: (theme) => set({ theme }),
      setSyncCode: (syncCode) => set({ syncCode }),
      addRecent: (query, itemId) =>
        set((s) => ({
          recents: [
            { query, itemId, at: Date.now() },
            ...s.recents.filter((r) => r.query !== query),
          ].slice(0, 3),
        })),
    }),
    { name: "locus-ui" },
  ),
);
