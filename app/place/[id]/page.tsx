"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { use } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import ItemPhoto from "@/components/ItemPhoto";
import MapCanvas from "@/components/MapCanvas";
import { QuietLink, Rule } from "@/components/ui";

/**
 * /place/[id] — one place, on the map, with everything in it. This is the
 * Answer's "This place", so it must feel like the answer: same quiet map,
 * same list, no extra chrome.
 */
export default function Page({ params }: PageProps<"/place/[id]">) {
  const { id } = use(params);

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

  const place = nodes.find((node) => node.id === id);
  const here = items.filter((item) => item.placeId === id);

  return (
    <div className="min-h-dvh bg-paper pb-10">
      <header className="flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <QuietLink href="/" className="-ml-2">
          <ChevronLeft size={20} />
          Home
        </QuietLink>
      </header>

      <h1 className="px-4 pt-1 pb-3 text-title text-ink">
        {place?.name ?? "Not found"}
      </h1>

      <MapCanvas
        className="mx-4 h-72 rounded-lg"
        nodes={nodes}
        edges={edges}
        items={items}
        targetId={place?.id ?? null}
        fitKey={spaceId ?? ""}
      />

      <div className="px-4 pt-6">
        <p className="text-caption uppercase tracking-wide text-quiet">
          {here.length === 0
            ? "Nothing here yet"
            : `${here.length} ${here.length === 1 ? "thing" : "things"} here`}
        </p>
        <div className="mt-2">
          <Rule />
        </div>
        <ul>
          {here.map((item) => (
            <li key={item.id}>
              <Link
                href={`/item/${item.id}`}
                className="flex min-h-16 items-center gap-3 border-b border-line/60 px-1 text-body text-ink"
              >
                <ItemPhoto photoId={item.photoId} name={item.name} size={44} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.slot && <span className="truncate text-caption text-quiet">{item.slot}</span>}
                <ChevronRight size={18} className="shrink-0 text-quiet" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
