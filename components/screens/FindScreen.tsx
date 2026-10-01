"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map as MapIcon, Plus, ScanLine, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { Can } from "@/lib/role";
import { RoundButton } from "@/components/ui";

/**
 * Home. A vast, empty ground. One oversized field, centred vertically.
 * One primary action per screen (Hick): the accent belongs to Add.
 */
export default function FindScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/?q=${encodeURIComponent(q)}`);
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="safe-t flex items-center justify-between px-6 pt-4">
        <Link
          href="/settings"
          aria-label="Settings"
          className="-ml-1 select-none px-1 py-1 text-caption tracking-[0.28em] text-ink-quiet uppercase"
        >
          locus
        </Link>
        <Can action="edit-map">
          <Link
            href="/map"
            aria-label="Map"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-quiet"
          >
            <MapIcon aria-hidden className="size-5" strokeWidth={1.5} />
          </Link>
        </Can>
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 pb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-3 border-b border-line pb-3"
        >
          <Search aria-hidden className="size-5 shrink-0 text-ink-quiet" strokeWidth={1.5} />
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
      </div>

      <nav
        aria-label="Primary"
        className="safe-b flex items-center justify-center gap-6 px-6 pb-6"
      >
        <RoundButton label="Scan" onClick={() => router.push("/scan")}>
          <ScanLine aria-hidden className="size-6" strokeWidth={1.5} />
        </RoundButton>
        <Can action="add">
          <RoundButton label="Add" tone="primary" onClick={() => router.push("/add")}>
            <Plus aria-hidden className="size-7" strokeWidth={1.5} />
          </RoundButton>
        </Can>
      </nav>
    </main>
  );
}
