import { motion } from "framer-motion";
import { useMotionPrefs } from "../../context/MotionPrefsContext";

/* Word-by-word headline reveal (opacity + transform, with a short blur-in). Words stay in the DOM from the first paint,
 * so screen readers read the heading normally; with motion off the text simply renders in place. */
export default function Words({ text, delay = 0, className = "", step = 0.08 }) {
  const { disabled } = useMotionPrefs();
  return <span className={className}>
    {text.split(" ").map((w, i) => (
      <motion.span key={`${w}-${i}`} className="nt-word" initial={disabled ? false : { opacity: 0, y: "0.6em", filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: disabled ? 0 : 0.6, delay: disabled ? 0 : delay + i * step, ease: [0.22, 1, 0.36, 1] }}>
        {w}&nbsp;
      </motion.span>
    ))}
  </span>;
}
