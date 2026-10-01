import { expect, type Page } from "@playwright/test";

/** First run -> load demo -> supermarket. Waits until the data is really in. */
export async function bootWithDemo(page: Page, space = "Supermarket") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set up a space." })).toBeVisible();
  await page.getByRole("button", { name: "Load demo" }).click();
  await page.getByRole("button", { name: space }).click();
  await expect(page.getByPlaceholder("Where is…")).toBeVisible();
}
