"use client";

/**
 * Stand-in for a photo. Calm paper tints only: the accent belongs to the
 * target, so placeholders must never compete with it. The initials do the
 * identifying, which is enough to recognise a shelf of things.
 */

const TINTS = ["#EFEDE6", "#E9E5DC", "#E4E7E1", "#ECE7DE", "#E6E2E8", "#E8E4DB"];

const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const tintFor = (name: string) => TINTS[hash(name) % TINTS.length];

/** First letters of the first two meaningful words. */
export function initials(name: string) {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => !/^\d+$/.test(w) && w.length > 1);
  if (!parts.length) return name.slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Glyph({
  name,
  size = 96,
  className = "",
  rounded = "rounded-md",
}: {
  name: string;
  /** expected rendered edge in px; the initials are sized from it */
  size?: number;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center overflow-hidden ${rounded} ${className}`}
      style={{ background: tintFor(name), fontSize: Math.round(size * 0.3) }}
    >
      <span className="select-none font-semibold tracking-[0.06em] text-ink-quiet">
        {initials(name)}
      </span>
    </div>
  );
}
