/* Small shopping cart, % badge and price-tag outline icons scattered across the whole page background.
 * Pure SVG, aria-hidden, no images. Two arrangements (`variant`) so the top-right and bottom-left corners are not copies.
 * Placement, size and opacity live in CSS (.nt-deco*); colours come from the brand tokens (chocolate ink + rose accent). */

const pts = (n, rOut, rIn) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (Math.PI * i) / n, r = i % 2 ? rIn : rOut;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(" ");
const BURST = `M${pts(12, 25, 21).split(" ").join("L")}Z`;

/* a % sign: two rings and a slash, centred on 0,0 */
function Pct({ s = 1 }) {
  return (
    <g transform={`scale(${s})`} className="d-stroke d-rose" fill="none" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="-7" cy="-7" r="4.2" /><circle cx="7" cy="7" r="4.2" /><path d="M9 -10L-9 10" />
    </g>
  );
}

function Cart() {
  return (
    <g className="d-stroke d-ink" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 4H14L27 54H73L86 20H18" />
      <path d="M21 32H82M25 43H77" strokeWidth="2" opacity=".6" />
      <circle cx="35" cy="66" r="6" /><circle cx="66" cy="66" r="6" className="d-rose" />
    </g>
  );
}

function Tag() {
  return (
    <g>
      <path d="M0 20L16 2Q18 0 21 0H48Q54 0 54 6V34Q54 40 48 40H21Q18 40 16 38Z" className="d-stroke d-ink d-wash" strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="14" cy="20" r="3.4" className="d-stroke d-ink" fill="none" strokeWidth="2" />
      <g transform="translate(35 20)"><Pct s=".62" /></g>
      <path d="M11 18C-2 4 -12 12 -16 0" className="d-stroke d-ink" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="1 5" />
    </g>
  );
}

function Burst({ s = 1 }) {
  return (
    <g transform={`scale(${s})`}>
      <path d={BURST} className="d-stroke d-rose d-wash-rose" strokeWidth="2.2" strokeLinejoin="round" />
      <Pct s=".78" />
    </g>
  );
}


const BOX = { cart: "-4 -2 96 80", tag: "-20 -4 78 48", pct: "-15 -15 30 30", burst: "-27 -27 54 54" };
const ART = { cart: <Cart />, tag: <Tag />, pct: <Pct />, burst: <Burst /> };

/* [type, left %, top %, size px, rotation deg, hide on phones] — spread evenly, away from the page centre where possible */
const ITEMS = [
  ["cart", 4, 12, 40, -8, 0], ["pct", 15, 6, 22, 12, 0], ["tag", 27, 16, 38, -14, 1], ["burst", 41, 5, 30, 8, 0],
  ["cart", 62, 9, 36, 6, 1], ["pct", 74, 18, 20, -10, 0], ["tag", 85, 7, 38, 12, 0], ["burst", 94, 22, 30, -6, 0],
  ["pct", 7, 34, 20, 8, 1], ["tag", 3, 52, 36, -10, 0], ["cart", 12, 70, 42, 6, 1], ["burst", 5, 88, 32, -8, 0],
  ["pct", 22, 92, 22, 14, 0], ["tag", 34, 80, 36, -12, 1], ["cart", 47, 93, 38, 8, 0], ["pct", 58, 84, 20, -6, 1],
  ["burst", 69, 94, 30, 10, 0], ["tag", 80, 82, 38, -8, 0], ["cart", 91, 90, 40, 6, 0], ["pct", 96, 68, 22, -12, 0],
  ["burst", 93, 46, 30, 8, 1], ["cart", 95, 34, 34, -6, 1], ["pct", 50, 50, 16, 10, 1], ["tag", 18, 46, 32, 6, 1],
];

export default function ShopDeco() {
  return (
    <div className="nt-deco-field" aria-hidden="true">
      {ITEMS.map(([type, x, y, size, rot, hide], i) => (
        <svg key={i} className={`nt-deco ${hide ? "is-extra" : ""}`.trim()} viewBox={BOX[type]} focusable="false"
          style={{ left: `${x}%`, top: `${y}%`, width: size, rotate: `${rot}deg` }}>
          {ART[type]}
        </svg>
      ))}
    </div>
  );
}
