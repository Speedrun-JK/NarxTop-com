import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import { useLang } from "../context/LanguageContext";
import { LEGAL, LEGAL_UPDATED } from "../data/legal";
import { formatDate } from "../lib/dates";

/* /privacy and /terms — plain-language pages (content in src/data/legal.js). */
export default function Legal({ kind }) {
  const { t, lang } = useLang();
  const doc = (LEGAL[lang] ?? LEGAL.uz)[kind];
  const updated = formatDate(LEGAL_UPDATED, lang);
  return (
    <PageShell>
      <article className="lg">
        <motion.header className="lg-head nt-glass" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <span className="lg-ico"><Icon name={kind === "privacy" ? "shield" : "file"} size={24} /></span>
          <div>
            <h1>{doc.title}</h1>
            <p>{doc.lead}</p>
            <small>{t("legal.updated", { d: updated })}</small>
          </div>
        </motion.header>

        <div className="lg-body nt-glass">
          {doc.blocks.map((b, i) => (
            <section key={b.h}>
              <h2><span>{i + 1}</span>{b.h}</h2>
              {b.p?.map((x) => <p key={x}>{x}</p>)}
              {b.list && <ul>{b.list.map((x) => <li key={x}><Icon name="check" size={14} strokeWidth={2.6} />{x}</li>)}</ul>}
            </section>
          ))}
        </div>

        <footer className="lg-foot">
          <Link to="/contact" className="nt-btn nt-btn-ghost"><Icon name="send" size={16} />{t("legal.contact")}</Link>
          <Link to="/" className="nt-btn nt-btn-ghost"><Icon name="arrowLeft" size={16} />{t("legal.back")}</Link>
        </footer>
      </article>
    </PageShell>
  );
}
