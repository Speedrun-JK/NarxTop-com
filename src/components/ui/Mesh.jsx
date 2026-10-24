/* Decorative ambient gradient mesh for banners: three soft blobs that drift slowly and shift on scroll (see styles/motion.css).
 * Purely visual (aria-hidden), no layout impact, hidden on phones and when motion is off. */
export default function Mesh() {
  return <span className="nt-mesh" aria-hidden="true"><i /><i /><i /></span>;
}
