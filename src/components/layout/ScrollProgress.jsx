import { motion, useScroll, useSpring } from "framer-motion";
import { useMotionPrefs } from "../../context/MotionPrefsContext";

/* Thin brand-coloured reading progress line under the top edge. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const { disabled } = useMotionPrefs();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  return <motion.div className="nt-progress" style={{ scaleX: disabled ? scrollYProgress : scaleX }} aria-hidden="true" />;
}
