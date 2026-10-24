import { useId } from "react";

/*
 * Category illustrations (v24) — detailed full-colour scenes on a 32x32 grid.
 *
 * Every category is a small composition rather than a single shape: layered gradients, gloss
 * highlights, outlines, a ground shadow and a companion object (apple + orange, carrot + broccoli,
 * milk carton + cheese …). No purple / violet anywhere.
 *
 * Gradients get an id prefix that is unique per rendered <CategoryIcon/> (useId), so dozens of copies
 * (the category pills + one on every product card) can share a page without id collisions.
 * They look the same in light and dark mode. Keys match the names used by CategoryNav.
 */

/* helpers: linear / radial gradient defs */
const Lg = ({ id, a, b, x1 = 0, y1 = 0, x2 = 0, y2 = 1 }) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </linearGradient>
);
const Rg = ({ id, a, b, cx = 0.35, cy = 0.3, r = 0.85 }) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </radialGradient>
);
const Shadow = ({ cx = 16, rx = 9.5 }) => <ellipse cx={cx} cy="29.5" rx={rx} ry="1.5" fill="#2a160b" opacity=".18" />;
const Sparkle = ({ x, y, s = 1.6, fill = "#fff", o = 1 }) => (
  <path d={`M${x} ${y - s}L${x + s * 0.34} ${y - s * 0.34}L${x + s} ${y}L${x + s * 0.34} ${y + s * 0.34}L${x} ${y + s}L${x - s * 0.34} ${y + s * 0.34}L${x - s} ${y}L${x - s * 0.34} ${y - s * 0.34}Z`} fill={fill} opacity={o} />
);

