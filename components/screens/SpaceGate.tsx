"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import SetupScreen from "./SetupScreen";

/**
 * First run gate. One sentence, one button, and nothing else until there is a
 * space to hold things. Every route sits behind it, so a wiped database always
 * has a way back in.
 */
export default function SpaceGate({ children }: { children: ReactNode }) {
  const count = useLiveQuery(() => db.spaces.count(), [], undefined);

  // Nothing is drawn until IndexedDB answers: no flash of the wrong screen.
  if (count === undefined) return null;
  if (count === 0) return <SetupScreen />;

  return <>{children}</>;
}
