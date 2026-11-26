import { getTransitionPerformance, transitionSize } from "./performance";

export type TransitionVisual = {
  image: HTMLCanvasElement;
  viewport: { width: number; height: number };
  origin: { x: number; y: number };
  dispose(): void;
};

// Tier A: media and a lightweight editorial composition, never a screenshot
// claim. No form values, cross-origin media, GPU readbacks or capture prompts.
export function captureViewport(selected?: Element | null, size?: { width: number; height: number }): TransitionVisual {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const profile = getTransitionPerformance();
  const dimensions = size ?? transitionSize(profile, width, height);
  const deadline = performance.now() + profile.captureMs;
  const image = document.createElement("canvas");
  image.width = dimensions.width;
  image.height = dimensions.height;
  const ctx = image.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No capture context");
  ctx.scale(image.width / width, image.height / height);
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
  ctx.fillRect(0, 0, width, height);
  const visible = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < height && r.right > 0 && r.left < width;
  const draw = (el: HTMLImageElement | HTMLVideoElement) => {
    const r = el.getBoundingClientRect();
    if (!visible(r)) return;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") return;
    const video = el instanceof HTMLVideoElement;
    const src = video ? el.currentSrc : el.currentSrc || el.src;
    if (!src || new URL(src, location.href).origin !== location.origin) return;
    const iw = video ? el.videoWidth : el.naturalWidth;
    const ih = video ? el.videoHeight : el.naturalHeight;
    if (!iw || !ih || (video && el.readyState < 2)) return;
    const fit = style.objectFit;
    const ratio = fit === "contain" ? Math.min(r.width / iw, r.height / ih) : Math.max(r.width / iw, r.height / ih);
    const dw = fit === "fill" ? r.width : iw * ratio;
    const dh = fit === "fill" ? r.height : ih * ratio;
    const positions = style.objectPosition.split(" ");
    const position = (value: string | undefined, leftover: number) => {
      if (value?.endsWith("%")) return leftover * parseFloat(value) / 100;
      if (value?.endsWith("px")) return parseFloat(value);
      return leftover / 2;
    };
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.width, r.height); ctx.clip();
    ctx.drawImage(el, r.x + position(positions[0], r.width - dw), r.y + position(positions[1], r.height - dh), dw, dh);
    ctx.restore();
  };
  for (const el of document.querySelectorAll<HTMLImageElement | HTMLVideoElement>("main img, main video")) {
    try { draw(el); } catch { /* Poster or background remains on unavailable media. */ }
  }
  // Paint the visible navigation backgrounds, then public text at its DOM
  // line positions. The incoming composition includes editorial content too,
  // so it can merge into the history instead of appearing only at handoff.
  for (const el of document.querySelectorAll<HTMLElement>("header nav a, header nav div[class*='Segment']")) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (!visible(r) || style.backgroundColor === "rgba(0, 0, 0, 0)") continue;
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
  const hidden = new WeakMap<Element, boolean>();
  const isHidden = (el: Element): boolean => {
    const cached = hidden.get(el);
    if (cached !== undefined) return cached;
    const style = getComputedStyle(el);
    const result = style.opacity === "0" || style.visibility === "hidden" || style.display === "none" ||
      Boolean(el.parentElement && el !== document.body && isHidden(el.parentElement));
    hidden.set(el, result);
    return result;
  };
  const range = document.createRange();
  let words = 0;
  const excluded = "[aria-hidden='true'], [data-datamosh-debug], input, textarea, select, button, script, style";
  captureText: for (const root of document.querySelectorAll("main, header nav")) {
    // Reject hidden cached routes and offscreen branches before walking their
    // text. Mobile capture must not measure every word in a long case study.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        const el = node as Element;
        if (el.namespaceURI !== "http://www.w3.org/1999/xhtml" || el.matches(excluded) || isHidden(el)) return NodeFilter.FILTER_REJECT;
        // display:contents wrappers have no rectangle but can contain visible
        // text; keep walking those while pruning genuinely offscreen branches.
        if (!visible(el.getBoundingClientRect()) && getComputedStyle(el).display !== "contents") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (words >= profile.maxWords || performance.now() > deadline) break captureText;
      const el = node.parentElement!;
      if (isHidden(el)) continue;
      const text = node.textContent ?? "";
      range.selectNodeContents(node);
      if (!visible(range.getBoundingClientRect())) continue;
      const style = getComputedStyle(el);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.fillStyle = style.color;
      ctx.textBaseline = "top";
      ctx.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      for (const match of text.matchAll(/\S+/g)) {
        if (words++ >= profile.maxWords || performance.now() > deadline) break captureText;
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const r = range.getBoundingClientRect();
        if (!visible(r)) continue;
        const word = style.textTransform === "uppercase" ? match[0].toUpperCase() :
          style.textTransform === "lowercase" ? match[0].toLowerCase() : match[0];
        ctx.fillText(word, r.x, r.y);
      }
    }
  }
  // Sources are same-origin. Do not force a synchronous GPU readback merely
  // to validate capture; a tainted upload is caught by the renderer fallback.
  const r = selected?.getBoundingClientRect();
  return {
    image, viewport: { width, height },
    origin: r ? { x: (r.x + r.width / 2) / width, y: 1 - (r.y + r.height / 2) / height } : { x: 0.5, y: 0.5 },
    dispose() { image.width = 1; image.height = 1; },
  };
}

export async function waitForPrimaryMedia() {
  const primary = [...document.querySelectorAll<HTMLImageElement>("[data-transition-media] img, main img")].find((el) => el.getBoundingClientRect().height > 0);
  if (primary && !primary.complete) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      primary.decode().catch(() => {}),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, 350); }),
    ]);
    clearTimeout(timer);
  }
}