/* each entry receives f(k) -> url(#<unique prefix><k>) and u -> the prefix itself */
const ART = {
  /* ------------------------------- ALL: four glossy tiles with a tiny glyph each ------------------------------- */
  layoutGrid: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#e0ac80" b="#8a5a3b" />
        <Lg id={`${u}b`} a="#ff86ab" b="#dc3f78" />
        <Lg id={`${u}c`} a="#ffd861" b="#ee9314" />
        <Lg id={`${u}d`} a="#52dcc8" b="#0e9e86" />
      </defs>
      <rect x="3" y="3" width="12.4" height="12.4" rx="4" fill={f("a")} stroke="#6b4129" strokeOpacity=".35" strokeWidth=".7" />
      <rect x="16.6" y="3" width="12.4" height="12.4" rx="4" fill={f("b")} stroke="#a82a58" strokeOpacity=".35" strokeWidth=".7" />
      <rect x="3" y="16.6" width="12.4" height="12.4" rx="4" fill={f("c")} stroke="#b36d08" strokeOpacity=".35" strokeWidth=".7" />
      <rect x="16.6" y="16.6" width="12.4" height="12.4" rx="4" fill={f("d")} stroke="#076b5a" strokeOpacity=".35" strokeWidth=".7" />
      <path d="M5.4 7.6a3 3 0 0 1 3-3h2.6M19 7.6a3 3 0 0 1 3-3h2.6M5.4 21.2a3 3 0 0 1 3-3h2.6M19 21.2a3 3 0 0 1 3-3h2.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".55" fill="none" />
      {/* glyphs: ring, heart, star, leaf */}
      <circle cx="9.2" cy="10.2" r="2.7" stroke="#fff" strokeWidth="1.3" fill="none" opacity=".92" />
      <circle cx="9.2" cy="10.2" r=".9" fill="#fff" />
      <path d="M22.8 13.2c-2.7-1.7-3.9-2.9-3.9-4.3a2 2 0 0 1 3.9-.7 2 2 0 0 1 3.9.7c0 1.4-1.2 2.6-3.9 4.3Z" fill="#fff" opacity=".95" />
      <path d="M9.2 19.6l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3 1.1-2.3Z" fill="#fff" opacity=".95" />
      <path d="M19.4 25.8c0-3.9 2.5-6.2 6.5-6.2 0 3.9-2.4 6.2-6.5 6.2Z" fill="#fff" opacity=".95" />
      <path d="M20 25.2c1.5-1.6 3-3 4.9-4.3" stroke="#0e9e86" strokeWidth=".8" strokeLinecap="round" fill="none" />
    </>
  ),

  /* ------------------------------- SNACKS: crimped chips bag + hero crisp + crumbs ------------------------------- */
  chips: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#ffd45a" b="#ee8a1b" x2="1" y2="0.3" />
        <Lg id={`${u}b`} a="#f9a826" b="#cf5c0e" />
        <Rg id={`${u}c`} a="#fff0a8" b="#f0a12c" cx="0.4" cy="0.3" />
        <Rg id={`${u}d`} a="#ff7468" b="#d02c26" />
      </defs>
      <Shadow />
      <path d="M8.2 5.4C7.2 11.6 6.6 20 7.2 27.6h17.6C25.4 20 24.8 11.6 23.8 5.4Z" fill={f("a")} stroke="#b9570c" strokeOpacity=".5" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M8.2 5.4C7.4 11 6.9 18 7 24h4.2c-.3-6.4-.1-12.6 1-18.6H8.2Z" fill="#fff" opacity=".26" />
      {/* crimped seals */}
      <path d="M7 2.8h18v3.4H7z" fill={f("b")} stroke="#b9570c" strokeOpacity=".5" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M8.2 3.1v2.8M10.2 3.1v2.8M12.2 3.1v2.8M14.2 3.1v2.8M16.2 3.1v2.8M18.2 3.1v2.8M20.2 3.1v2.8M22.2 3.1v2.8M24 3.1v2.8" stroke="#fff" strokeOpacity=".45" strokeWidth=".7" />
      <path d="M6.6 26.2h18.8v3.2H6.6z" fill={f("b")} stroke="#b9570c" strokeOpacity=".5" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M8 26.5v2.6M10 26.5v2.6M12 26.5v2.6M14 26.5v2.6M16 26.5v2.6M18 26.5v2.6M20 26.5v2.6M22 26.5v2.6M24 26.5v2.6" stroke="#fff" strokeOpacity=".4" strokeWidth=".7" />
      {/* badge + wavy crisp */}
      <circle cx="16" cy="16.2" r="7.2" fill={f("d")} stroke="#fff" strokeWidth="1.2" />
      <path d="M10.6 13c1.4-2.7 7.3-3.6 10.4-.6 1.7 1.6 1 4.6-1.7 5.8-3.4 1.6-8.9.4-8.7-5.2Z" fill={f("c")} stroke="#c97a14" strokeWidth=".7" />
      <path d="M12.6 14.4c1.3-1.4 4.4-1.8 6-.6M13.4 17c1.5.8 3.6.6 5-.4" stroke="#d98b1c" strokeWidth=".9" strokeLinecap="round" fill="none" />
      <circle cx="15" cy="16" r=".6" fill="#b86a10" />
      <circle cx="18.2" cy="15.2" r=".55" fill="#b86a10" />
      <path d="M11.4 10.8c1.2-1 2.6-1.4 4-1.4" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".5" fill="none" />
      {/* crumbs */}
      <ellipse cx="3.1" cy="25.2" rx="1.7" ry="1.1" fill="#f6b23a" stroke="#c97a14" strokeWidth=".5" transform="rotate(-24 3.1 25.2)" />
      <ellipse cx="29.2" cy="23" rx="1.5" ry="1" fill="#f6b23a" stroke="#c97a14" strokeWidth=".5" transform="rotate(20 29.2 23)" />
      <circle cx="28.2" cy="27.6" r=".7" fill="#e08a1c" />
      <Sparkle x={4.2} y={9.4} s={1.4} fill="#ffd45a" />
    </>
  ),

  /* ------------------------------- DRINKS: soda bottle with wave label, bubbles, fizz ------------------------------- */
  drink: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#6fd0ff" b="#1c74d8" x2="1" y2="0.2" />
        <Lg id={`${u}b`} a="#ff6a5e" b="#c52a24" />
        <Lg id={`${u}c`} a="#ff8fb2" b="#e04079" x2="1" y2="0" />
      </defs>
      <Shadow rx="8" />
      <path d="M13.2 6.9h5.6v3c0 1.4 3.6 2.8 3.6 6.5v10.7a2.5 2.5 0 0 1-2.5 2.5h-7.9a2.5 2.5 0 0 1-2.5-2.5V16.4c0-3.7 3.7-5.1 3.7-6.5v-3Z" fill={f("a")} stroke="#13589f" strokeOpacity=".55" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M13.2 6.9h2.2v3.3c0 1.7-3.6 3-3.6 6.2v11.2h-.3a2.5 2.5 0 0 1-1.6-2.4V16.4c0-3.7 3.7-5.1 3.7-6.5v-3Z" fill="#fff" opacity=".32" />
      <rect x="12.5" y="5.6" width="7" height="1.6" rx=".7" fill="#d6ecff" stroke="#13589f" strokeOpacity=".4" strokeWidth=".5" />
      <rect x="12.7" y="2.4" width="6.6" height="3.4" rx="1.2" fill={f("b")} stroke="#9c1c17" strokeOpacity=".6" strokeWidth=".6" />
      <path d="M14 2.9v2.4M15.4 2.9v2.4M16.8 2.9v2.4M18.2 2.9v2.4" stroke="#fff" strokeOpacity=".5" strokeWidth=".6" />
      {/* label */}
      <rect x="9.6" y="16.4" width="12.8" height="8.2" fill="#fff" />
      <path d="M9.6 21.2c1.6-1.9 3.1-1.9 4.1 0s2.6 1.9 4.2 0c1.5-1.6 3-1.5 4.5.2v3.2H9.6v-3.6Z" fill={f("c")} />
      <circle cx="16" cy="19.2" r="1.7" fill="#1c74d8" />
      <path d="M15.2 19.2h1.6M16 18.4v1.6" stroke="#fff" strokeWidth=".7" strokeLinecap="round" />
      <path d="M9.6 16.4h12.8M9.6 24.6h12.8" stroke="#13589f" strokeOpacity=".25" strokeWidth=".5" />
      {/* bubbles + fizz */}
      <circle cx="14.6" cy="12.8" r=".95" fill="#fff" opacity=".8" />
      <circle cx="17.6" cy="14.2" r=".65" fill="#fff" opacity=".8" />
      <circle cx="16.2" cy="11.2" r=".5" fill="#fff" opacity=".75" />
      <circle cx="21.6" cy="2.6" r=".8" fill="#6fd0ff" />
      <circle cx="24.2" cy="5.2" r=".6" fill="#6fd0ff" />
      <circle cx="9.6" cy="4.4" r=".7" fill="#6fd0ff" />
      <Sparkle x={25.2} y={11} s={1.5} fill="#bfe6ff" />
    </>
  ),

  /* ------------------------------- FRUIT: shiny apple + cut orange ------------------------------- */
  apple: (f, u) => (
    <>
      <defs>
        <Rg id={`${u}a`} a="#ff8a72" b="#c5201a" cx="0.35" cy="0.3" r="0.85" />
        <Rg id={`${u}b`} a="#ffc15a" b="#f07a0e" cx="0.4" cy="0.3" r="0.9" />
        <Lg id={`${u}c`} a="#79cf69" b="#2f8f3f" x2="1" y2="1" />
      </defs>
      <Shadow rx="10.5" />
      <g transform="translate(-1.6 -1) scale(.93)">
        <path d="M16 10.4C13.4 7.8 7 8.9 7 16c0 6.2 3.6 12.6 7.3 12.6 1 0 1.3-.7 1.7-.7s.7.7 1.7.7c3.7 0 7.3-6.4 7.3-12.6 0-7.1-6.4-8.2-9-5.6Z" fill={f("a")} stroke="#8f1510" strokeOpacity=".5" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M10.6 12.6c-1.9 1.3-2.6 3.7-2.2 6.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".5" fill="none" />
        <path d="M16 10.4c-.3-2.4.7-4.4 2.2-5.8" stroke="#6b3d1f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M17.4 8.4c.2-2.8 2.5-4.4 5.4-4.2.2 2.8-1.9 4.6-5.4 4.2Z" fill={f("c")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
        <path d="M18.4 7.4c1.2-1.1 2.5-1.8 3.8-2.2" stroke="#1f6a2e" strokeWidth=".7" strokeLinecap="round" fill="none" />
        <path d="M13.8 28.4c1-.6 1.6-.3 2.2-.3" stroke="#8f1510" strokeOpacity=".4" strokeWidth=".8" strokeLinecap="round" fill="none" />
      </g>
      {/* cut orange */}
      <circle cx="23.4" cy="23.2" r="6" fill={f("b")} stroke="#fff" strokeWidth="1.1" />
      <circle cx="23.4" cy="23.2" r="4.6" fill="#ffe3a6" opacity=".9" />
      <circle cx="23.4" cy="23.2" r="3.8" fill="#ffb13a" />
      <path d="M23.4 23.2V19.4M23.4 23.2l3.2-1.9M23.4 23.2l3.2 1.9M23.4 23.2v3.8M23.4 23.2l-3.2 1.9M23.4 23.2l-3.2-1.9" stroke="#ffe3a6" strokeWidth=".7" strokeLinecap="round" />
      <circle cx="23.4" cy="23.2" r=".9" fill="#ffe3a6" />
      <path d="M19.8 20.6c.9-1 2-1.6 3.2-1.8" stroke="#fff" strokeWidth=".8" strokeLinecap="round" opacity=".7" fill="none" />
    </>
  ),

  /* ------------------------------- VEGETABLES: ridged carrot + broccoli ------------------------------- */
  carrot: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#ffa84a" b="#d9600a" x2="1" y2="0.4" />
        <Rg id={`${u}b`} a="#7fd36d" b="#2b8a3c" cx="0.4" cy="0.3" r="0.9" />
        <Lg id={`${u}c`} a="#b9e08a" b="#6fb04f" x2="1" y2="0" />
      </defs>
      <Shadow rx="10" />
      {/* broccoli (back, bottom-right) */}
      <path d="M22.6 29c.1-2.7.3-4.4.5-6.2h2.2c.2 1.8.4 3.5.5 6.2h-3.2Z" fill={f("c")} stroke="#4f8a3a" strokeOpacity=".5" strokeWidth=".6" />
      <circle cx="20.2" cy="20.2" r="3.7" fill={f("b")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
      <circle cx="28" cy="20.4" r="3.4" fill={f("b")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
      <circle cx="24" cy="17.6" r="4.2" fill={f("b")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
      <circle cx="24.2" cy="21.2" r="3.6" fill={f("b")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
      <circle cx="22.4" cy="16.6" r=".8" fill="#c9f0b8" opacity=".8" />
      <circle cx="26.2" cy="18" r=".6" fill="#c9f0b8" opacity=".8" />
      <circle cx="19.4" cy="19.4" r=".6" fill="#c9f0b8" opacity=".8" />
      <circle cx="27.4" cy="20.6" r=".55" fill="#c9f0b8" opacity=".8" />
      {/* carrot (front) */}
      <g transform="translate(-2.4 -1.2) rotate(38 16 16)">
        <path d="M11.6 11h8.8c.5 0 .8.4.7.9-1.2 7-3.2 12.5-4.2 15.8a.9.9 0 0 1-1.7 0c-1-3.3-3-8.8-4.2-15.8-.1-.5.2-.9.6-.9Z" fill={f("a")} stroke="#a3480a" strokeOpacity=".55" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M11.6 11h3.4c-.2 5.8-1 11.1-2.2 15.4-.8-2.5-1.4-5.8-1.8-9.4-.2-1.8-.3-3.7-.5-5.2 0-.4.3-.8 1.1-.8Z" fill="#fff" opacity=".24" />
        <path d="M12.6 14.4h2.8M16.6 17.6h2.6M13.4 20.8h2.4M16.2 23.6h1.6" stroke="#b9500c" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M16 11C14.6 7.6 12.6 6 10 5.4c.4 3.2 2.6 5.3 6 5.6Z" fill={f("b")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
        <path d="M16 11c.6-3.6 2.4-5.7 5.6-6.5.1 3.3-1.9 5.5-5.6 6.5Z" fill={f("b")} stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
        <path d="M16 11c-1-3-.9-5.4 0-7.6 1.2 2.2 1.2 4.6 0 7.6Z" fill="#8fe07f" stroke="#1f6a2e" strokeOpacity=".5" strokeWidth=".6" />
      </g>
    </>
  ),

  /* ------------------------------- SWEETS: wrapped candy + swirl lollipop ------------------------------- */
  candy: (f, u) => (
    <>
      <defs>
        <Rg id={`${u}a`} a="#ff9bbd" b="#d7336f" cx="0.35" cy="0.3" />
        <Rg id={`${u}b`} a="#ff92b7" b="#d93a76" cx="0.35" cy="0.3" r="0.9" />
        <Lg id={`${u}c`} a="#ffe27a" b="#f5a623" />
      </defs>
      <Shadow rx="10.5" />
      {/* lollipop */}
      <path d="M21.4 14.6 25.6 27.6" stroke="#8b5a2b" strokeOpacity=".4" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21.4 14.6 25.6 27.6" stroke="#fdf0dc" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="21" cy="10.2" r="6.6" fill={f("b")} stroke="#a82255" strokeOpacity=".5" strokeWidth=".8" />
      <path d="M21 10.2a1.2 1.2 0 0 1 2.4 0 2.6 2.6 0 0 1-5.2 0 4 4 0 0 1 8 0" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M16.6 7.4c1-1.6 2.6-2.5 4.4-2.6" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".55" fill="none" />
      {/* wrapped candy */}
      <g transform="rotate(-18 10.6 21.4)">
        <path d="M5.2 21.4 1 17.4v8l4.2-4Z" fill={f("c")} stroke="#c67a0b" strokeOpacity=".6" strokeWidth=".6" strokeLinejoin="round" />
        <path d="m16 21.4 4.2-4v8l-4.2-4Z" fill={f("c")} stroke="#c67a0b" strokeOpacity=".6" strokeWidth=".6" strokeLinejoin="round" />
        <path d="M5.2 21.4 1.4 19M5.2 21.4l-3.8 2.4M16 21.4l3.8-2.4M16 21.4l3.8 2.4" stroke="#d98a12" strokeWidth=".6" strokeLinecap="round" opacity=".8" />
        <ellipse cx="10.6" cy="21.4" rx="6.2" ry="5.2" fill={f("a")} stroke="#a82255" strokeOpacity=".5" strokeWidth=".8" />
        <path d="M7.8 17.4c1.8 2.8 1.8 7.2 0 9.2M10.6 16.4c1.4 3.6 1.4 8.4 0 10.2M13.4 17.4c-1.8 2.8-1.8 7.2 0 9.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".85" fill="none" />
        <ellipse cx="8.2" cy="18.8" rx="1.8" ry=".9" fill="#fff" opacity=".5" transform="rotate(-30 8.2 18.8)" />
      </g>
      <Sparkle x={5} y={7} s={1.7} fill="#ffd45a" />
      <Sparkle x={28} y={22} s={1.2} fill="#ff92b7" />
    </>
  ),

  /* ------------------------------- BREAD: scored loaf + wheat ear + flour ------------------------------- */
  bread: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#f6c97f" b="#c2792f" />
        <Lg id={`${u}b`} a="#f2d27a" b="#d9a52f" />
      </defs>
      <Shadow rx="11" />
      {/* wheat ear */}
      <path d="M27.4 14.6C27 10.8 26.2 7.2 25.2 3.2" stroke="#b98a2a" strokeWidth="1" strokeLinecap="round" fill="none" />
      <g fill={f("b")} stroke="#a8761a" strokeOpacity=".55" strokeWidth=".4">
        <ellipse cx="23.8" cy="5.8" rx="1" ry="1.8" transform="rotate(-28 23.8 5.8)" />
        <ellipse cx="26.6" cy="6.4" rx="1" ry="1.8" transform="rotate(24 26.6 6.4)" />
        <ellipse cx="24" cy="9.2" rx="1" ry="1.8" transform="rotate(-28 24 9.2)" />
        <ellipse cx="26.8" cy="9.8" rx="1" ry="1.8" transform="rotate(24 26.8 9.8)" />
        <ellipse cx="25.2" cy="3.4" rx=".9" ry="1.6" />
      </g>
      {/* loaf */}
      <path d="M4.4 17.6C4.2 12 9.6 8.2 16 8.2s11.8 3.8 11.6 9.4c-.1 1.4-1 2.4-2.1 2.9V26a2.3 2.3 0 0 1-2.3 2.3H8.8A2.3 2.3 0 0 1 6.5 26v-5.5c-1.1-.5-2-1.5-2.1-2.9Z" fill={f("a")} stroke="#8f5518" strokeOpacity=".6" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M6.5 20.5V26a2.3 2.3 0 0 0 2.3 2.3H14c-2.2-2.8-2.8-5.8-2.4-9.6-1.8.6-3.7.7-5.1 1.8Z" fill="#8f5518" opacity=".22" />
      <path d="M7.6 12.6c2-2.6 5.2-4 8.6-4" stroke="#fff3cf" strokeWidth="1.7" strokeLinecap="round" opacity=".55" fill="none" />
      {/* score cuts */}
      <path d="M9.6 13.2l2.8 5.8M14.8 12.2l2.8 6M20 13.2l2.6 5.6" stroke="#fbe6b6" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9.8 13.8l2.2 4.4M15 12.8l2.2 4.6M20.2 13.8l2 4.2" stroke="#d99a4a" strokeWidth=".8" strokeLinecap="round" opacity=".7" />
      <circle cx="7.6" cy="16" r=".5" fill="#fff" opacity=".8" />
      <circle cx="25" cy="15.4" r=".5" fill="#fff" opacity=".8" />
      <circle cx="13" cy="24" r=".45" fill="#fff" opacity=".6" />
      <circle cx="21.6" cy="23.4" r=".45" fill="#fff" opacity=".6" />
    </>
  ),

  /* ------------------------------- MEAT: marbled steak, bone, grill marks, rosemary ------------------------------- */
  meat: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#f27a6c" b="#a52a35" x2="1" y2="1" />
        <Rg id={`${u}b`} a="#fffaf0" b="#ecd5b4" cx="0.35" cy="0.3" />
      </defs>
      <Shadow rx="11" />
      <path d="M4.8 16.4C4.8 10.2 10.4 6.2 16.8 6.6c6.6.4 11 4.6 10.6 10.8-.4 6.2-6.2 10-12.8 9.4C8.4 26.2 4.8 22 4.8 16.4Z" fill={f("a")} />
      <path d="M4.8 16.4C4.8 10.2 10.4 6.2 16.8 6.6c6.6.4 11 4.6 10.6 10.8-.4 6.2-6.2 10-12.8 9.4C8.4 26.2 4.8 22 4.8 16.4Z" stroke="#a52a35" strokeOpacity=".55" strokeWidth="3.6" fill="none" />
      <path d="M4.8 16.4C4.8 10.2 10.4 6.2 16.8 6.6c6.6.4 11 4.6 10.6 10.8-.4 6.2-6.2 10-12.8 9.4C8.4 26.2 4.8 22 4.8 16.4Z" stroke="#ffe9dd" strokeWidth="2.2" fill="none" />
      {/* marbling + grill marks */}
      <path d="M9.2 12.6c2.4-1.6 4.8-1.8 7.2-.6M9.8 19.6c2.8 1.2 5.6 1.2 8.2-.2M15 9.8c1.6.6 3.2.6 4.8 0" stroke="#ffc9b8" strokeWidth="1.1" strokeLinecap="round" opacity=".9" fill="none" />
      <path d="M8.6 14.4l4.6 4.6M10.6 10.6l5 5M12.2 20.8l3.2 3" stroke="#6e1620" strokeWidth="1.3" strokeLinecap="round" opacity=".38" />
      <path d="M9 11c1.8-2 4.2-3 6.6-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".35" fill="none" />
      {/* bone */}
      <circle cx="20.4" cy="16.8" r="3.6" fill={f("b")} stroke="#c8a477" strokeWidth=".9" />
      <circle cx="20.4" cy="16.8" r="1.4" fill="#dcc196" />
      <path d="M17.4 14.6c.8-.8 1.8-1.2 2.8-1.2" stroke="#fff" strokeWidth=".7" strokeLinecap="round" opacity=".8" fill="none" />
      {/* rosemary */}
      <path d="M21.2 29.4C23.8 26.6 26.4 24.6 29.2 22.2" stroke="#3b8f4a" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M23.2 27.6l-1.8-.4M24.4 26.4l-.2-2M26 25.2l1.8.2M27.2 23.8l-.4-1.8M25.2 26.2l1.4 1.2" stroke="#56b366" strokeWidth=".9" strokeLinecap="round" />
    </>
  ),

  /* FISH: a blue-silver whole fish with scales, fins, and a bright eye. */
  fish: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#8ce3ed" b="#2588a5" x2="0.8" y2="1" />
        <Lg id={`${u}b`} a="#d8fbff" b="#74c9dc" x2="1" y2="1" />
      </defs>
      <Shadow rx="11" />
      <path d="M5 16c4-5.4 9-8.1 15-7.7 3.3.2 6.1 1.7 8.3 4.1l2.7-2.3v12l-2.7-2.3c-2.2 2.4-5 3.9-8.3 4.1C14 26.3 9 23.6 5 18.2l-2.2 1.2v-6.8L5 14Z" fill={f("a")} stroke="#17627b" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M13 10.2 15.8 5l4.3 3.7M14 23.9 16.2 28l4-3.9" fill={f("b")} stroke="#17627b" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M11 13.3c1.2 1 1.2 3.4 0 4.5M15 11.5c1.3 1.6 1.3 5.7 0 7.3M19 11.6c1.1 1.5 1.1 5.5 0 7M23 12.4c1 1.2 1 4.4 0 5.6" fill="none" stroke="#e7ffff" strokeWidth="1" strokeLinecap="round" opacity=".8" />
      <circle cx="8" cy="15.1" r="1.1" fill="#fff" /><circle cx="8.2" cy="15.2" r=".48" fill="#173b50" />
      <path d="M6 12.3c2.2-2 5.2-3.5 8.2-4" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".55" />
    </>
  ),

  /* POLUFABRICAT: sealed tray with a row of golden dumplings. */
  semifinished: (f, u) => (
    <>
      <defs><Lg id={`${u}a`} a="#ffe9aa" b="#e9aa49" x2="0.8" y2="1" /><Lg id={`${u}b`} a="#ffdf77" b="#c77626" /></defs>
      <Shadow rx="11" />
      <path d="M4.2 12.2 27 9l2.2 14.4-22.8 3.2Z" fill="#d9e7ec" stroke="#66818b" strokeWidth="1" strokeLinejoin="round" />
      <path d="m6.1 13.7 19.2-2.7 1.5 10.8-19.2 2.7Z" fill="#f8fbfa" stroke="#8da4a7" strokeWidth=".7" />
      <path d="M8.1 16.2c1.5-2.1 4-2.2 5.7-.1l-1.2 2.4-3.9.6ZM15 15.2c1.5-2.1 4-2.2 5.7-.1l-1.2 2.4-3.9.6ZM21.4 14.3c1.4-2.1 3.6-2.1 5.1-.1l-1.1 2.3-3.5.5Z" fill={f("a")} stroke="#b6792c" strokeWidth=".8" strokeLinejoin="round" />
      <path d="m8.7 16 1.2.6 1.6-.9m4.2-.5 1.2.6 1.6-.9m3.8-.5 1.1.6 1.5-.9" fill="none" stroke="#fff5d2" strokeWidth=".65" strokeLinecap="round" />
      <path d="M5 10.5 27.2 7.4M7.2 28.1l21.1-3" fill="none" stroke="#88a0a2" strokeWidth="1" strokeLinecap="round" />
      <path d="m22.3 20.6 3.7-.5" stroke="#59a96c" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),

  /* ------------------------------- DAIRY: milk carton + cheese wedge ------------------------------- */
  milk: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#6fb0ff" b="#2b64cc" />
        <Lg id={`${u}b`} a="#ffffff" b="#dce9fb" x2="1" y2="0" />
        <Lg id={`${u}c`} a="#ffe27a" b="#f0a21a" x2="1" y2="1" />
      </defs>
      <Shadow rx="11.5" />
      {/* carton */}
      <path d="M19 12.6l3.2-3.6v16.2L19 28.4V12.6Z" fill="#bcd3f2" stroke="#2b64cc" strokeOpacity=".4" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M4.8 12.6 8.6 5.6h8.8l1.6 7H4.8Z" fill={f("a")} stroke="#1f4fa8" strokeOpacity=".55" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M8.6 5.6h4l-2 7H4.8l3.8-7Z" fill="#fff" opacity=".24" />
      <rect x="10" y="2.8" width="4.6" height="3" rx=".9" fill="#2b64cc" stroke="#1f4fa8" strokeOpacity=".6" strokeWidth=".6" />
      <rect x="4.8" y="12.6" width="14.2" height="15.8" rx="1.3" fill={f("b")} stroke="#9bb6dc" strokeWidth=".8" />
      <rect x="4.8" y="17.2" width="14.2" height="7.4" fill={f("a")} />
      <path d="M11.9 18.4c1.8 2 2.8 3 2.8 4.2a2.8 2.8 0 0 1-5.6 0c0-1.2 1-2.2 2.8-4.2Z" fill="#fff" />
      <path d="M10.4 22.4a1.6 1.6 0 0 0 1.2 1.4" stroke="#2b64cc" strokeWidth=".6" strokeLinecap="round" fill="none" />
      <path d="M4.8 12.6h14.2" stroke="#9bb6dc" strokeWidth=".8" />
      <path d="M6.2 14v12.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
      {/* cheese */}
      <path d="M14.2 28.4h14.8V19.6Z" fill={f("c")} stroke="#c07a0a" strokeOpacity=".7" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M14.2 28.4 29 19.6" stroke="#fff0b0" strokeWidth="1.3" strokeLinecap="round" opacity=".9" />
      <circle cx="24.6" cy="25.2" r="1.4" fill="#e0920f" />
      <circle cx="20.4" cy="26.8" r="1" fill="#e0920f" />
      <circle cx="26.8" cy="22.4" r=".9" fill="#e0920f" />
      <circle cx="24.2" cy="25.6" r=".5" fill="#ffd36b" />
    </>
  ),

  /* ------------------------------- HOUSEHOLD: spray bottle, droplets, sparkles ------------------------------- */
  spray: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#58dccb" b="#0b8e79" x2="1" y2="0.3" />
        <Lg id={`${u}b`} a="#ff7aa0" b="#c9305f" />
        <Lg id={`${u}c`} a="#f3f6fb" b="#c7d1e0" />
      </defs>
      <Shadow rx="8" cx="17" />
      {/* mist */}
      <circle cx="4.2" cy="6.2" r=".9" fill="#6fdcef" />
      <circle cx="2.8" cy="9.6" r=".7" fill="#6fdcef" />
      <circle cx="6" cy="11.2" r=".8" fill="#6fdcef" />
      <circle cx="3.4" cy="13" r=".6" fill="#6fdcef" />
      <circle cx="7.8" cy="7.4" r=".6" fill="#9fe9f5" />
      {/* trigger + head */}
      <path d="M19.8 11.4h4.4l1.4 4.2h-3.4l-2.4-4.2Z" fill="#b82d57" stroke="#8f1d40" strokeOpacity=".6" strokeWidth=".6" strokeLinejoin="round" />
      <rect x="7.6" y="6.2" width="6.2" height="3" rx="1.5" fill={f("b")} stroke="#8f1d40" strokeOpacity=".6" strokeWidth=".6" />
      <path d="M13.2 5.8h8.2a1.7 1.7 0 0 1 1.7 1.7v3.6H13.2V5.8Z" fill={f("b")} stroke="#8f1d40" strokeOpacity=".6" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M14.4 6.8h5" stroke="#fff" strokeWidth=".9" strokeLinecap="round" opacity=".55" />
      <rect x="13.6" y="10.8" width="6.2" height="3.8" fill={f("c")} stroke="#9aa7bb" strokeOpacity=".6" strokeWidth=".5" />
      {/* bottle */}
      <path d="M10.4 16.4a2.9 2.9 0 0 1 2.9-2h6.6a2.9 2.9 0 0 1 2.9 2.9v9.9a2.4 2.4 0 0 1-2.4 2.4h-7.6a2.4 2.4 0 0 1-2.4-2.4V16.4Z" fill={f("a")} stroke="#066b5b" strokeOpacity=".6" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M10.4 17v9.8a2.4 2.4 0 0 0 2.4 2.4h1.4c-1.6-3-1.8-8.6-.8-13h-1.6a1.4 1.4 0 0 0-1.4 1.4V17Z" fill="#fff" opacity=".28" />
      <path d="M10.6 20.4h12.2" stroke="#fff" strokeWidth=".6" opacity=".35" strokeDasharray="1.2 1.2" />
      {/* label */}
      <rect x="12.2" y="19.2" width="9" height="7.2" rx="1.7" fill="#fff" />
      <circle cx="15" cy="22.6" r="1.4" fill="#6fdcef" />
      <circle cx="18.4" cy="21.6" r=".9" fill="#1fb9a3" />
      <circle cx="18.8" cy="24.4" r=".6" fill="#6fdcef" />
      <Sparkle x={26.2} y={19.4} s={1.8} fill="#fff" />
      <Sparkle x={29} y={25} s={1.1} fill="#9fe9f5" />
      <Sparkle x={4.6} y={19.6} s={1.2} fill="#9fe9f5" />
    </>
  ),

  /* ------------------------------- HYGIENE: striped toothbrush + toothpaste tube + bubbles ------------------------------- */
  toothbrush: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#58c0f5" b="#1670b3" x2="1" y2="0" />
        <Lg id={`${u}b`} a="#ffffff" b="#d9e6f4" x2="1" y2="0" />
        <Lg id={`${u}c`} a="#ff6d62" b="#c92f28" />
      </defs>
      <Shadow rx="10.5" />
      {/* tube */}
      <rect x="3.6" y="12" width="9" height="14.4" rx="2.2" fill={f("b")} stroke="#9bb3cf" strokeWidth=".8" />
      <path d="M3.6 18.2h9v3.6h-9z" fill={f("a")} />
      <path d="M5.4 19.2h5.4M5.4 20.7h3.4" stroke="#fff" strokeWidth=".8" strokeLinecap="round" opacity=".9" />
      <rect x="5.6" y="8.2" width="5" height="4.2" rx="1.2" fill={f("c")} stroke="#8f1d18" strokeOpacity=".6" strokeWidth=".6" />
      <path d="M6.6 9v2.6M8.1 9v2.6M9.6 9v2.6" stroke="#fff" strokeOpacity=".5" strokeWidth=".6" />
      <path d="M3.8 26.4h8.6v2.2H3.8z" fill="#b9c9de" stroke="#8aa0bd" strokeWidth=".5" />
      <path d="M4.8 26.6v1.8M6.4 26.6v1.8M8 26.6v1.8M9.6 26.6v1.8M11.2 26.6v1.8" stroke="#fff" strokeOpacity=".6" strokeWidth=".5" />
      <path d="M5 13.6v4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
      {/* brush */}
      <g transform="rotate(16 22.4 16)">
        <rect x="20.2" y="12.6" width="4.4" height="16" rx="2.2" fill={f("a")} stroke="#0f5a93" strokeOpacity=".55" strokeWidth=".7" />
        <path d="M21 14.2v12.4" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".4" />
        <circle cx="22.4" cy="23.6" r=".7" fill="#fff" opacity=".7" />
        <circle cx="22.4" cy="25.6" r=".7" fill="#fff" opacity=".7" />
        <path d="M21 12.6c-.4-1.8-.8-2.8-1.2-3.6H25c-.4.8-.8 1.8-1.2 3.6Z" fill="#2c8fd0" />
        <rect x="19.2" y="3.8" width="6.4" height="5.6" rx="1.8" fill="#9ddcf8" stroke="#0f5a93" strokeOpacity=".5" strokeWidth=".6" />
        <rect x="20" y="1.6" width="1.5" height="2.6" rx=".7" fill="#ff6d62" />
        <rect x="21.7" y="1.2" width="1.5" height="3" rx=".7" fill="#fff" stroke="#c9d6e6" strokeWidth=".4" />
        <rect x="23.4" y="1.6" width="1.5" height="2.6" rx=".7" fill="#ff6d62" />
      </g>
      {/* bubbles */}
      <circle cx="15.6" cy="8" r="1.5" fill="#e6f6ff" stroke="#7fcdf2" strokeWidth=".5" />
      <circle cx="14" cy="4.8" r=".9" fill="#e6f6ff" stroke="#7fcdf2" strokeWidth=".4" />
      <circle cx="17.6" cy="4.2" r=".7" fill="#e6f6ff" stroke="#7fcdf2" strokeWidth=".4" />
      <Sparkle x={28.6} y={20} s={1.2} fill="#9ddcf8" />
    </>
  ),

  /* ------------------------------- OTHER: taped parcel with label + sparkles ------------------------------- */
  package: (f, u) => (
    <>
      <defs>
        <Lg id={`${u}a`} a="#f6d9a6" b="#dbae70" x2="1" y2="1" />
        <Lg id={`${u}b`} a="#dfae6e" b="#b27840" />
        <Lg id={`${u}c`} a="#bd8446" b="#8c5a2b" />
        <clipPath id={`${u}t`}>
          <path d="M16 4.6 28.2 10.4 16 16.2 3.8 10.4 16 4.6Z" />
        </clipPath>
      </defs>
      <Shadow rx="11" />
      <path d="M3.8 10.4 16 16.2v12.6L3.8 23V10.4Z" fill={f("b")} stroke="#7a4d22" strokeOpacity=".5" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M28.2 10.4 16 16.2v12.6L28.2 23V10.4Z" fill={f("c")} stroke="#7a4d22" strokeOpacity=".5" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M16 4.6 28.2 10.4 16 16.2 3.8 10.4 16 4.6Z" fill={f("a")} stroke="#7a4d22" strokeOpacity=".5" strokeWidth=".8" strokeLinejoin="round" />
      {/* tape across the lid */}
      <g clipPath={`url(#${u}t)`}>
        <path d="M9.2 4.2 24.4 11.6 22.2 14.8 7 7.4Z" fill="#fff6dc" opacity=".92" />
        <path d="M9.2 4.2 24.4 11.6" stroke="#e2c88e" strokeWidth=".5" />
      </g>
      {/* shipping label + arrows */}
      <path d="M6.2 13.6 12 16.4v4.2L6.2 17.8v-4.2Z" fill="#fff" opacity=".92" />
      <path d="M7.2 15.4 10.8 17.1M7.2 16.7 9.4 17.8" stroke="#b27840" strokeWidth=".7" strokeLinecap="round" />
      <path d="M22.4 19.2v5.6M22.4 19.2l-1.3 1.5M22.4 19.2l1.3 1.5" stroke="#fff" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <path d="M16 16.2V28.8" stroke="#5e3a18" strokeOpacity=".35" strokeWidth=".6" />
      <Sparkle x={26.6} y={4.6} s={1.8} fill="#ffd45a" />
      <Sparkle x={5.2} y={5.4} s={1.2} fill="#ffe9a8" />
    </>
  ),
};

export const hasCategoryArt = (name) => typeof name === "string" && name in ART;

export default function CategoryIcon({ name, size = 22, className = "" }) {
  const raw = useId();
  const u = `c${String(raw).replace(/[^a-zA-Z0-9]/g, "")}`;
  const art = (ART[name] ?? ART.package)((k) => `url(#${u}${k})`, u);
  return (
    <svg className={`nt-cat-art ${className}`} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      {art}
    </svg>
  );
}
