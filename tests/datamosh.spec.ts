import { expect, test, type Page } from "@playwright/test";

const firstTile = (page: Page) => page.locator('[data-cursor="project"]:visible').first();
const idle = (page: Page) => expect(page.locator("html")).not.toHaveAttribute("data-datamosh", "active", { timeout: 5000 });
async function prepare(page: Page) {
  await page.goto("/work");
  await firstTile(page).hover();
  // Intent loads the engine/shaders; first-time module compilation is dev-only.
  await page.waitForTimeout(900);
}

test("archive → project → project resolves, focuses, and pushes exactly once", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.text().startsWith("[Datamosh]")) errors.push(m.text()); });
  await prepare(page);
  const initial = await page.evaluate(() => history.length);
  await firstTile(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-datamosh", "active");
  await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
  await idle(page);
  await expect(page.getByRole("heading", { name: "Signal Atlas", exact: true })).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);
  const next = page.locator('a[rel="next"]:visible');
  const href = await next.getAttribute("href");
  await next.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await idle(page);
  expect(await page.evaluate(() => history.length)).toBe(initial + 2);
  expect(errors).toEqual([]);
});

test("reduced motion and modified clicks preserve native navigation", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page);
  const popup = context.waitForEvent("page");
  await firstTile(page).click({ modifiers: ["ControlOrMeta"] });
  const other = await popup;
  await expect(page).toHaveURL(/\/work$/);
  await other.close();
  await firstTile(page).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
  await idle(page);
});

test("resize, Escape, context loss and rapid clicks release the overlay", async ({ page }) => {
  await prepare(page);
  await firstTile(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-datamosh", "active");
  await page.setViewportSize({ width: 1100, height: 800 });
  await idle(page);
  await page.goto("/work");
  await firstTile(page).hover(); await page.waitForTimeout(300);
  await firstTile(page).click();
  await page.keyboard.press("Escape");
  await idle(page);
  await page.goto("/work");
  await firstTile(page).hover(); await page.waitForTimeout(300);
  const initial = await page.evaluate(() => history.length);
  await firstTile(page).dblclick({ delay: 20 });
  await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
  await idle(page);
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);
  const next = page.locator('a[rel="next"]:visible');
  await next.click();
  await page.evaluate(() => {
    const overlay = document.querySelector<HTMLCanvasElement>('[data-active="true"] canvas');
    overlay?.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await idle(page);
});

test("browser back restores archive scroll", async ({ page }) => {
  await prepare(page);
  const tile = page.locator('[data-cursor="project"]:visible').nth(10);
  await tile.scrollIntoViewIfNeeded(); await tile.hover();
  const y = await page.evaluate(() => scrollY);
  await tile.click();
  await expect(page).toHaveURL(/\/work\/mock-radio-field$/);
  await idle(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/work$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, -1);
});

test("no WebGL remains usable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await prepare(page);
  await firstTile(page).click();
  await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
  await idle(page);
  await expect(page.getByRole("heading", { name: "Signal Atlas", exact: true })).toBeVisible();
});

test("a delayed route cannot hold the overlay past its deadline", async ({ page }) => {
  await prepare(page);
  // Warm engine first, then keep navigation data pending beyond the deadline.
  await page.route("**/work/mock-signal-atlas*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2800));
    await route.continue();
  });
  await firstTile(page).click();
  await idle(page);
  await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Signal Atlas", exact: true })).toBeVisible();
});

test("debug menu tunes actual route transitions and persists across pages", async ({ page }) => {
  await prepare(page);
  const menu = page.locator('[data-datamosh-debug]');
  await menu.locator('summary').click();
  const trail = menu.getByRole('slider', { name: 'Trail distance' });
  await trail.focus(); await trail.press('End'); await trail.press('ArrowLeft');
  await expect(trail).toHaveValue('69');
  await expect(menu.getByLabel('Datamosh preset')).toHaveValue('custom');
  await menu.getByLabel('Datamosh buffer view').selectOption('previous');
  await firstTile(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-datamosh', 'active');
  // The debug panel remains usable over the transition while other clicks are guarded.
  await menu.getByLabel('Datamosh buffer view').selectOption('output');
  await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
  await idle(page);
  await expect(trail).toHaveValue('69');
  await menu.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(trail).toHaveValue('44');
  await expect(menu.getByLabel('Datamosh preset')).toHaveValue('signal');
  await menu.getByLabel('Transitions enabled').uncheck();
  await menu.locator('summary').click();
  await page.locator('a[rel="next"]:visible').click();
  await expect(page).toHaveURL(/\/work\/mock-field-notes$/);
  await idle(page);
});
