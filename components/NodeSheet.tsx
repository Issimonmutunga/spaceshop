"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { byId, zoneOf } from "@/lib/labels";
import type { Edge, Item, Node } from "@/lib/types";
import ItemPhoto from "@/components/ItemPhoto";
import { Button, Rule } from "@/components/ui";

const KIND_LABEL: Record<Node["kind"], string> = {
  zone: "Area",
  place: "Place",
  point: "Landmark",
};

/**
 * The sheet that opens when you tap the map: the whole node, its things, and
 * the few actions that make sense right now. Nothing else.
 */
export default function NodeSheet({
  node,
  nodes,
  edges,
  items,
  onClose,
  actions,
}: {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  items: Item[];
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  if (!node) return null;
  const index = byId(nodes);
  const held = items.filter((item) => item.placeId === node.id);
  const links = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const parent = node.parentId ? index.get(node.parentId) : undefined;
  const children = nodes.filter((n) => n.parentId === node.id);
  const zone = zoneOf(node, index);

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-10 flex max-h-[78vh] flex-col rounded-t-2xl bg-surface/95 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sheet backdrop-blur-xl"
      role="dialog"
      aria-label={node.name}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-wide text-quiet">
            {KIND_LABEL[node.kind]}
            {node.landmark ? " · landmark" : ""}
          </p>
          <h2 className="truncate text-title text-ink">{node.name}</h2>
          {zone && <p className="text-body text-ink-quiet">in {zone.name}</p>}
          {parent && !zone && <p className="text-body text-ink-quiet">in {parent.name}</p>}
        </div>
        <Button tone="bare" size="sm" onClick={onClose} aria-label="Close">
          <X size={20} />
        </Button>
      </div>

      {/* Everything in the middle scrolls, so the actions below never scroll away. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {held.length > 0 && (
        <ul className="mt-3 max-h-64 overflow-y-auto px-2">
          {held.slice(0, 24).map((item) => (
            <li key={item.id}>
              <Link
                href={`/item/${item.id}`}
                className="flex min-h-14 items-center gap-3 rounded-md px-2 text-body text-ink hover:bg-surface-2"
              >
                <ItemPhoto photoId={item.photoId} name={item.name} size={40} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.slot && (
                  <span className="truncate text-caption text-quiet">{item.slot}</span>
                )}
                <ChevronRight size={18} className="shrink-0 text-quiet" />
              </Link>
            </li>
          ))}
          {held.length > 24 && (
            <li className="px-3 py-2 text-caption text-quiet">and {held.length - 24} more</li>
          )}
        </ul>
      )}

      {children.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-caption uppercase tracking-wide text-quiet">Inside</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {children.slice(0, 12).map((child) => (
              <li
                key={child.id}
                className="rounded-sm bg-surface-2 px-2 py-1 text-caption text-ink-quiet"
              >
                {child.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {links.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-caption uppercase tracking-wide text-quiet">Leads to</p>
          <ul className="mt-1 space-y-0.5">
            {links.slice(0, 6).map((edge) => {
              const otherId = edge.from === node.id ? edge.to : edge.from;
              const other = index.get(otherId);
              if (!other) return null;
              return (
                <li key={edge.id} className="text-body text-ink-quiet">
                  {other.name} <span className="text-caption text-quiet">({edge.distance} m)</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {held.length === 0 && children.length === 0 && (
        <p className="px-4 pt-3 text-body text-quiet">Nothing recorded here yet.</p>
      )}
      </div>

      {actions && (
        <div className="shrink-0">
          <div className="px-4 pt-3">
            <Rule />
          </div>
          <div className="flex flex-wrap gap-2 px-4 pt-3">{actions}</div>
        </div>
      )}
    </motion.div>
  );
}
