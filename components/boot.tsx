"use client";

import { useEffect } from "react";
import { useUI } from "@/lib/store";

/** Offline shell. Registered after load so it never delays first paint. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const register = () =>
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

/** Applies the theme choice from settings; `auto` follows the system. */
export function ThemeSync() {
  const theme = useUI((s) => s.theme);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "auto") delete el.dataset.theme;
    else el.dataset.theme = theme;
  }, [theme]);
  return null;
}
