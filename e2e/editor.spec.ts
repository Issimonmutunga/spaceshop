import { expect, test, type Page } from "@playwright/test";
import { bootWithDemo } from "./helpers";

/** Reads a store straight out of IndexedDB, so we assert on what persisted. */
async function rows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(async (name) => {
    const open = indexedDB.open("locus");
    const database = await new Promise<IDBDatabase>((resolve) => {
      open.onsuccess = () => resolve(open.result);
    });
    return await new Promise<unknown[]>((resolve) => {
      const request = database.transaction(name, "readonly").objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }, store) as Promise<T[]>;
}

type StoredNode = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  w?: number;
  h?: number;
};
type StoredEdge = { from: string; to: string; distance: number; bearing?: number };

const canvasBox = async (page: Page) =>
  (await page.getByRole("application", { name: /Map of the space/ }).boundingBox())!;

/**
 * The editor is only tappable once its own canvas is on screen. After a
 * client-side navigation the old page's canvas is still up for a moment, so
 * wait for the tools to appear rather than tapping a map that is going away.
 */
async function editorReady(page: Page) {
  await expect(page.getByRole("navigation", { name: "Map tools" })).toBeVisible();
}

async function tapMap(page: Page, fx: number, fy: number) {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function dragMap(page: Page, from: [number, number], to: [number, number]) {
  const box = await canvasBox(page);
  const start = { x: box.x + box.width * from[0], y: box.y + box.height * from[1] };
  const end = { x: box.x + box.width * to[0], y: box.y + box.height * to[1] };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

const saveAs = async (page: Page, name: string) => {
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: /^New / })).toHaveCount(0);
};

test('"Add a place here" puts the new place in that room', async ({ page }) => {
  await bootWithDemo(page);
  await page.getByRole("button", { name: "Map" }).click();

// Tap a room on the map, then ask for a place inside it. Exact: there is also
// a "Bakery junction" point, and a point cannot hold places.
const bakery = page
  .getByRole("application", { name: /Map of the space/ })
  .getByText("Bakery", { exact: true });
const spot = (await bakery.boundingBox())!;
await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2);
await expect(page.getByRole("dialog", { name: "Bakery", exact: true })).toBeVisible();
await page.getByRole("button", { name: "Add a place here" }).click();

await editorReady(page);
await tapMap(page, 0.5, 0.55);
  await expect(page.getByRole("heading", { name: "New place" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue(/^Place \d+$/);
  await saveAs(page, "Spare shelf");

  await expect
    .poll(async () => (await rows<StoredNode>(page, "nodes")).find((n) => n.name === "Spare shelf"))
    .toBeTruthy();
  const nodes = await rows<StoredNode>(page, "nodes");
  const bakeryNode = nodes.find((n) => n.name === "Bakery")!;
  const shelf = nodes.find((n) => n.name === "Spare shelf")!;
  expect(shelf.kind).toBe("place");
  expect(shelf.parentId).toBe(bakeryNode.id);
});

test("draw an area by dragging, and measure it", async ({ page }) => {
  await bootWithDemo(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "Area", exact: true }).click();

  await dragMap(page, [0.2, 0.2], [0.5, 0.45]);
  await expect(page.getByRole("heading", { name: "New area" })).toBeVisible();
  await saveAs(page, "Loading bay");

  await expect(
    page.getByRole("application", { name: /Map of the space/ }).getByText("Loading bay"),
  ).toBeVisible();

  await expect
    .poll(async () => (await rows<StoredNode>(page, "nodes")).find((n) => n.name === "Loading bay"))
    .toBeTruthy();
  const zone = (await rows<StoredNode>(page, "nodes")).find((n) => n.name === "Loading bay")!;
  expect(zone.w).toBeGreaterThan(1);
  expect(zone.h).toBeGreaterThan(1);
});

test("stand somewhere, then place what you see relative to it", async ({ page }) => {
  await bootWithDemo(page);
  await page.goto("/edit");

  await page.getByRole("button", { name: "Stand", exact: true }).click();
  await tapMap(page, 0.35, 0.6);
  await expect(page.getByRole("heading", { name: "New point" })).toBeVisible();
  await saveAs(page, "Stood at 1");

  // The next tool is Place, and the caption says what the bearing is measured from.
  await expect(page.getByText("Measured from Stood at 1")).toBeVisible();
  await tapMap(page, 0.6, 0.4);
  await expect(page.getByRole("heading", { name: "New place" })).toBeVisible();
  await saveAs(page, "Milk crate");

  const found = async () => {
    const nodes = await rows<StoredNode>(page, "nodes");
    const edges = await rows<StoredEdge>(page, "edges");
    const stood = nodes.find((n) => n.name === "Stood at 1");
    const crate = nodes.find((n) => n.name === "Milk crate");
    if (!stood || !crate) return [];
    return edges.filter((edge) => edge.from === stood.id && edge.to === crate.id);
  };

  await expect.poll(found).toHaveLength(1);
  const [edge] = await found();
  expect(edge.distance).toBeGreaterThan(0);
  expect(edge.bearing).toBeGreaterThanOrEqual(0);
  expect(edge.bearing).toBeLessThan(360);
});

test("link two nodes and set the distance by hand", async ({ page }) => {
  await bootWithDemo(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "Link", exact: true }).click();

  // Link two seeded places, by name: the map labels them, points it does not.
  const canvas = page.getByRole("application", { name: /Map of the space/ });
  const first = canvas.getByText("Pastry case", { exact: true });
  const firstSpot = (await first.boundingBox())!;
  await page.mouse.click(firstSpot.x + firstSpot.width / 2, firstSpot.y + firstSpot.height / 2);
  await expect(page.getByText("Now tap the other end")).toBeVisible();

  const before = (await rows<StoredEdge>(page, "edges")).length;
  const second = canvas.getByText("Bread rack", { exact: true });
  const secondSpot = (await second.boundingBox())!;
  await page.mouse.click(
    secondSpot.x + secondSpot.width / 2,
    secondSpot.y + secondSpot.height / 2,
  );

  // The dial opens so a measured number can replace the drawn one.
  await expect(page.getByRole("slider", { name: "Bearing" })).toBeVisible();
  await page.getByLabel("Distance (m)").fill("7.5");
  await page.getByRole("button", { name: "Put it there" }).click();

  await expect.poll(async () => (await rows<StoredEdge>(page, "edges")).length).toBeGreaterThan(
    before,
  );
});

test("visitors cannot edit the map", async ({ page }) => {
  await bootWithDemo(page);
  await page.goto("/edit");
  // The role is UI state, so set it the way the settings screen would.
  await page.evaluate(() => {
    window.localStorage.setItem(
      "locus-ui",
      JSON.stringify({ state: { role: "visitor", hasChosenRole: true }, version: 0 }),
    );
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Editing is for managers." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Map tools" })).toHaveCount(0);
});
