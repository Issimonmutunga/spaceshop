"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { byId } from "@/lib/labels";
import { Can } from "@/lib/role";
import type { ID } from "@/lib/types";
import MapCanvas from "@/components/MapCanvas";
import NodeSheet from "@/components/NodeSheet";
import { Button, RoundButton } from "@/components/ui";

/**
 * /map — the whole space, and nothing else. Tap a node for its sheet.
 * Auto-fits on open, which is section 5's "you always know where you are".
 */
function MapScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const focus = params.get("at");
  const [selectedId, setSelectedId] = useState<ID | null>(focus);

  const spaces = useLiveQuery(() => db.spaces.toArray(), [], []);
  const spaceId = spaces[0]?.id;
  const nodes = useLiveQuery(
    () =>
      spaceId
        ? db.nodes.where("spaceId").equals(spaceId).filter((n) => !n.deleted).toArray()
        : [],
    [spaceId],
    [],
  );
  const edges = useLiveQuery(
    () =>
      spaceId
        ? db.edges.where("spaceId").equals(spaceId).filter((e) => !e.deleted).toArray()
        : [],
    [spaceId],
    [],
  );
  const items = useLiveQuery(
    () =>
      spaceId
        ? db.items.where("spaceId").equals(spaceId).filter((i) => !i.deleted).toArray()
        : [],
    [spaceId],
    [],
  );

  const selected = selectedId ? (byId(nodes).get(selectedId) ?? null) : null;
  const places = nodes.filter((n) => n.kind === "place").length;
  const zones = nodes.filter((n) => n.kind === "zone").length;

  return (
    <div className="fixed inset-0 bg-paper">
      <MapCanvas
        className="absolute inset-0"
        height="100%"
        nodes={nodes}
        edges={edges}
        items={items}
        selectedId={selectedId}
        onSelect={setSelectedId}
        fitKey={spaceId ?? ""}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="frosted rounded-md px-3 py-2">
          <p className="text-body text-ink">
            {spaces[0]?.name ?? "No space"}
          </p>
          <p className="text-caption text-quiet">
            {zones} areas · {places} places
          </p>
        </div>
        <Can action="edit-map">
          <RoundButton
            label="Add to the map"
            tone="primary"
            className="pointer-events-auto"
            onClick={() => router.push("/edit")}
          >
            <Plus size={22} />
          </RoundButton>
        </Can>
      </div>

      {!selected && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-surface/80 px-4 py-2 text-caption text-ink-quiet">
          <MapPin size={12} className="mr-1 inline align-[-1px]" />
          Tap a place to see what is in it
        </p>
      )}

      <NodeSheet
        node={selected}
        nodes={nodes}
        edges={edges}
        items={items}
        onClose={() => setSelectedId(null)}
        actions={
          selected ? (
            <>
              {selected.kind !== "point" && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/edit?new=place&in=${selected.id}`)}
                >
                  Add a place here
                </Button>
              )}
              <Can action="edit-map">
                <Button size="sm" onClick={() => router.push(`/edit?at=${selected.id}`)}>
                  Edit
                </Button>
              </Can>
            </>
          ) : null
        }
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MapScreen />
    </Suspense>
  );
}
