export type ID = string; // nanoid

export type NodeKind = "zone" | "place" | "point";

/** Space → Zone → Place → Item. A tree from day one, so `parentId` can widen later. */
export interface Node {
  id: ID;
  spaceId: ID;
  kind: NodeKind;
  parentId: ID | null;
  name: string;
  /** meters, canvas coordinates */
  x: number;
  y: number;
  /** footprint in meters */
  w?: number;
  h?: number;
  /** degrees, 0 = canvas up */
  rotation?: number;
  /** distinctive node used in directions */
  landmark?: boolean;
  /** short code printed on the label */
  qr: string;
  createdAt: number;
  updatedAt: number;
  deleted?: 1;
}

/** Walkable connection between nodes. */
export interface Edge {
  id: ID;
  spaceId: ID;
  from: ID;
  to: ID;
  /** meters (computed or user-entered) */
  distance: number;
  /** degrees clockwise from canvas up */
  bearing?: number;
  createdAt: number;
  updatedAt: number;
  deleted?: 1;
}

export interface Item {
  id: ID;
  spaceId: ID;
  /** node of kind 'place' */
  placeId: ID;
  /** "Level 3", "Left compartment" */
  slot?: string;
  name: string;
  tags: string[];
  qty?: number;
  photoId?: ID;
  createdAt: number;
  updatedAt: number;
  deleted?: 1;
}

/** Append-only log: add | move | remove | edit. */
export interface Event {
  id: ID;
  spaceId: ID;
  itemId: ID;
  type: "add" | "move" | "remove" | "edit";
  from?: ID;
  to?: ID;
  at: number;
}

export interface Space {
  id: ID;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id: "default";
  role: "manager" | "staff" | "visitor";
  units: "m" | "ft";
  theme: "auto" | "light" | "dark";
}

/** Image records: Blobs stay in IndexedDB, never through the server. */
export interface Photo {
  id: ID;
  spaceId: ID;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export type SeedNode = {
  /** stable key inside the seed file, resolved to a real id at load time */
  key: string;
  kind: NodeKind;
  name: string;
  x: number;
  y: number;
  parentId?: string | null;
  w?: number;
  h?: number;
  rotation?: number;
  landmark?: boolean;
};

export type SeedFile = {
  space: { name: string };
  nodes: SeedNode[];
  edges: Array<{ from: string; to: string }>;
  items: Array<{
    /** key of the place node */
    place: string;
    name: string;
    tags?: string[];
    slot?: string;
    qty?: number;
  }>;
};

export type Snapshot = {
  format: "locus-space";
  version: 1;
  exportedAt: number;
  space: Space;
  nodes: Node[];
  edges: Edge[];
  items: Item[];
};
