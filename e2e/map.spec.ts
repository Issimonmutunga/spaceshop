import { expect, test } from "@playwright/test";
import { bootWithDemo } from "./helpers";

/**
 * The map: it must load, fit itself, pan under a drag, and open a sheet when
 * you tap a place. Driven through real pointer events, because that is how a
 * hand uses it.
 */
test("the map fits itself, pans, and opens a sheet for a tapped place", async ({ page }) => {
  await bootWithDemo(page);
  await page.getByRole("button", { name: "Map" }).click();

  const canvas = page.getByRole("application", { name: /Map of the space/ });
  await expect(canvas).toBeVisible();

  // Seeded places are drawn as named labels.
  await expect(canvas.getByText("Pastry case", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Aisle 1 Grocery", { exact: true })).toBeVisible();

  // A scale bar is present: the map is measurable, not decorative.
  await expect(page.getByText(/^\d+(\.\d+)? (m|cm)$/)).toBeVisible();

  // Drag pans the canvas: the view transform changes.
  const view = canvas.locator("g[transform]");
  const before = await view.getAttribute("transform");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2 - 40, { steps: 8 });
  await page.mouse.up();
  expect(await view.getAttribute("transform")).not.toBe(before);

  // Fit puts it back.
  await page.getByRole("button", { name: "Fit" }).click();
  expect(await view.getAttribute("transform")).toBe(before);

  // Tap a place: the sheet opens with what is inside.
  const label = canvas.getByText("Pastry case", { exact: true });
  const spot = (await label.boundingBox())!;
  await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2);
  const sheet = page.getByRole("dialog", { name: "Pastry case" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Butter croissant/ })).toBeVisible();

  // The sheet closes again.
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the answer's place link opens that place on the map", async ({ page }) => {
  await bootWithDemo(page);

  await page.getByPlaceholder("Where is…").fill("croissant");
  await page.getByRole("link", { name: /Butter croissant/i }).first().click();
  await page.getByRole("button", { name: "This place" }).click();

  await expect(page.getByRole("heading", { name: "Pastry case" })).toBeVisible();
  await expect(page.getByText(/things? here/)).toBeVisible();
  await expect(page.getByRole("application", { name: /Map of the space/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Almond tart/ })).toBeVisible();
});
