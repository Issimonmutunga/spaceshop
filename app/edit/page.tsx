"use client";

import Link from "next/link";
import { use } from "react";
import { Can } from "@/lib/role";
import type { NodeKind } from "@/lib/types";
import MapEditor from "@/components/MapEditor";

const KINDS: NodeKind[] = ["zone", "place", "point"];

/**
 * /edit?at=<node>&new=<kind> — drawing the map.
 * Anyone who cannot edit gets a quiet explanation, not a dead end.
 */
export default function Page({ searchParams }: PageProps<"/edit">) {
  const query = use(searchParams);
  const at = first(query.at);
  const newKind = first(query.new);
  const inside = first(query.in);

  return (
    <Can
      action="edit-map"
      fallback={
        <main className="flex min-h-dvh flex-col justify-center gap-4 px-6">
          <h1 className="text-title text-ink">Editing is for managers.</h1>
          <p className="text-body text-ink-quiet">
            Ask someone with the manager role to change the map. You can still
            search everything in it.
          </p>
          <Link href="/map" className="min-h-11 self-start text-body text-ink-quiet">
            Back to the map
          </Link>
        </main>
      }
    >
      <MapEditor
        focusId={at || null}
        insideId={inside || null}
        newKind={KINDS.includes(newKind as NodeKind) ? (newKind as NodeKind) : null}
      />
    </Can>
  );
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";
