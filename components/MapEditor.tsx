"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, Save, Trash2 } from "lucide-react";
import {
  connect,
  createNode,
  db,
  disconnect,
  latestSpace,
  remeasureEdges,
  softDeleteNode,
  updateEdge,
  updateNode,
} from "@/lib/db";
import {
  canConnect,
  edgeMeasures,
  nextName,
  parentFor,
  problems,
  rectFromDrag,
  snap,
  type Point,
} from "@/lib/draft";
import { advance, normalizeBearing, PLACE_SIZE } from "@/lib/geometry";
import type { Edge, ID, Node, NodeKind } from "@/lib/types";
import BearingDial from "@/components/BearingDial";
import MapCanvas, { type DrawHandlers } from "@/components/MapCanvas";
import { Button } from "@/components/ui";

type Mode = "move" | "place" | "zone" | "connect" | "stand";

const TOOLS: Array<{ mode: Mode; label: string; hint: string }> = [
  { mode: "move", label: "Move", hint: "Drag a node to put it somewhere else" },
  { mode: "place", label: "Place", hint: "Tap where the thing sits" },
  { mode: "zone", label: "Area", hint: "Drag out a room or a wall" },
  { mode: "connect", label: "Link", hint: "Tap two nodes to join them" },
  { mode: "stand", label: "Stand", hint: "Tap where you stand, then what you see" },
];

/** A node being drawn but not yet saved. */
interface Draft {
  kind: NodeKind;
  name: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  parentId: ID | null;
  landmark?: boolean;
  /** the standing mark a new node was measured from, if any */
  from?: ID;
}

/**
 * /edit — drawing the map. Five tools on the left edge, one form at the
 * bottom, and nothing is saved until you say so. Staff can edit; visitors
 * cannot see this screen at all (see the Can gate on the route).
 */
