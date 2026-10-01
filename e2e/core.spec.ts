import { expect, test, type Page } from "@playwright/test";

/** The core flow: first run -> load demo -> find an item in two taps. */
async function bootWithDemo(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set up a space." })).toBeVisible();
  await page.getByRole("button", { name: "Load demo" }).click();
  await page.getByRole("button", { name: "Supermarket" }).click();
  await expect(page.getByPlaceholder("Where is…")).toBeVisible();
}

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
