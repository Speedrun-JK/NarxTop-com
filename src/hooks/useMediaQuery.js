import { useEffect, useState } from "react";

/* Live `matchMedia` flag. Starts with the real value (no flash) and follows resizes / rotation. */
export default function useMediaQuery(query) {
  const read = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/* The project's phone breakpoint (matches the max-width: 640px phone stylesheets). */
export const PHONE_QUERY = "(max-width: 640px)";
