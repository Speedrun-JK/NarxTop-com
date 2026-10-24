/* Soft, semi-transparent leaf / herb / cherry-tomato sprigs used as corner decoration (like the blurred greens in the banner photo).
 * Pure SVG, no images, aria-hidden. `corner` only decides which way the sprig is mirrored; placement is done in CSS (.nt-leaf). */
const LEAF = "M0 0C8-17 30-19 44 0 30 19 8 17 0 0Z";
const LEAF_S = "M0 0C6-12 21-13 30 0 21 13 6 12 0 0Z";

const VEIN = "M3 0L40 0M13 0L21 -6M13 0L21 6M24 0L31 -4.5M24 0L31 4.5";
const VEIN_S = "M2 0L27 0M10 0L16 -4M10 0L16 4";

/* one leaf: body + centre vein with side veins + a soft light edge */
function Leaf({ x, y, r, s, small, cls }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d={small ? LEAF_S : LEAF} className={cls} />
      <path d={small ? VEIN_S : VEIN} className="nt-leaf-vein" />
      <path d={small ? "M4 -5C10 -9 18 -9 24 -3" : "M5 -7C14 -13 28 -13 38 -4"} className="nt-leaf-hl" />
    </g>
  );
}

function Sprig() {
  return (
    <g>
      {/* main branch, a side branch and a thin tendril */}
      <path d="M8 196C42 150 52 96 128 30" className="nt-leaf-stem" fill="none" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M52 130C78 120 100 104 112 74" className="nt-leaf-stem" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 160C16 150 6 138 4 120" className="nt-leaf-stem" fill="none" strokeWidth="2" strokeLinecap="round" />
      <path d="M96 84C112 92 128 90 142 78C150 70 154 60 150 50" className="nt-leaf-stem" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 0" />
      {/* large leaves along the main branch */}
      {[[34, 168, -40, 1.15], [48, 138, -62, 1.2], [70, 108, -30, 1.1], [92, 80, -58, 1], [112, 54, -36, .95], [128, 32, -70, .8], [24, 178, 18, .95], [58, 120, 22, .9], [84, 94, 20, .85], [104, 66, 26, .8]].map(([x, y, r, s], i) => (
        <Leaf key={`a${i}`} x={x} y={y} r={r} s={s} cls={i % 2 ? "nt-leaf-b" : "nt-leaf-a"} />
      ))}
      {/* small leaves + the side branch and tendril */}
      {[[66, 128, 14, .9], [88, 100, -18, .85], [108, 76, 22, .8], [10, 148, -30, .8], [6, 130, -64, .7], [128, 84, 4, .8], [142, 76, -40, .7], [150, 52, -76, .62]].map(([x, y, r, s], i) => (
        <Leaf key={`b${i}`} x={x} y={y} r={r} s={s} small cls="nt-leaf-c" />
      ))}
      {/* cherry tomatoes with a highlight and a calyx, plus tiny berries */}
      <g className="nt-leaf-tom">
        <circle cx="26" cy="112" r="13" /><circle cx="48" cy="98" r="10" /><circle cx="14" cy="136" r="9" />
        <circle cx="62" cy="150" r="7" /><circle cx="40" cy="152" r="5.5" />
        <path d="M26 99l-3-7m3 7l7-4m-7 4l1 8M48 88l-2-5m2 5l5-3M14 127l-2-5m2 5l5-2" className="nt-leaf-tstem" fill="none" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="nt-leaf-hl">
        <ellipse cx="22" cy="107" rx="4" ry="2.4" transform="rotate(-35 22 107)" /><ellipse cx="45" cy="94" rx="3" ry="1.8" transform="rotate(-35 45 94)" />
        <ellipse cx="11" cy="132" rx="2.8" ry="1.7" transform="rotate(-35 11 132)" />
      </g>
      <g className="nt-leaf-berry"><circle cx="124" cy="104" r="3.2" /><circle cx="132" cy="110" r="2.6" /><circle cx="119" cy="112" r="2.4" /></g>
    </g>
  );
}

export default function Foliage({ className = "" }) {
  return (
    <svg className={`nt-leaf ${className}`.trim()} viewBox="0 0 200 210" aria-hidden="true" focusable="false">
      <Sprig />
    </svg>
  );
}
