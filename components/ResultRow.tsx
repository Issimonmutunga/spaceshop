"use client";

import Link from "next/link";
import { byId, whereLine, whereIs } from "@/lib/labels";
import type { ID, Item, Node } from "@/lib/types";
import ItemPhoto from "./ItemPhoto";

/**
 * One result: a photo, a name, one line of location. Recognition over recall,
 * so the photo comes first and the text is quiet.
 */
export default function ResultRow({
  item,
  nodes,
  index,
}: {
  item: Item;
  nodes: Node[];
  index?: Map<ID, Node>;
}) {
  const where = whereIs(item, nodes, index);
  return (
    <li>
      <Link
        href={`/item/${item.id}`}
        className="flex items-center gap-4 rounded-md py-2 pr-2 transition-colors duration-200 active:bg-surface/70"
      >
        <ItemPhoto photoId={item.photoId} name={item.name} size={64} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-balance">
            {item.name}
          </span>
          <span className="block truncate text-caption text-ink-quiet">
            {whereLine(where)}
          </span>
        </span>
        {item.qty && item.qty > 1 ? (
          <span className="tabular shrink-0 text-caption text-ink-quiet">
            ×{item.qty}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export { byId };
