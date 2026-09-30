"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "manager" | "staff" | "visitor";
export type Units = "m" | "ft";
export type Theme = "auto" | "light" | "dark";

interface UIState {
  role: Role;
  units: Units;
  theme: Theme;
  /** Space code used for the optional light backend. */
  syncCode: string | null;
  hasChosenRole: boolean;
  setRole: (role: Role) => void;
  setUnits: (units: Units) => void;
  setTheme: (theme: Theme) => void;
  setSyncCode: (code: string | null) => void;
  chooseRole: (role: Role) => void;
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
      setRole: (role) => set({ role, hasChosenRole: true }),
      setUnits: (units) => set({ units }),
      setTheme: (theme) => set({ theme }),
      setSyncCode: (syncCode) => set({ syncCode }),
      chooseRole: (role) => set({ role, hasChosenRole: true }),
    }),
    { name: "locus-ui" },
  ),
);
