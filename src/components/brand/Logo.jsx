import { useId } from "react";
import { Link } from "react-router-dom";
import AnimatedBrand from "./AnimatedBrand";
import { useLang } from "../../context/LanguageContext";

/* NarxTop brand mark (v3): a deep-orange squircle with a bold white N. The N's right stem grows a fresh green leaf
 * (the grocery side) and its diagonal ends in a small price-drop notch (the "cheapest" side). Calmer and bolder than v2
 * so it stays readable from 20px (footer) to 130px (Plus page). With `plus` the rim turns polished gold. */
export function LogoMark({ size = 34, plus = false, bare = false }) {
  const id = useId();
  if (bare) {
    /* v91 navbar mark: just the bold orange N with its green leaf (no tile behind it), like the navbar mock-up. */
    return (
      <svg className={`nt-mark is-bare ${plus ? "is-plus" : ""}`} width={size} height={size} viewBox="8 1.5 34 37" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-bn`} x1="12" y1="15" x2="32" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffc23d" />
            <stop offset=".45" stopColor="#ff8a1c" />
            <stop offset="1" stopColor="#ef4d0c" />
          </linearGradient>
          <linearGradient id={`${id}-bl`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c9f77e" />
            <stop offset="1" stopColor="#2bb24f" />
          </linearGradient>
        </defs>
        <path d="M12 35V15h5.4l9.2 11.7V15H32v20h-5.2L17.4 23.1V35Z" fill={`url(#${id}-bn)`} stroke={`url(#${id}-bn)`} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M13.2 17.2v3.4c0 .5.7.5.7 0v-3.4Z" fill="#fff" opacity=".35" />
        <path d="M31.2 15.2c-.9-5.6 2.2-10.2 8.6-11.4.9 6-2 10.6-8.6 11.4Z" fill={`url(#${id}-bl)`} strokeLinejoin="round" />
        <path d="M32.4 13.6c1.8-3 4.2-5.2 6.4-6.6" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={`nt-mark ${plus ? "is-plus" : ""}`} width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-bg`} x1="4" y1="2" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb84d" />
          <stop offset=".5" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#d9460a" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-n`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffe9cf" />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c7f58a" />
          <stop offset="1" stopColor="#24a14f" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset=".5" stopColor="#f5b83a" />
          <stop offset="1" stopColor="#b96f10" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="4" width="39" height="38" rx="13" fill={`url(#${id}-bg)`} />
      <path d="M2.5 19C2.5 10.7 9.2 4 17.5 4h9C34.8 4 41.5 10.7 41.5 19c-12 6-27 6-39 0Z" fill={`url(#${id}-gloss)`} opacity=".8" />
      <rect x="4.6" y="6.1" width="34.8" height="33.8" rx="11" fill="none" stroke="#fff" strokeOpacity=".22" />
      {/* N: soft shadow, then the solid letter (the diagonal's lower end is cut like a price tag) */}
      <path d="M12 35V15h5.4l9.2 11.7V15H32v20h-5.2L17.4 23.1V35Z" fill="#7a2c00" opacity=".34" transform="translate(0 1.6)" />
      <path d="M12 35V15h5.4l9.2 11.7V15H32v20h-5.2L17.4 23.1V35Z" fill={`url(#${id}-n)`} stroke={`url(#${id}-n)`} strokeWidth="1.2" strokeLinejoin="round" />
      {/* leaf growing from the top of the right stem */}
      <g>
        <path d="M31.2 15.2c-.9-5.6 2.2-10.2 8.6-11.4.9 6-2 10.6-8.6 11.4Z" fill={`url(#${id}-leaf)`} stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M32.4 13.6c1.8-3 4.2-5.2 6.4-6.6" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth=".9" strokeLinecap="round" />
      </g>
      <rect x="2.5" y="4" width="39" height="38" rx="13" fill="none" stroke={plus ? `url(#${id}-gold)` : "#fff"} strokeOpacity={plus ? 1 : 0.34} strokeWidth={plus ? 2.4 : 1} />
    </svg>
  );
}

/* Crown for Plus members (v4): a three-peak royal crown with a faceted gold body, pearl tips,
 * a jewelled band (ruby + sapphire) and a light glint that sweeps across it.
 * Adaptive: the crown is drawn at any size and sizes itself from the logo (see `.nt-plus-crown`);
 * below ~26px the small gems and the sparkle are dropped so the silhouette stays crisp. */
export function PlusCrown({ size = 20, className = "" }) {
  const id = useId();
  const fine = size >= 26;
  const body = "M6 31 3.6 13.4 15.2 22 24 6.2 32.8 22l11.6-8.6L42 31Z";
  return (
    <svg className={`nt-crown ${fine ? "is-fine" : "is-small"} ${className}`} width={size} height={size * 0.8} viewBox="0 0 48 38" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="4" x2="40" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff8cf" />
          <stop offset=".38" stopColor="#ffcb45" />
          <stop offset=".78" stopColor="#e19418" />
          <stop offset="1" stopColor="#a85f08" />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd45e" />
          <stop offset=".5" stopColor="#e6a01f" />
          <stop offset="1" stopColor="#9a5606" />
        </linearGradient>
        <radialGradient id={`${id}-ruby`} cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#ffc0cf" />
          <stop offset=".5" stopColor="#ff3d6e" />
          <stop offset="1" stopColor="#b5123f" />
        </radialGradient>
        <radialGradient id={`${id}-sap`} cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#d4f4ff" />
          <stop offset=".55" stopColor="#4cc2ff" />
          <stop offset="1" stopColor="#1668c4" />
        </radialGradient>
        <radialGradient id={`${id}-pearl`} cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#ffe6a6" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><path d={body} /><rect x="5.2" y="28.4" width="37.6" height="7.2" rx="3.6" /></clipPath>
      </defs>
      <path d={body} fill={`url(#${id}-g)`} stroke="#8f4f05" strokeWidth="1.5" strokeLinejoin="round" />
      {/* facets */}
      <path d="M15.2 22 24 6.2 21.4 23.6Z" fill="#fff" opacity=".34" />
      <path d="M32.8 22 24 6.2l2.6 17.4Z" fill="#8a4a04" opacity=".2" />
      <path d="M6 31 3.6 13.4 12 19.6Z" fill="#fff" opacity=".22" />
      <rect x="5.2" y="28.4" width="37.6" height="7.2" rx="3.6" fill={`url(#${id}-band)`} stroke="#8f4f05" strokeWidth="1.3" />
      <path d="M8 30.2h32" stroke="#fff" strokeOpacity=".45" strokeWidth=".9" strokeLinecap="round" />
      {/* pearl tips */}
      <circle cx="3.6" cy="12.4" r="2.7" fill={`url(#${id}-pearl)`} stroke="#b46c0b" strokeWidth="1.1" />
      <circle cx="24" cy="5" r="3.1" fill={`url(#${id}-pearl)`} stroke="#b46c0b" strokeWidth="1.1" />
      <circle cx="44.4" cy="12.4" r="2.7" fill={`url(#${id}-pearl)`} stroke="#b46c0b" strokeWidth="1.1" />
      {/* band jewels: ruby centre, sapphire sides */}
      <path d="m24 29.2 3 2.9-3 2.9-3-2.9Z" fill={`url(#${id}-ruby)`} stroke="#fff" strokeWidth=".8" strokeLinejoin="round" />
      {fine && <>
        <circle cx="12.5" cy="32.1" r="1.8" fill={`url(#${id}-sap)`} stroke="#fff" strokeWidth=".7" />
        <circle cx="35.5" cy="32.1" r="1.8" fill={`url(#${id}-sap)`} stroke="#fff" strokeWidth=".7" />
        <circle cx="24" cy="17.2" r="1.7" fill={`url(#${id}-sap)`} stroke="#fff" strokeWidth=".7" />
      </>}
      {/* moving glint, clipped to the crown */}
      <g clipPath={`url(#${id}-clip)`}><rect className="nt-crown-shine" x="-16" y="0" width="7" height="38" fill="#fff" opacity=".62" /></g>
      {fine && <path d="M40 1.6v5M37.5 4.1h5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" className="nt-crown-twinkle" />}
    </svg>
  );
}

export default function Logo({ to = "/", size = 36, withMark = true, variant = "nav", isPlus = false, bare = false }) {
  const { t } = useLang();
  return (
    <Link to={to} className={`nt-logo ${isPlus ? "is-plus" : ""}`} aria-label="NarxTop">
      {withMark && <span className="nt-logo-markwrap" style={{ "--mark": `${size}px` }}><LogoMark size={size} plus={isPlus} bare={bare} />{isPlus && <span className="nt-plus-crown" title={t("acc.plus")}><PlusCrown size={Math.max(18, Math.round(size * 0.72))} /></span>}</span>}
      <AnimatedBrand variant={variant} />
    </Link>
  );
}
