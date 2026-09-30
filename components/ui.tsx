"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Frosted sheet surface. Depth from blur, not borders. */
export function Sheet({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<"div">) {
  return (
    <div
      className={`frosted rounded-lg shadow-sheet ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

type ButtonTone = "quiet" | "primary" | "bare";

/**
 * Primary targets are >= 56px (Fitts). Accent is used for exactly one
 * thing per screen, so `primary` is deliberately reserved for it.
 */
export function Button({
  tone = "quiet",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  tone?: ButtonTone;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & ComponentProps<"button">) {
  const sizes = {
    sm: "h-11 px-4 text-caption rounded-sm",
    md: "h-14 px-5 text-body rounded-md",
    lg: "h-14 px-6 text-body rounded-md",
  } as const;
  const tones: Record<ButtonTone, string> = {
    quiet: "bg-surface/80 text-ink shadow-sheet hover:bg-surface",
    primary: "bg-accent text-white shadow-sheet hover:brightness-105",
    bare: "text-ink-quiet hover:text-ink",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-[transform,filter,background-color] duration-200 active:scale-[0.98] disabled:opacity-40 ${sizes[size]} ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 56px round target for the bottom thumb zone. */
export function RoundButton({
  label,
  tone = "quiet",
  className = "",
  children,
  ...rest
}: {
  label: string;
  tone?: ButtonTone;
  className?: string;
  children: ReactNode;
} & ComponentProps<"button">) {
  const tones: Record<ButtonTone, string> = {
    quiet: "bg-surface/85 text-ink shadow-sheet",
    primary: "bg-accent text-white shadow-sheet",
    bare: "text-ink-quiet",
  };
  return (
    <button
      aria-label={label}
      className={`flex size-14 items-center justify-center rounded-full transition-transform duration-200 active:scale-95 ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function QuietLink({
  href,
  className = "",
  children,
  ...rest
}: { href: string; className?: string; children: ReactNode } & ComponentProps<"a">) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center text-body text-ink-quiet ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Hairline. Used sparingly. */
export function Rule({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`h-px w-full bg-line ${className}`} />;
}
