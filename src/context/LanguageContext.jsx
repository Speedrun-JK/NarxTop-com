import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  translations,
  DEFAULT_LANG,
  LANGUAGES,
  displayPremiumName,
} from "../../shared/translations.js";

import { ALL_CATEGORIES } from "../lib/constants";
import builtIn from "../data/products.json";

const ORIGINAL_NAMES = new Map(builtIn.map((p) => [p.slug, p.name]));
import { apiUrl } from "../lib/api";

const LanguageContext = createContext(null);
const STORAGE_KEY = "narxtop_lang";

function getInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang);

  // Texts loaded from MongoDB (through the Express API). If the server
  // is offline the bundled texts in shared/translations.js are used.
  const [remote, setRemote] = useState({});

  useEffect(() => {
    document.documentElement.lang = lang;

    const controller = new AbortController();

    fetch(apiUrl(`/api/translations/${lang}`), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.messages) {
          setRemote((previous) => ({
            ...previous,
            [lang]: data.messages,
          }));
        }
      })
      .catch(() => {
        /* server offline → fallback texts are used */
      });

    return () => controller.abort();
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGUAGES.includes(next)) return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setLangState(next);
  }, []);

  const lookup = useCallback(
    (key) => displayPremiumName(
      ["contact.err.config", "acc.notifEmptyText"].includes(key)
        ? translations[lang]?.[key] ?? translations[DEFAULT_LANG]?.[key]
        : remote[lang]?.[key] ?? translations[lang]?.[key] ?? translations[DEFAULT_LANG]?.[key],
    ),
    [lang, remote]
  );

  const t = useCallback(
    (key, vars) => {
      let message = lookup(key) ?? key;

      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          message = message.replaceAll(`{${name}}`, String(value));
        }
      }

      return message;
    },
    [lookup]
  );

  const value = useMemo(() => {
    const tCategory = (name) =>
      name === ALL_CATEGORIES
        ? t("cat.all")
        : lookup(`cat.${name}`) ?? name;

    /* Names: translations describe the built-in catalogue; once an admin has renamed a product, their text is shown
     * as written. (Keys are prod.<slug>.name.)
     * Product names and descriptions are saved with editable locale versions on the product document. */
    const tProduct = (product, field) => {
      const source = product.sourceLanguage || "uz";
      if (field === "description") {
        const own = product.description ?? "";
        const i18n = product.descriptionI18n;
        if (i18n && i18n[source] === own && i18n[lang]) return i18n[lang];
        return own;
      }
      const own = product.name;
      const nameI18n = product.nameI18n;
      if (nameI18n && nameI18n[source] === own && nameI18n[lang]) return nameI18n[lang];
      const original = ORIGINAL_NAMES.get(product.slug);
      if (original !== undefined && original !== own) return own;
      return lookup(`prod.${product.slug}.name`) || own;
    };

    const tUnit = (unit = "") =>
      unit.replace(/\b(kg|g|L|dona)\b/g, (match) => t(`unit.${match}`));

    return {
      lang,
      setLang,
      languages: LANGUAGES,
      t,
      tCategory,
      tProduct,
      tUnit,
    };
  }, [lang, setLang, t, lookup]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLang must be used inside LanguageProvider");
  }

  return context;
}
