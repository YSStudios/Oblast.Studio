// Animated orientation test pattern (spec §6.5: "rotating debug texture, color
// bars and orientation markers"). 16:9 on purpose, so the square cover-crop is
// exercised: everything that must survive the crop sits inside the safe square.

export const DEBUG_W = 1280;
export const DEBUG_H = 720;

const BARS = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];

export function drawDebugFrame(ctx: CanvasRenderingContext2D, t: number) {
  const W = DEBUG_W;
  const H = DEBUG_H;
  const safe = H; // centred square that survives the cover crop
  const sx = (W - safe) / 2;

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, H);

  // Outside-safe-area fill (should never be visible on a face).
  ctx.fillStyle = "#3a1010";
  ctx.fillRect(0, 0, sx, H);
  ctx.fillRect(W - sx, 0, sx, H);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const x = sx + (safe / 8) * i;
    const y = (H / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + safe, y);
    ctx.stroke();
  }

  // Colour bars across the top of the safe square.
  const barW = safe / BARS.length;
  BARS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(sx + i * barW, 0, barW + 1, H * 0.14);
  });

  // Greyscale ramp along the bottom (checks colour/tone pipeline vs DOM).
  for (let i = 0; i < 11; i++) {
    const v = Math.round((i / 10) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(sx + (safe / 11) * i, H * 0.86, safe / 11 + 1, H * 0.14);
  }

  // Orientation markers
  ctx.fillStyle = "#fff";
  ctx.font = "600 44px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("▲ TOP", W / 2, H * 0.21);
  ctx.textAlign = "left";
  ctx.fillText("L", sx + 24, H / 2);
  ctx.textAlign = "right";
  ctx.fillText("R", sx + safe - 24, H / 2);

  // Rotating sweep — makes frame drops and frozen textures obvious.
  const cx = W / 2;
  const cy = H / 2;
  const r = safe * 0.26;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const a = t * 1.5;
  ctx.strokeStyle = "#e8dfab";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  ctx.stroke();

  // Big asymmetric glyph: reads wrong if a face is mirrored.
  ctx.fillStyle = "#fff";
  ctx.font = "700 150px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("F", cx, cy + 4);

  // Timecode
  ctx.font = "500 30px ui-monospace, monospace";
  ctx.fillStyle = "#c8edaa";
  ctx.fillText(`T ${t.toFixed(2)}s`, cx, H * 0.78);
}
