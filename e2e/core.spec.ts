import { expect, test } from "@playwright/test";
import { bootWithDemo } from "./helpers";

test("first run offers a space, and a demo loads with items", async ({ page }) => {
  await bootWithDemo(page);

  // 90 seeded items, straight from IndexedDB.
  const count = await page.evaluate(async () => {
    const open = indexedDB.open("locus");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction("items", "readonly");
    const request = tx.objectStore("items").count();
    return await new Promise<number>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  });
  expect(count).toBeGreaterThanOrEqual(60);
});

test("the home screen is calm: one field, two thumb-zone targets", async ({ page }) => {
  await bootWithDemo(page);
  const field = page.getByPlaceholder("Where is…");
  await expect(field).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();

  // Both thumb targets are at least 56px on the small viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Scan", "Add"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(56);
    expect(box!.height).toBeGreaterThanOrEqual(56);
    expect(box!.y).toBeGreaterThan(844 * 0.6); // bottom third
  }
});

test("offline: the app shell still opens with data in IndexedDB", async ({ page, context }) => {
  await bootWithDemo(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByPlaceholder("Where is…")).toBeVisible();
  await context.setOffline(false);
});

test("find any item in two taps and read the three-line answer", async ({ page }) => {
  await bootWithDemo(page);

  await page.getByPlaceholder("Where is…").fill("chopped tomatoes");
  const first = page.getByRole("link", { name: /Chopped tomatoes/ }).first();
  await expect(first).toBeVisible();
  await first.click();

  // The answer: the item, then its location as stacked lines.
  await expect(page.getByRole("heading", { name: "Chopped tomatoes" })).toBeVisible();
  await expect(page.getByText("Aisle 1 Grocery", { exact: true })).toBeVisible();
  await expect(page.getByText("Shelf 2 left", { exact: true })).toBeVisible();
  await expect(page.getByText("Level 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guide me" })).toBeVisible();
});

test("a synonym query still finds the thing", async ({ page }) => {
  await bootWithDemo(page);
  await page.getByPlaceholder("Where is…").fill("crisps");
  await expect(page.getByRole("link", { name: /Salted crisps/ }).first()).toBeVisible();
});

test("no match says so quietly", async ({ page }) => {
  await bootWithDemo(page);
  await page.getByPlaceholder("Where is…").fill("zzzqqq");
  await expect(page.getByText("Not found.")).toBeVisible();
});

test("guide me: one step per screen, and the place last", async ({ page }) => {
  await bootWithDemo(page);
  await page.getByPlaceholder("Where is…").fill("chopped tomatoes");
  await page.getByRole("link", { name: /Chopped tomatoes/ }).first().click();
  await page.getByRole("button", { name: "Guide me" }).click();

  // The first screen says where to set off from, in words a person can use.
  await expect(page.getByText(/^Start at /)).toBeVisible();
  // Never a bearing and never a metre count in an instruction.
  await expect(page.locator("main")).not.toContainText(/\d+\s*(m|metres|meters)/i);

  // One step at a time: the dots are this part of the route only.
  const dots = page.getByLabel("Progress").getByRole("button");
  await expect(dots.first()).toHaveAttribute("aria-current", "true");
  const chunkSize = await dots.count();
  expect(chunkSize).toBeGreaterThanOrEqual(1);
  expect(chunkSize).toBeLessThanOrEqual(4);

  // Walking to the end shows the place, the slot, and the item itself.
  for (let tap = 0; tap < 12; tap++) {
    const next = page.getByRole("button", { name: /^Next$/ });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  await expect(page.getByText("Chopped tomatoes", { exact: true })).toBeVisible();
  await expect(page.getByText("Shelf 2 left, Level 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show me" })).toBeVisible();
});

test("a route with a turn names the place to turn at", async ({ page }) => {
  await bootWithDemo(page);
  // Plasters live in the first aid drawer, reached by turning off the front
  // cross aisle.
  await page.goto("/");
  await page.getByPlaceholder("Where is…").fill("plasters");
  await page.getByRole("link", { name: /Plasters/ }).first().click();
  await page.getByRole("button", { name: "Guide me" }).click();

  // The route says where to turn, and never says by how many degrees.
  await expect(page.getByRole("button", { name: /Turn left\.$/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Turn left\.$/ }).first().click();
  await expect(page.getByRole("img", { name: "Turn left" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/\d+°/);
});
