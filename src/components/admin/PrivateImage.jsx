import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { adminApi } from "../../services/admin";

/* A receipt photo fetched lazily (only once it scrolls into view) through the admin-only image route. */
export default function PrivateImage({ id, alt, className = "", openViewer }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => !globalThis.IntersectionObserver);
  const [src, setSrc] = useState("");
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!globalThis.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !id) return undefined;
    let live = true, url = "";
    adminApi.receiptImage(id).then((blob) => {
      url = URL.createObjectURL(blob);
      if (live) setSrc(url); else URL.revokeObjectURL(url);
    }).catch(() => {});
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [id, visible]);
  const content = src ? <img src={src} alt={openViewer ? alt : ""} loading="lazy" /> : <span><Icon name="image" size={18} /></span>;
  return openViewer
    ? <button ref={ref} type="button" className={`adm-receipt-thumb ${className}`} onClick={() => src && openViewer(src, alt)} disabled={!src} aria-label={alt}>{content}</button>
    : <div ref={ref} className={`adm-receipt-thumb ${className}`} aria-hidden="true">{content}</div>;
}
