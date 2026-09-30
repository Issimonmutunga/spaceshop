"use client";

import type { ReactNode } from "react";
import { useUI, type Role } from "./store";

/** Every gated capability in the app. Add here, never inside components. */
export type Action =
  | "edit-map"
  | "add"
  | "move"
  | "remove"
  | "print"
  | "sync"
  | "history";

const GRANTS: Record<Role, Action[]> = {
  manager: [
    "edit-map",
    "add",
    "move",
    "remove",
    "print",
    "sync",
    "history",
  ],
  staff: ["add", "move", "remove"],
  visitor: [],
};

/** One hook, one wrapper, no scattered role checks. Roles are a view switch. */
export function useRole() {
  const role = useUI((s) => s.role);
  const allowed = GRANTS[role];
  return {
    role,
    can: (action: Action) => allowed.includes(action),
    isVisitor: role === "visitor",
    isStaff: role === "staff",
    isManager: role === "manager",
  };
}

export function Can({
  action,
  children,
  fallback = null,
}: {
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useRole();
  return can(action) ? children : fallback;
}
