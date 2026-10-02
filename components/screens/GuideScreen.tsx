"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { db } from "@/lib/db";
import { byId, zoneOf } from "@/lib/labels";
import { CHUNK, chunkSteps, planRoute, stepNote, type Step } from "@/lib/route";
import { whereIs } from "@/lib/labels";
import type { ID } from "@/lib/types";
import ItemPhoto from "@/components/ItemPhoto";
import { Button } from "@/components/ui";

/**
 * The guide. One step per screen, five words at most, and the thing you came
 * for on the last one, as large as a phone screen allows.
 *
 * The progress dots are the current chunk only, because four things is what a
 * person holds at once. A longer route shows its next chunk when this one is
 * done, which is why a route never has to be remembered all at once.
 */
export default function GuideScreen({ itemId }: { itemId: ID }) {
  const router = useRouter();
  const quiet = useReducedMotion();
  const [at, setAt] = useState(0);

  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const data = useLiveQuery(async () => {
    if (!item) return null;
    const [nodes, edges] = await Promise.all([
      db.nodes.where("spaceId").equals(item.spaceId).toArray(),
      db.edges.where("spaceId").equals(item.spaceId).toArray(),
    ]);
    return { nodes, edges };
  }, [item?.spaceId]);

  const steps = useMemo(
    () => (item && data ? planRoute(data.nodes, data.edges, item) : []),
    [item, data],
  );
  const chunks = useMemo(() => chunkSteps(steps), [steps]);
  const flat = useMemo(() => chunks.flat(), [chunks]);

  // The step being shown, counted across chunks.
  const step: Step | undefined = flat[at];
  const chunk = useMemo(
    () => chunks.findIndex((one) => one.includes(step!)),
    [chunks, step],
  );
  const last = at === flat.length - 1;

  const move = useCallback(
    (by: number) => setAt((current) => Math.min(flat.length - 1, Math.max(0, current + by))),
    [flat.length],
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

  // No walkable route: say so in one line rather than pretending.
  if (!step) {
    const where = whereIs(item, data?.nodes ?? []);
    return (
      <main className="flex min-h-dvh flex-col items-center justify-between px-6 py-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="text-title text-ink">{item.name}</p>
        <p className="text-body text-ink-quiet">
          {where?.place ? `It is in ${where.place}.` : "Not placed yet."} No way to walk
          there yet — link the map up first.
        </p>
        <div className="flex w-full max-w-sm gap-2">
          <Button className="flex-1" onClick={() => router.push(`/place/${item.placeId}`)}>
            Open the place
          </Button>
          <Button tone="primary" onClick={() => router.push("/map")}>
            Map
          </Button>
        </div>
      </main>
    );
  }

  const note = stepNote(step);
  const area = step.zoneId ? zoneOf(data?.nodes.find((n) => n.id === step.zoneId), byId(data?.nodes ?? [])) : undefined;
  const photo = step.placeId ?? item.placeId;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button tone="bare" size="sm" onClick={() => router.back()} aria-label="Back">
          <ChevronLeft size={20} />
        </Button>
        {area && <p className="text-caption uppercase tracking-wide text-quiet">{area.name}</p>}
        <span className="min-w-11" />
      </header>

      {/* The step. Full-bleed, one thing to look at. */}
      <div className="relative flex flex-1 items-center justify-center px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={step.id}
            initial={quiet ? false : { opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={quiet ? undefined : { opacity: 0, x: -48 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="flex w-full max-w-md flex-col items-center gap-6"
          >
            {last ? (
              // Serial position effect: the thing you came for is the loudest.
              <div className="flex w-full flex-col items-center gap-4">
                <ItemPhoto
                  photoId={item.photoId}
                  name={item.name}
                  size={280}
                  className="rounded-2xl shadow-sheet"
                />
                <figcaption className="text-center">
                  <p className="text-title text-ink">{step.itemName ?? item.name}</p>
                  <p className="text-body text-ink-quiet">
                    {[step.text, step.slot].filter(Boolean).join(", ")}
                  </p>
                </figcaption>
              </div>
            ) : (
              <>
                <TurnArrow turn={step.turn} />
                <figcaption className="text-center">
                  <p className="text-title text-ink">{step.text}</p>
                  {note && <p className="text-body text-ink-quiet">{note}</p>}
                </figcaption>
              </>
            )}
          </motion.figure>
        </AnimatePresence>
      </div>

      <footer className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Progress: this chunk only, never more than four. */}
        <div className="flex items-center justify-center gap-2" aria-label="Progress">
          {(chunks[chunk] ?? []).map((one) => (
            <button
              key={one.id}
              type="button"
              onClick={() => setAt(flat.indexOf(one))}
              aria-label={one.text}
              aria-current={one.id === step.id}
              className={`h-2.5 rounded-full transition-all ${
                one.id === step.id ? "w-6 bg-accent" : "w-2.5 bg-line"
              }`}
            />
          ))}
          {chunks.length > 1 && (
            <p className="ml-2 text-caption text-quiet">
              part {chunk + 1} of {chunks.length}
            </p>
          )}
        </div>

        <div className="flex w-full max-w-sm gap-2">
          {at > 0 && (
            <Button className="flex-1" onClick={() => move(-1)} aria-label="Back a step">
              <ChevronLeft size={20} />
            </Button>
          )}
          <Button
            tone="primary"
            className="flex-1"
            onClick={() => (last ? router.push(`/place/${photo}`) : move(1))}
          >
            {last ? "Show me" : "Next"}
            {last ? <ChevronRight size={20} /> : null}
          </Button>
        </div>
      </footer>
    </main>
  );
}

/**
 * The turn, as big as the screen allows. No bearing, no degrees: a person
 * standing in a shop needs to know which way to turn, not what 47° means.
 */
function TurnArrow({ turn }: { turn: Step["turn"] }) {
  if (!turn || turn === "straight") return null;
  const left = turn === "left";
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-40 w-40 text-accent"
      role="img"
      aria-label={left ? "Turn left" : "Turn right"}
    >
      <path
        d={left ? "M78 16 L42 60 L78 104" : "M42 16 L78 60 L42 104"}
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Kept beside the screen so the chunk size is visible where it is used. */
export const GUIDE_CHUNK = CHUNK;
