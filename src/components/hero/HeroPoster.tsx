// Static stand-in for the hero glass chain. Renders first (and on the server);
// the WebGL chain fades in over it, and this stays as the fallback for reduced
// motion, data saver, WebGL failure and video errors.
// TEMPORARY ART — replace with a rendered still of the production chain.

// Big blocks along the same lower-left → upper-right run as the live chain,
// entering and leaving the frame and shrinking as they recede; drawn
// far-to-near so nearer ones overlap.
const BLOCKS = [
  { x: 392, y: 22, w: 96, h: 66, rot: -16, fill: "#9fe6c9" },
  { x: 322, y: 40, w: 108, h: 76, rot: -14, fill: "#bfe9f7" },
  { x: 240, y: 62, w: 126, h: 90, rot: -12, fill: "#5fe0b8" },
  { x: 142, y: 88, w: 148, h: 108, rot: -10, fill: "#2fa8e8" },
  { x: 24, y: 118, w: 172, h: 126, rot: -8, fill: "#6fe05a" },
  { x: -120, y: 150, w: 196, h: 144, rot: -6, fill: "#e6ecea" },
];

export function HeroPoster() {
  return (
    <svg
      viewBox="0 0 420 230"
      aria-hidden="true"
      focusable="false"
      // Fill the full-bleed stage; blocks run off both edges like the live chain.
      preserveAspectRatio="xMidYMid slice"
      overflow="visible"
      style={{ width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id="hp-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
        </linearGradient>
        <filter id="hp-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {BLOCKS.map((b, i) => (
        <g key={i} transform={`rotate(${b.rot} ${b.x + b.w / 2} ${b.y + b.h / 2})`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.h * 0.3} fill={b.fill} opacity="0.92" filter="url(#hp-glass)" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.h * 0.3} fill="url(#hp-sheen)" />
          <rect
            x={b.x + 1}
            y={b.y + 1}
            width={b.w - 2}
            height={b.h - 2}
            rx={b.h * 0.3}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
        </g>
      ))}
    </svg>
  );
}
