"use client";

import { useCallback, useRef } from "react";
import { formatDistance, normalizeBearing } from "@/lib/geometry";
import { useUI } from "@/lib/store";

/**
 * A compass dial and a distance wheel: the two numbers a surveyor reads off
 * the world. Drag the needle or tap a compass point; drag the wheel or use the
 * stepper. Both are real inputs for a keyboard or a screen reader.
 */
export default function BearingDial({
  bearing,
  meters,
  onBearing,
  onMeters,
  size = 168,
}: {
  bearing: number;
  meters: number;
  onBearing: (value: number) => void;
  onMeters: (value: number) => void;
  size?: number;
}) {
  const units = useUI((s) => s.units);
  const radius = size / 2;
  const needle = useRef<{ at: number } | null>(null);

  const pick = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      // Canvas y is down; bearings are clockwise from up, so negate.
      onBearing(normalizeBearing((Math.atan2(dx, -dy) * 180) / Math.PI));
    },
    [onBearing],
  );

  const rad = ((bearing - 90) * Math.PI) / 180;
  const tip = {
    x: radius + Math.cos(rad) * (radius - 22),
    y: radius + Math.sin(rad) * (radius - 22),
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        role="slider"
        tabIndex={0}
        aria-label="Bearing"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(bearing)}
        aria-valuetext={`${Math.round(bearing)} degrees`}
        viewBox={`0 0 ${size} ${size}`}
        className="touch-none select-none"
        style={{ width: size, height: size }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          needle.current = { at: Date.now() };
          pick(event);
        }}
        onPointerMove={(event) => {
          if (needle.current) pick(event);
        }}
        onPointerUp={() => {
          needle.current = null;
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 15 : 5;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onBearing(normalizeBearing(bearing - step));
          }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onBearing(normalizeBearing(bearing + step));
          }
        }}
      >
        <circle cx={radius} cy={radius} r={radius - 2} fill="var(--surface)" stroke="var(--line)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          const inner = radius - (deg % 90 === 0 ? 16 : 10);
          return (
            <line
              key={deg}
              x1={radius + Math.cos(a) * inner}
              y1={radius + Math.sin(a) * inner}
              x2={radius + Math.cos(a) * (radius - 4)}
              y2={radius + Math.sin(a) * (radius - 4)}
              stroke="var(--line)"
              strokeWidth={deg % 90 === 0 ? 2 : 1}
            />
          );
        })}
        <text
          x={radius}
          y={radius - radius + 22}
          textAnchor="middle"
          fontSize={11}
          fill="var(--ink-quiet)"
        >
          N
        </text>
        <line
          x1={radius}
          y1={radius}
          x2={tip.x}
          y2={tip.y}
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={radius} cy={radius} r={4} fill="var(--accent)" />
      </svg>

      <div className="flex items-center gap-3">
        <Stepper label="Closer" onClick={() => onMeters(Math.max(0.1, round(meters - 0.5)))}>
          −
        </Stepper>
        <div className="text-center">
          <p className="text-title text-ink tabular-nums">{Math.round(bearing)}°</p>
          <p className="text-caption text-quiet tabular-nums">
            {formatDistance(meters, units)}
          </p>
        </div>
        <Stepper label="Further" onClick={() => onMeters(round(meters + 0.5))}>
          +
        </Stepper>
      </div>

      <label className="w-full max-w-56">
        <span className="text-caption uppercase tracking-wide text-quiet">
          Distance ({units})
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0.1}
          step={0.1}
          value={meters}
          onChange={(event) => onMeters(Math.max(0.1, Number(event.target.value) || 0.1))}
          className="mt-1 h-12 w-full rounded-md bg-surface px-3 text-body text-ink"
        />
      </label>
    </div>
  );
}

function Stepper({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full bg-surface text-lg text-ink shadow-sheet active:scale-95"
    >
      {children}
    </button>
  );
}

const round = (value: number) => Math.round(value * 10) / 10;
