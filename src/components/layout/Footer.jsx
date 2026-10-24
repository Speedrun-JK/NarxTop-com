import { Link } from "react-router-dom";
import Logo from "../brand/Logo";
import { useLang } from "../../context/LanguageContext";

export default function Footer() {
  const { t } = useLang();
  const rights = String(t("footer.rights") ?? "").replace(/^©\s*\d{4}\s*NarxTop\.?\s*/, "");

  return (
    <footer className="nf">
      <div className="nf-card">
        <div className="nf-compact">
          <Logo variant="footer" />
          <nav className="nf-links" aria-label={t("footer.nav")}>
            <Link to="/products">{t("nav.search")}</Link>
            <Link to="/cart">{t("nav.cart")}</Link>
            <Link to="/smart-buy">{t("smart.title")}</Link>
            <Link to="/contact">{t("footer.contactBtn")}</Link>
          </nav>
        </div>
        <div className="nf-bar">
          <p>© {new Date().getFullYear()} NarxTop. {rights}</p>
          <nav className="nf-legal" aria-label={t("footer.info")}>
            <Link to="/about">{t("footer.about")}</Link>
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/terms">{t("footer.terms")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
