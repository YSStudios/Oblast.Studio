// Static cube poster. Always rendered first; the WebGL video cube (Phase 1)
// fades in over it and this remains the fallback for reduced motion,
// data-saver, WebGL failure and autoplay rejection.
// TEMPORARY ART — replace with a rendered still of the production cube.
export function HeroPoster() {
  return (
    <svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      focusable="false"
      style={{ width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id="hp-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efeee6" />
          <stop offset="1" stopColor="#c9c8bd" />
        </linearGradient>
        <linearGradient id="hp-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d38" />
          <stop offset="1" stopColor="#141513" />
        </linearGradient>
        <linearGradient id="hp-right" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7d8378" />
          <stop offset="1" stopColor="#2b2e29" />
        </linearGradient>
        <radialGradient id="hp-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#090909" stopOpacity="0.18" />
          <stop offset="1" stopColor="#090909" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="352" rx="140" ry="22" fill="url(#hp-shadow)" />
      <g strokeLinejoin="round" strokeWidth="14">
        <path d="M200 60 L330 130 L200 200 L70 130 Z" fill="url(#hp-top)" stroke="url(#hp-top)" />
        <path d="M70 130 L200 200 L200 340 L70 270 Z" fill="url(#hp-left)" stroke="url(#hp-left)" />
        <path d="M330 130 L200 200 L200 340 L330 270 Z" fill="url(#hp-right)" stroke="url(#hp-right)" />
      </g>
      <g fill="none" stroke="#f5f5f3" strokeOpacity="0.35" strokeWidth="1.5">
        <path d="M200 200 L200 340" />
        <path d="M70 130 L200 200 L330 130" />
      </g>
    </svg>
  );
}
