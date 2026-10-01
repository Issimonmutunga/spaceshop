"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { loadBlank, loadSeed, type SeedName } from "@/lib/seed";

/**
 * First run. One sentence and one button. The demo must make the app feel
 * alive immediately, so it is offered first and needs no explanation.
 */
export default function SetupScreen() {
  const [step, setStep] = useState<"ask" | "demo">("ask");
  const [busy, setBusy] = useState<SeedName | "blank" | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (which: SeedName | "blank") => {
    setBusy(which);
    setFailed(false);
    try {
      if (which === "blank") await loadBlank();
      else await loadSeed(which);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="max-w-sm"
      >
        <h1 className="text-title font-semibold tracking-tight text-balance">
          Set up a space.
        </h1>
        <p className="mt-3 text-body text-ink-quiet">
          A shop, a house, an office. Where things are, and where to find them.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          {step === "ask" ? (
            <>
              <Button tone="primary" onClick={() => setStep("demo")} disabled={!!busy}>
                Load demo
              </Button>
              <Button onClick={() => run("blank")} disabled={!!busy}>
                Start blank
              </Button>
            </>
          ) : (
            <>
              <Button tone="primary" onClick={() => run("supermarket")} disabled={!!busy}>
                {busy === "supermarket" ? "…" : "Supermarket"}
              </Button>
              <Button onClick={() => run("home")} disabled={!!busy}>
                {busy === "home" ? "…" : "Home"}
              </Button>
              <button
                onClick={() => setStep("ask")}
                className="mt-1 min-h-11 self-start text-caption text-ink-quiet"
              >
                Back
              </button>
            </>
          )}

          {failed && <p className="text-caption text-ink-quiet">Not loaded. Try again.</p>}
        </div>
      </motion.div>
    </main>
  );
}
