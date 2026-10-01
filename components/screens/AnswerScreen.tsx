"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { db } from "@/lib/db";
import { whereIs } from "@/lib/labels";
import { Can } from "@/lib/role";
import type { ID, Item } from "@/lib/types";
import ItemPhoto from "@/components/ItemPhoto";
import MiniMap from "@/components/MiniMap";
import { Button } from "@/components/ui";

/**
 * The answer. One figure, three stacked lines, nothing else.
 * Progressive disclosure: the answer first, the map second, details on demand.
 */
export default function AnswerScreen({
  itemId,
  matches = [],
}: {
  itemId: ID;
  matches?: ID[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(itemId);

  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const siblings = useLiveQuery(
    () => db.items.bulkGet(matches.filter((id) => id !== itemId)),
    [itemId, matches.join(",")],
    [],
  );
  const nodes = useLiveQuery(
    () =>
      item
        ? db.nodes
            .where("spaceId")
            .equals(item.spaceId)
            .filter((n) => !n.deleted)
            .toArray()
        : [],
    [item?.spaceId],
    [],
  );

  if (!item) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <p className="text-body text-ink-quiet">Not found.</p>
        <Link href="/" className="mt-2 min-h-11 text-body text-ink-quiet">
          Back
        </Link>
      </main>
    );
  }

  const others: Item[] = siblings.flatMap((s) =>
    s && !s.deleted ? [s] : [],
  );
  const active =
    activeId === item.id ? item : others.find((o) => o.id === activeId) ?? item;
  const where = whereIs(active, nodes);
  const carousel: Item[] = [item, ...others];

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="safe-t flex items-center px-2 pt-2">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full text-ink-quiet"
        >
          <ChevronLeft aria-hidden className="size-6" strokeWidth={1.5} />
        </button>
      </header>

      {carousel.length > 1 && (
        <ul
          aria-label="Other matches"
          className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6"
        >
          {carousel.map((candidate) => {
            const selected = candidate.id === active.id;
            return (
              <li key={candidate.id} className="snap-start">
                <button
                  onClick={() => setActiveId(candidate.id)}
                  aria-pressed={selected}
                  aria-label={candidate.name}
                  className={`block rounded-md transition-opacity duration-200 ${
                    selected ? "opacity-100" : "opacity-45"
                  }`}
                >
                  <ItemPhoto
                    photoId={candidate.photoId}
                    name={candidate.name}
                    size={64}
                    className="rounded-md"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex w-full flex-col items-center"
        >
          <ItemPhoto
            photoId={active.photoId}
            name={active.name}
            size={200}
            className="rounded-lg shadow-sheet"
          />
          <h1 className="mt-6 text-center text-title font-semibold tracking-tight text-balance">
            {active.name}
          </h1>
          <p className="mt-5 text-center text-[2.5rem] leading-[1.02] font-semibold tracking-tight text-balance">
            {[where?.zone, where?.place, where?.slot]
              .filter(Boolean)
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </p>
        </motion.div>

        <div className="mt-8 w-full max-w-sm">
          <MiniMap nodes={nodes} targetId={active.placeId} />
        </div>
      </div>

      <div className="safe-b flex flex-col items-center gap-2 px-6 pb-6">
        <Button
          tone="primary"
          className="w-full max-w-sm"
          onClick={() => router.push(`/guide?item=${active.id}`)}
        >
          Guide me
        </Button>
        <Can action="move">
          <div className="flex w-full max-w-sm gap-2">
            <Button
              className="flex-1"
              onClick={() => router.push(`/move?item=${active.id}`)}
            >
              Moved it
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push(`/place/${active.placeId}`)}
            >
              This place
            </Button>
          </div>
        </Can>
      </div>
    </main>
  );
}