export default function MapEditor({
  focusId = null,
  newKind = null,
  insideId = null,
}: {
  focusId?: ID | null;
  newKind?: NodeKind | null;
  /** the node a new place must belong to: "Add a place here" */
  insideId?: ID | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(newKind === "zone" ? "zone" : newKind === "place" ? "place" : "move");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [moving, setMoving] = useState<{ id: ID; x: number; y: number } | null>(null);
  const [connectFrom, setConnectFrom] = useState<ID | null>(null);
  const [editingId, setEditingId] = useState<ID | null>(focusId);
  const [link, setLink] = useState<{ from: ID; to: ID } | null>(null);
  /** where the surveyor is standing: the origin for the next few nodes */
  const [standingId, setStandingId] = useState<ID | null>(null);
  const [zoneStart, setZoneStart] = useState<Point | null>(null);
  const [ghost, setGhost] = useState<string | null>(null);

  const space = useLiveQuery(() => latestSpace(), [], undefined);
  const spaceId = space?.id;
  const nodes = useLiveQuery(
    () =>
      spaceId
        ? db.nodes
            .where("spaceId")
            .equals(spaceId)
            .filter((n) => !n.deleted)
            .toArray()
        : [],
    [spaceId],
    [],
  );
  const edges = useLiveQuery(
    () =>
      spaceId
        ? db.edges
            .where("spaceId")
            .equals(spaceId)
            .filter((e) => !e.deleted)
            .toArray()
        : [],
    [spaceId],
    [],
  );
  const items = useLiveQuery(
    () =>
      spaceId
        ? db.items
            .where("spaceId")
            .equals(spaceId)
            .filter((i) => !i.deleted)
            .toArray()
        : [],
    [spaceId],
    [],
  );

  const index = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const shown = useMemo(
    () =>
      moving
        ? nodes.map((n) => (n.id === moving.id ? { ...n, x: moving.x, y: moving.y } : n))
        : nodes,
    [nodes, moving],
  );
  const editing = editingId ? index.get(editingId) : undefined;

  /** The mark a new place is measured from, if you are standing somewhere. */
  const standingMark = standingId ? index.get(standingId) : undefined;

  const onStart = useCallback(
    (world: Point, hit: Node | undefined) => {
      if (mode === "move") {
        if (hit) setMoving({ id: hit.id, x: hit.x, y: hit.y });
        else setEditingId(null);
        return;
      }
      if (mode === "connect") {
        if (!hit) return;
        if (!connectFrom) {
          setConnectFrom(hit.id);
          return;
        }
        if (!canConnect(index.get(connectFrom), hit)) return;
        void connect(spaceId ?? "", connectFrom, hit.id).then((edge) => {
          if (edge) setLink({ from: edge.from, to: edge.to });
        });
        setConnectFrom(null);
        return;
      }
      if (mode === "zone") {
        setZoneStart(world);
        return;
      }
      if (mode === "place" || mode === "stand") {
        const kind: NodeKind = mode === "stand" ? "point" : "place";
        setDraft({
          kind,
          name: nextName(kind, nodes, mode === "stand" ? "Stood at" : ""),
          x: snap(world.x),
          y: snap(world.y),
          // "Add a place here" means in this room, whatever the tap lands on.
          parentId: insideId ?? parentFor(nodes, kind, world),
          ...(kind === "place" ? PLACE_SIZE : {}),
          landmark: mode === "stand",
          from: mode === "place" ? standingMark?.id : undefined,
        });
      }
    },
    [connectFrom, index, insideId, mode, nodes, spaceId, standingMark],
  );

  const onMove = useCallback(
    (world: Point) => {
      if (mode === "move" && moving) {
        setMoving({ ...moving, x: snap(world.x), y: snap(world.y) });
        return;
      }
      if (mode === "zone" && zoneStart) {
        const rect = rectFromDrag(zoneStart, world);
        setGhost(`${rect.w.toFixed(1)} by ${rect.h.toFixed(1)} m`);
      }
    },
    [mode, moving, zoneStart],
  );

  const onEnd = useCallback(
    async (world: Point) => {
      if (mode === "move" && moving) {
        await updateNode(moving.id, { x: moving.x, y: moving.y });
        if (spaceId) await remeasureEdges(spaceId, [moving.id]);
        setMoving(null);
        return;
      }
      if (mode === "zone") {
        // A tap is a speck, a drag is a room. Either way the size is real.
        const from = zoneStart ?? world;
        setDraft({
          kind: "zone",
          name: nextName("zone", nodes),
          ...rectFromDrag(from, world),
          parentId: null,
        });
        setZoneStart(null);
        setGhost(null);
      }
    },
    [mode, moving, nodes, spaceId, zoneStart],
  );

  const draw: DrawHandlers = { start: onStart, move: onMove, end: onEnd };
  const tool = TOOLS.find((entry) => entry.mode === mode)!;

  return (
    <div className="fixed inset-0 bg-paper">
      <MapCanvas
        className="absolute inset-0"
        height="100%"
        nodes={shown}
        edges={edges}
        items={items}
        draw={draw}
        selectedId={moving?.id ?? connectFrom ?? editingId}
        fitKey={spaceId ?? ""}
        overlay={
          draft ? (
            <Caption text={sizeText(draft)} />
          ) : ghost ? (
            <Caption text={ghost} />
          ) : standingMark && mode === "place" ? (
            <Caption text={`Measured from ${standingMark.name}`} />
          ) : null
        }
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button
          size="sm"
          className="pointer-events-auto"
          onClick={() => router.push("/map")}
        >
          <ChevronLeft size={20} />
          Map
        </Button>
        <p className="frosted max-w-52 rounded-md px-3 py-2 text-right text-caption text-ink-quiet">
          {tool.hint}
        </p>
      </header>

      <nav
        aria-label="Map tools"
        className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-2"
      >
        {TOOLS.map((entry) => (
          <button
            key={entry.mode}
            type="button"
            aria-pressed={mode === entry.mode}
            onClick={() => {
              setMode(entry.mode);
              setDraft(null);
              setConnectFrom(null);
              setLink(null);
            }}
            className={`pointer-events-auto flex size-14 items-center justify-center rounded-full text-caption shadow-sheet transition-transform active:scale-95 ${
              mode === entry.mode ? "bg-accent text-white" : "bg-surface/90 text-ink"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {connectFrom && mode === "connect" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-accent px-4 py-2 text-caption text-white">
          Now tap the other end
        </p>
      )}

      {draft && (
        <DraftSheet
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={async () => {
            const { name, kind, x, y, w, h, parentId, landmark, from } = draft;
            const created = await createNode(spaceId ?? "", {
              kind,
              name: name.trim(),
              x,
              y,
              w,
              h,
              parentId,
              landmark,
            });
            if (from) await connect(spaceId ?? "", from, created.id);
            setDraft(null);
            setConnectFrom(null);
            // Standing somewhere turns the next taps into bearings from here.
            if (kind === "point" && landmark) {
              setStandingId(created.id);
              setMode("place");
            }
          }}
        />
      )}

      {editing && !draft && !link && (
        <NodeForm
          node={editing}
          onClose={() => setEditingId(null)}
          onRename={async (name) => updateNode(editing.id, { name })}
          onLandmark={async () =>
            updateNode(editing.id, { landmark: !editing.landmark })
          }
          onRemove={async () => {
            await softDeleteNode(editing.id);
            setEditingId(null);
          }}
          onConnect={() => {
            setMode("connect");
            setConnectFrom(editing.id);
            setEditingId(null);
          }}
        />
      )}

      {link && (
        <LinkSheet
          edge={edges.find((edge) => edge.from === link.from && edge.to === link.to)}
          from={index.get(link.from)}
          to={index.get(link.to)}
          onClose={() => setLink(null)}
          onSave={async (bearing, meters) => {
            const from = index.get(link.from);
            if (!from) return;
            const spot = advance(from, bearing, meters);
            await updateNode(link.to, { x: spot.x, y: spot.y });
            // The dial is the survey: store what it says, not a re-guess.
            const edge = edges.find((one) => one.from === link.from && one.to === link.to);
            if (edge) await updateEdge(edge.id, { distance: meters, bearing: normalizeBearing(bearing) });
            setLink(null);
          }}
          onUnlink={async (edge) => {
            await disconnect(edge.id);
            setLink(null);
          }}
        />
      )}
    </div>
  );
}

const sizeText = (draft: Draft) =>
  draft.kind === "zone"
    ? `${draft.w?.toFixed(1)} by ${draft.h?.toFixed(1)} m`
    : draft.kind === "place"
      ? "0.8 by 0.6 m"
      : "Point";

/** One quiet line about what a gesture is doing. */
function Caption({ text }: { text: string }) {
  return (
    <p className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-surface/95 px-4 py-2 text-caption text-ink shadow-sheet">
      {text}
    </p>
  );
}

function DraftSheet({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const found = problems(draft);
  return (
    <Sheet title={draft.kind === "zone" ? "New area" : draft.kind === "point" ? "New point" : "New place"}>
      <label className="block">
        <span className="text-caption uppercase tracking-wide text-quiet">Name</span>
        <input
          autoFocus
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          className="mt-1 h-14 w-full rounded-md bg-surface px-3 text-body text-ink"
        />
      </label>

      {draft.kind === "zone" && (
        <p className="text-body text-ink-quiet">
          {draft.w?.toFixed(1)} by {draft.h?.toFixed(1)} m
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button tone="primary" onClick={onSave} disabled={found.length > 0}>
          <Save size={20} />
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {found.map((problem) => (
        <p key={problem.field} className="text-caption text-accent">
          {problem.message}
        </p>
      ))}
    </Sheet>
  );
}

function NodeForm({
  node,
  onClose,
  onRename,
  onLandmark,
  onRemove,
  onConnect,
}: {
  node: Node;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
  onLandmark: () => Promise<void>;
  onRemove: () => Promise<void>;
  onConnect: () => void;
}) {
  const [name, setName] = useState(node.name);
  const held = useLiveQuery(
    () => db.items.where("placeId").equals(node.id).filter((i) => !i.deleted).toArray(),
    [node.id],
    [],
  );
  return (
    <Sheet title={node.kind === "zone" ? "Area" : node.kind === "point" ? "Point" : "Place"}>
      <label className="block">
        <span className="text-caption uppercase tracking-wide text-quiet">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name.trim() && name !== node.name) void onRename(name.trim());
          }}
          className="mt-1 h-14 w-full rounded-md bg-surface px-3 text-body text-ink"
        />
      </label>
      <p className="text-body text-ink-quiet">
        {node.kind === "zone"
          ? `${(node.w ?? 0).toFixed(1)} by ${(node.h ?? 0).toFixed(1)} m`
          : node.kind === "point"
            ? "A landmark on the map"
            : held.length
              ? `${held.length} ${held.length === 1 ? "thing" : "things"} here`
              : "Nothing here yet"}
      </p>
      <div className="flex flex-wrap gap-2">
        {node.kind === "point" && (
          <Button onClick={onLandmark}>{node.landmark ? "Not a landmark" : "Use in directions"}</Button>
        )}
        <Button onClick={onConnect}>Link to</Button>
        <Button onClick={onRemove} aria-label="Remove">
          <Trash2 size={20} />
        </Button>
        <Button tone="bare" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}

function LinkSheet({
  edge,
  from,
  to,
  onClose,
  onSave,
  onUnlink,
}: {
  edge?: Edge;
  from?: Node;
  to?: Node;
  onClose: () => void;
  onSave: (bearing: number, meters: number) => Promise<void>;
  onUnlink: (edge: Edge) => Promise<void>;
}) {
  const measured = from && to ? edgeMeasures(from, to) : { distance: 1, bearing: 0 };
  const [bearing, setBearing] = useState(measured.bearing);
  const [meters, setMeters] = useState(edge?.distance ?? measured.distance);
  return (
    <Sheet
      title="Link"
      subtitle={from && to ? `${from.name} to ${to.name}` : undefined}
    >
      <p className="text-body text-ink-quiet">
        Measured off the map. Change it if you measured it by hand.
      </p>
      <BearingDial
        bearing={normalizeBearing(bearing)}
        meters={meters}
        onBearing={setBearing}
        onMeters={setMeters}
      />
      <div className="flex flex-wrap gap-2">
        <Button tone="primary" onClick={() => onSave(bearing, meters)}>
          <Save size={20} />
          Put it there
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        {edge && (
          <Button tone="bare" onClick={() => void onUnlink(edge)} aria-label="Unlink">
            <Trash2 size={20} />
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Sheet({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-2xl bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-sheet backdrop-blur-xl">
      <div>
        <h2 className="text-title text-ink">{title}</h2>
        {subtitle && <p className="text-body text-ink-quiet">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
