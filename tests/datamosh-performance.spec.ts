import { expect, test } from "@playwright/test";
import { chooseTransitionPerformance, transitionSize, TransitionFrameBudget } from "../src/components/transitions/performance";

test("mobile surfaces stay bounded, including low-memory phones and tablets", () => {
  const phone = chooseTransitionPerformance(true, 8, 8);
  expect(transitionSize(phone, 390, 844)).toEqual({ width: 156, height: 338 });
  const lowEnd = chooseTransitionPerformance(true, 4, 4);
  const tablet = transitionSize(lowEnd, 1366, 1024);
  expect(Math.max(tablet.width, tablet.height)).toBeLessThanOrEqual(480);
  expect(lowEnd.maxWords).toBeLessThan(chooseTransitionPerformance(false).maxWords);
});

test("isolated spikes recover; sustained overload reduces detail then uses the live-page dissolve", () => {
  const normal = new TransitionFrameBudget(30);
  for (let i = 0; i < 3; i++) normal.sample(33, 2);
  expect(normal.sample(100, 40)).toBeNull();
  for (let i = 0; i < 12; i++) expect(normal.sample(33, 2)).toBeNull();
  const actions: string[] = [];
  for (let i = 0; i < 20; i++) {
    const action = normal.sample(80, 30);
    if (action) actions.push(action);
  }
  expect(actions).toEqual(["reduce", "dissolve"]);
});

test.describe("mobile GPU budget", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test("throttled mobile navigation bounds passes and capture size and stops drawing when idle", async ({ page, context }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
      Object.defineProperty(navigator, "deviceMemory", { value: 8 });
      const stats = { draws: 0, linksDuringEffect: 0, started: 0, ended: 0, captures: [] as number[][] };
      Object.assign(window, { datamoshStats: stats });
      const originalLink = WebGL2RenderingContext.prototype.linkProgram;
      WebGL2RenderingContext.prototype.linkProgram = function (...args) {
        if (document.documentElement.dataset.datamosh === "active") stats.linksDuringEffect++;
        return originalLink.apply(this, args);
      };
      const originalDraw = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if ((this.canvas as HTMLCanvasElement).closest?.('[data-active="true"]')) stats.draws++;
        return originalDraw.apply(this, args);
      };
      const originalContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof originalContext>) {
        if (String(args[0]) === "2d" && !this.isConnected) stats.captures.push([this.width, this.height]);
        return originalContext.apply(this, args);
      } as typeof originalContext;
      window.addEventListener("oblast:transition", () => {
        if (document.documentElement.dataset.datamosh === "active") stats.started ||= performance.now();
        else if (stats.started) stats.ended = performance.now();
      });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/work");
    // Idle prewarm also works without hover on touch devices.
    await page.waitForTimeout(2200);
    await page.locator('[data-cursor="project"]:visible').first().tap();
    await expect(page.locator("html")).toHaveAttribute("data-datamosh", "active");
    const canvas = page.locator('[data-active="true"] canvas');
    await expect(canvas).toHaveAttribute("data-datamosh-fps", "30");
    expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).width)).toBeLessThanOrEqual(156);
    await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-datamosh", "active");
    const stats = await page.evaluate(() => (window as typeof window & { datamoshStats: { draws: number; linksDuringEffect: number; started: number; ended: number; captures: number[][] } }).datamoshStats);
    expect(stats.linksDuringEffect).toBe(0);
    expect(stats.captures.length).toBeGreaterThanOrEqual(2);
    for (const [width, height] of stats.captures) {
      expect(width).toBeLessThanOrEqual(156);
      expect(height).toBeLessThanOrEqual(338);
    }
    const seconds = (stats.ended - stats.started) / 1000;
    // Two passes per 30 Hz frame, with margin for seeding, a quality downsample
    // and the final transparent frame. The old 60/120 Hz display loop exceeds it.
    expect(stats.draws).toBeLessThanOrEqual(Math.ceil(seconds * 30) * 2 + 8);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => (window as typeof window & { datamoshStats: { draws: number } }).datamoshStats.draws)).toBe(stats.draws);
    await expect(page.getByRole("heading", { name: "Signal Atlas", exact: true })).toBeFocused();
  });
});

test.describe("mobile overload recovery", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("sustained slow GPU submission downsamples retained history and still reveals the destination", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.text().startsWith("[Datamosh]")) errors.push(message.text()); });
    await page.addInitScript(() => {
      Object.assign(window, { datamoshQualitySteps: [] as string[] });
      new MutationObserver((records) => {
        for (const record of records) {
          const quality = (record.target as HTMLCanvasElement).dataset.datamoshQuality;
          if (quality) (window as typeof window & { datamoshQualitySteps: string[] }).datamoshQualitySteps.push(quality);
        }
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-datamosh-quality"] });
      const draw = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if ((this.canvas as HTMLCanvasElement).closest?.('[data-active="true"]')) {
          // Deliberately overload this test renderer. Production never spins or
          // performs readbacks; this exercises real target resizing and cleanup.
          const deadline = performance.now() + 35;
          while (performance.now() < deadline) { /* Simulated slow submission. */ }
        }
        return draw.apply(this, args);
      };
    });
    await page.goto("/work");
    await page.waitForTimeout(2000);
    const menu = page.locator("[data-datamosh-debug]");
    await menu.locator("summary").click();
    await menu.getByRole("slider", { name: "Duration", exact: true }).press("End");
    await menu.locator("summary").click();
    await page.locator('[data-cursor="project"]:visible').first().tap();
    await expect(page).toHaveURL(/\/work\/mock-signal-atlas$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-datamosh", "active", { timeout: 5000 });
    const steps = await page.evaluate(() => (window as typeof window & { datamoshQualitySteps: string[] }).datamoshQualitySteps);
    expect(steps).toContain("reduced");
    expect(steps).toContain("dissolve");
    expect(errors).toEqual([]);
    await expect(page.getByRole("heading", { name: "Signal Atlas", exact: true })).toBeFocused();
  });
});
