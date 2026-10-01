"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { Map as MapIcon, Plus, ScanLine, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Can } from "@/lib/role";
import { liveItems, liveNodes } from "@/lib/db";
import { byId } from "@/lib/labels";
import { search } from "@/lib/search";
import { useSearchIndex } from "@/lib/useSearchIndex";
import { useSpace } from "@/lib/useSpace";
import { useUI } from "@/lib/store";
import type { Item } from "@/lib/types";
import { RoundButton } from "@/components/ui";
import ItemPhoto from "@/components/ItemPhoto";
import ResultRow from "@/components/ResultRow";

/**
 * Home. A vast, empty ground. One oversized field, centred vertically.
 * One primary action per screen (Hick): the accent belongs to Add.
 */
export default function FindScreen() {
  const router = useRouter();
  const { space } = useSpace();
  const spaceId = space?.id;
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const indexed = useSearchIndex(spaceId);
  const recents = useUI((s) => s.recents);
  const addRecent = useUI((s) => s.addRecent);

  const items = useLiveQuery(() => (spaceId ? liveItems(spaceId) : []), [spaceId], []);
  const nodes = useLiveQuery(() => (spaceId ? liveNodes(spaceId) : []), [spaceId], []);

  const index = useMemo(() => byId(nodes), [nodes]);
  const trimmed = deferred.trim();
  const searching = trimmed.length > 0;

  const results: Item[] = useMemo(() => {
    if (!searching || !indexed || !spaceId) return [];
    return search(deferred, spaceId, 12)
      .map((hit) => items.find((i) => i.id === hit.id))
      .filter((i): i is Item => Boolean(i));
  }, [searching, indexed, spaceId, deferred, items]);

  // A search counts as recent once the typing settles on it.
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(trimmed), 900);
    return () => clearTimeout(timer);
  }, [trimmed]);
  useEffect(() => {
    const top = results[0];
    if (!settled || !top) return;
    addRecent(settled, top.id);
    // Only re-record when the settled query or its best answer changes.
  }, [settled, results, addRecent]);

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="safe-t flex items-center justify-between px-6 pt-4">
        <button
          onClick={() => router.push("/settings")}
          aria-label="Settings"
          className="-ml-1 select-none px-1 py-1 text-caption tracking-[0.28em] text-ink-quiet uppercase"
        >
          locus
        </button>
        <Can action="edit-map">
          <button
            onClick={() => router.push("/map")}
            aria-label="Map"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-quiet"
          >
            <MapIcon aria-hidden className="size-5" strokeWidth={1.5} />
          </button>
        </Can>
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 pb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0]) router.push(`/item/${results[0].id}`);
          }}
          className="flex items-center gap-3 border-b border-line pb-3"
        >
          <Search
            aria-hidden
            className="size-5 shrink-0 text-ink-quiet"
            strokeWidth={1.5}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Where is"
            placeholder="Where is…"
            className="min-w-0 flex-1 bg-transparent text-[2rem] leading-[1.1] font-semibold tracking-tight placeholder:text-ink-quiet/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-quiet"
            >
              <X aria-hidden className="size-5" strokeWidth={1.5} />
            </button>
          )}
        </form>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          {searching ? (
            results.length > 0 ? (
              <ul className="-mx-2">
                {results.map((item) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    nodes={nodes}
                    index={index}
                  />
                ))}
              </ul>
            ) : (
              <p className="pt-2 text-body text-ink-quiet">Not found.</p>
            )
          ) : recents.length > 0 ? (
            <ul className="flex gap-3">
              {recents.map((recent) => {
                const item = items.find((i) => i.id === recent.itemId);
                if (!item) return null;
                return (
                  <li key={recent.query}>
                    <button
                      onClick={() => setQuery(recent.query)}
                      className="w-20"
                      title={recent.query}
                    >
                      <ItemPhoto
                        photoId={item.photoId}
                        name={item.name}
                        size={80}
                        className="w-20"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="safe-b flex items-center justify-center gap-6 px-6 pb-6"
      >
        <RoundButton
          label="Scan"
          onClick={() => router.push("/scan")}
        >
          <ScanLine aria-hidden className="size-6" strokeWidth={1.5} />
        </RoundButton>
        <Can action="add">
          <RoundButton
            label="Add"
            tone="primary"
            onClick={() => router.push("/add")}
          >
            <Plus aria-hidden className="size-7" strokeWidth={1.5} />
          </RoundButton>
        </Can>
      </nav>
    </main>
  );
}
