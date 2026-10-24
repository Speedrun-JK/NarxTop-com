import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Icon from "../ui/Icon";
import ProductCard from "../products/ProductCard";
import SafeImg from "./SafeImg";
import { categoryNames, categoryIconFor, categoryTone } from "../home/CategoryNav";
import CategoryIcon from "../ui/CategoryIcon";
import { ALL_CATEGORIES } from "../../lib/constants";
import { useCatalog } from "../../context/CatalogContext";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";
import { fmtDate, spaced } from "./format";

const CHAINS = ["Korzinka", "Havas", "Makro"];
const LANGUAGES = ["uz", "ru", "en"];
const LANGUAGE_NAMES = { uz: "O‘zbekcha", ru: "Русский", en: "English" };
/* Draft of a NEW product: kept in this browser until it is saved or the admin clears it by hand. */
const DRAFT_KEY = "narxtop_admin_product_draft_v1";
function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && parsed.f ? parsed : null;
  } catch { return null; }
}
function writeDraft(value) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch { /* storage full / blocked */ } }
function dropDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }
const isDraftDirty = ({ f, rows, translations }) =>
  Boolean(f.name || f.brand || f.unit || f.image || f.description || f.mealTypes?.length || f.categories?.length)
  || rows.some((r) => r.price || r.oldPrice || (r.store && r.store !== CHAINS[0]))
  || Object.values(translations).some((x) => x.name || x.description);
const digits = (v) => String(v ?? "").replace(/\D/g, "");

function imageToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read-image"));
    reader.readAsDataURL(blob);
  });
}

async function optimizeProductImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("invalid-image")); });
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.88, blob = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 512 * 1024) break;
      if (quality > 0.64) quality -= 0.07;
      else {
        canvas.width = Math.max(1, Math.round(canvas.width * 0.82));
        canvas.height = Math.max(1, Math.round(canvas.height * 0.82));
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        quality = 0.82;
      }
    }
    if (!blob || blob.size > 512 * 1024) throw new Error("image-too-large");
    return await imageToDataUrl(blob);
  } finally { URL.revokeObjectURL(url); }
}

/* Product editor (right-hand drawer). `product` = null -> new product. Ctrl/Cmd+S saves, Esc closes. */
export default function ProductDrawer({ product, onClose, onSaved }) {
  const editing = Boolean(product);
  const { products: catalog } = useCatalog();
  const row = (o = {}, key) => ({ key, store: o.store ?? "", price: o.price ? String(o.price) : "", oldPrice: o.oldPrice ? String(o.oldPrice) : "", inStock: o.inStock !== false });

  const [draft] = useState(() => (product ? null : readDraft()));
  const [draftRestored, setDraftRestored] = useState(Boolean(draft));
  const initialSource = product?.sourceLanguage || LANGUAGES.find((lang) => product?.nameI18n?.[lang] === product?.name) || "uz";
  const [sourceLanguage, setSourceLanguage] = useState(draft?.sourceLanguage ?? initialSource);
  const [translations, setTranslations] = useState(() => draft?.translations ?? Object.fromEntries(LANGUAGES.map((lang) => [lang, {
    name: lang === initialSource ? product?.name ?? "" : product?.nameI18n?.[lang] ?? "",
    description: lang === initialSource ? product?.description ?? "" : product?.descriptionI18n?.[lang] ?? "",
  }])));
  const [f, setF] = useState(() => (draft?.f ? { ...draft.f, mealTypes: draft.f.mealTypes ?? (draft.f.mealType ? [draft.f.mealType] : []) } : null) ?? ({ name: product?.name ?? "", brand: product?.brand ?? "", category: product?.category ?? "", categories: product?.categories?.length ? product.categories : (product?.category ? [product.category] : []), mealTypes: product?.mealTypes?.length ? product.mealTypes : (product?.mealType ? [product.mealType] : []), unit: product?.unit ?? "", image: product?.image ?? "", description: product?.description ?? "" }));
  const [rows, setRows] = useState(() => {
    if (draft?.rows?.length) return draft.rows;
    const mine = (product?.offers ?? []).filter((o) => o.managed).map((o, i) => row(o, `${product?.slug ?? "new"}-${i}`));
    return mine.length || editing ? mine : [row({ store: CHAINS[0] }, `${product?.slug ?? "new"}-0`)];
  });
  const locked = useMemo(() => (product?.offers ?? []).filter((o) => !o.managed), [product]);
  const [badImg, setBadImg] = useState(""); // the address that failed to load (derived check below, no effect needed)
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageDrop, setImageDrop] = useState(false);
  const [translating, setTranslating] = useState("");
  const [err, setErr] = useState("");
  const [catsOpen, setCatsOpen] = useState(false); // categories start closed; the chevron opens them
  const first = useRef(null);
  const imageInput = useRef(null);
  const formRef = useRef(null);

  const set = (k) => (e) => {
    const value = e.target.value;
    setF((s) => ({ ...s, [k]: value }));
    if (k === "name" || k === "description") {
      setTranslations((current) => Object.fromEntries(LANGUAGES.map((lang) => [lang, lang === sourceLanguage
        ? { ...current[lang], [k]: value }
        : { name: "", description: "" }] )));
    }
  };
  const setRow = (key, patch) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const used = new Set(rows.map((r) => r.store.trim().toLowerCase()));
  const suggestions = useMemo(() => [...new Set([...CHAINS, ...catalog.flatMap((p) => p.prices.map((o) => o.store))])], [catalog]);
  const categories = useMemo(() => [...new Set([...categoryNames, ...(f.categories ?? []), ...(f.category && !categoryNames.includes(f.category) ? [f.category] : [])])], [f.category, f.categories]);

  // Autosave the new-product draft (debounced) and flush it when the form closes, so leaving never loses typing.
  const latest = useRef({ f, rows, translations, sourceLanguage });
  const finished = useRef(false); // true once the product is saved or the draft was cleared on purpose
  useEffect(() => { latest.current = { f, rows, translations, sourceLanguage }; });
  useEffect(() => {
    if (editing) return undefined;
    const timer = setTimeout(() => {
      if (finished.current) return;
      if (isDraftDirty(latest.current)) writeDraft({ ...latest.current, savedAt: Date.now() });
      else dropDraft();
    }, 300);
    return () => clearTimeout(timer);
  }, [editing, f, rows, translations, sourceLanguage]);
  useEffect(() => {
    if (editing) return undefined;
    return () => {
      if (finished.current) return;
      if (isDraftDirty(latest.current)) writeDraft({ ...latest.current, savedAt: Date.now() });
    };
  }, [editing]);

  const clearDraft = () => {
    dropDraft();
    setF({ name: "", brand: "", category: "", categories: [], mealTypes: [], unit: "", image: "", description: "" });
    setRows([row({ store: CHAINS[0] }, `new-${crypto.randomUUID()}`)]);
    setTranslations(Object.fromEntries(LANGUAGES.map((lang) => [lang, { name: "", description: "" }])));
    setSourceLanguage("uz");
    setDraftRestored(false);
    setErr("");
  };

  useEffect(() => {
    first.current?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busy) onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!busy) formRef.current?.requestSubmit(); }
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [busy, onClose]);

  useEffect(() => {
    if (!product?.slug) return undefined;
    let off = false;
    adminApi.history(product.slug).then((h) => { if (!off) setHistory(h); });
    return () => { off = true; };
  }, [product?.slug]);

  const imageUrl = f.image.trim();
  const imgOk = badImg !== imageUrl;

  const prices = useMemo(
    () => [
      ...rows.filter((r) => r.store.trim() && Number(r.price) > 0).map((r) => ({ store: r.store.trim(), price: Number(r.price), oldPrice: Number(r.oldPrice) > Number(r.price) ? Number(r.oldPrice) : undefined, inStock: r.inStock })),
      ...locked.map((o) => ({ store: o.store, price: o.price, oldPrice: o.oldPrice ?? undefined, inStock: o.inStock })),
    ],
    [rows, locked]
  );
  const preview = f.name.trim().length > 1 && prices.length ? { id: "preview", slug: "preview", name: f.name.trim(), category: f.category || "Boshqa", unit: f.unit, image: imgOk ? imageUrl : "", description: f.description, prices } : null;
  const recent = useMemo(() => [...history].sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8), [history]);

  const selectSourceLanguage = (event) => {
    const next = event.target.value;
    if (next === sourceLanguage) return;
    setTranslations((current) => ({ ...current, [sourceLanguage]: { name: f.name, description: f.description } }));
    const selected = translations[next];
    setF((current) => ({ ...current, name: selected?.name || current.name, description: selected?.description || current.description }));
    setSourceLanguage(next);
  };

  const translateTo = async (target) => {
    if (!f.name.trim()) return setErr("Avval mahsulot nomini kiriting.");
    setTranslating(target); setErr("");
    try {
      const result = await adminApi.translateProduct({ source: sourceLanguage, targets: [target], name: f.name, description: f.description });
      setTranslations((current) => ({ ...current, [sourceLanguage]: { name: f.name, description: f.description }, [target]: result[target] ?? { name: "", description: "" } }));
    } catch (error) { setErr(error.message || "Tarjima olinmadi. Keyinroq qayta urinib ko‘ring."); }
    finally { setTranslating(""); }
  };

  const uploadImageFile = async (file) => {
    if (!file) return;
    setImageError("");
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return setImageError("JPEG, PNG yoki WebP rasm tanlang (asl fayl 8 MB gacha).");
    setImageBusy(true);
    try {
      const image = await optimizeProductImage(file);
      const url = await adminApi.uploadProductImage(image);
      setF((current) => ({ ...current, image: url }));
      setBadImg("");
    } catch (error) {
      setImageError(error.message === "image-too-large" ? "Rasmni 512 KB gacha siqib bo‘lmadi. Kichikroq rasm tanlang." : "Rasmni yuklab bo‘lmadi. Qayta urinib ko‘ring.");
    } finally { setImageBusy(false); }
  };
  const uploadImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadImageFile(file);
  };
  const pasteImage = (event) => {
    const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
    const file = item?.getAsFile() ?? Array.from(event.clipboardData?.files ?? []).find((entry) => entry.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    void uploadImageFile(file);
  };
  const dropImage = (event) => {
    event.preventDefault();
    setImageDrop(false);
    const file = Array.from(event.dataTransfer?.files ?? []).find((entry) => entry.type.startsWith("image/"));
    if (file) void uploadImageFile(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.name.trim().length < 2) return setErr("Mahsulot nomini kiriting.");
    if (!f.categories.length && !f.category) { setCatsOpen(true); return setErr("Kamida bitta kategoriyani tanlang."); }
    if (!f.unit.trim()) return setErr("O‘lchov birligini kiriting (masalan 1.5 L).");
    const offers = rows.filter((r) => r.store.trim() || r.price).map((r) => ({ store: r.store.trim(), price: r.price === "" ? 0 : Number(r.price), oldPrice: r.oldPrice === "" ? undefined : Number(r.oldPrice), inStock: r.inStock }));
    const names = offers.map((o) => o.store.toLowerCase());
    if (new Set(names).size !== names.length) return setErr("Bir do‘kon ikki marta kiritilgan.");
    const bad = offers.find((o) => o.oldPrice !== undefined && o.oldPrice <= o.price);
    if (bad) return setErr(`${bad.store || "Narx"}: eski narx joriy narxdan katta bo‘lishi kerak.`);
    setBusy(true);
    try {
      const nameI18n = Object.fromEntries(LANGUAGES.map((lang) => [lang, translations[lang]?.name ?? ""]));
      const descriptionI18n = Object.fromEntries(LANGUAGES.map((lang) => [lang, translations[lang]?.description ?? ""]));
      nameI18n[sourceLanguage] = f.name;
      descriptionI18n[sourceLanguage] = f.description;
      const payload = { ...f, category: f.categories[0] || f.category, categories: f.categories.length ? f.categories : [f.category], sourceLanguage, nameI18n, descriptionI18n, offers };
      const saved = editing ? await adminApi.updateProduct(product.slug, payload) : await adminApi.createProduct(payload);
      finished.current = true; dropDraft();
      toast(editing ? `“${saved.name}” saqlandi` : `“${saved.name}” saytga qo‘shildi`, { confetti: !editing });
      onSaved(saved);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="adm-drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <motion.aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={editing ? "Mahsulotni tahrirlash" : "Yangi mahsulot"} onPaste={pasteImage} initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 36 }}>
        <header className="adm-drawer-head">
          <div><span className="adm-eyebrow">{editing ? "Tahrirlash" : "Yangi mahsulot"}</span><h2>{editing ? product.name : "Mahsulot qo‘shish"}</h2></div>
          <button type="button" className="adm-icon-btn" onClick={onClose} disabled={busy} aria-label="Yopish"><Icon name="x" size={20} /></button>
        </header>

        {draftRestored && <div className="adm-draft-note" role="status"><Icon name="info" size={16} /><span>Saqlanmagan qoralama tiklandi — yozganlaringiz saqlab qo‘yilgan.</span><button type="button" onClick={clearDraft}>Qoralamani tozalash</button></div>}

        <form className="adm-drawer-body" ref={formRef} onSubmit={submit} noValidate>
          <div className="adm-form">
            <div className="adm-fields">
              <label className="adm-field adm-span2"><span>Nomi *</span><input ref={first} value={f.name} onChange={set("name")} placeholder="Masalan: Sprite 1.5L" maxLength={120} /></label>
              <fieldset className={`adm-field adm-span2 adm-cats ${catsOpen ? "is-open" : "is-closed"}`}>
                <legend className="adm-sr-legend">Kategoriyalar *</legend>
                <button type="button" className="adm-cats-toggle" onClick={() => setCatsOpen((open) => !open)} aria-expanded={catsOpen} aria-controls="adm-cats-panel">
                  <span className="adm-cats-toggle-text"><b>Kategoriyalar *</b><small>{f.categories.length ? f.categories.join(", ") : "Mahsulot qaysi bo‘limlarda ko‘rinsin?"}</small></span>
                  <span className="adm-cats-count" data-on={f.categories.length > 0}>{f.categories.length} ta tanlandi</span>
                  <span className="adm-cats-chevron" aria-hidden="true"><Icon name="chevronDown" size={18} /></span>
                </button>
                {catsOpen && <div id="adm-cats-panel" className="adm-cats-panel">
                <div className="adm-cats-top">
                  <p>Bir nechtasini tanlash mumkin.</p>
                </div>
                <div className="adm-cats-grid" role="group" aria-label="Kategoriyalar">
                  {categories.filter((c) => c !== ALL_CATEGORIES && !/^(fish\s+and\s+mea[nt]|go['’‘ʻʼ]?sht\s+va\s+baliq|мясо\s+и\s+рыба)$/i.test(String(c).trim())).map((c) => {
                    const on = f.categories.includes(c);
                    return (
                      <label key={c} className={`adm-cat ${on ? "is-on" : ""}`} style={categoryTone(c)}>
                        <input type="checkbox" checked={on} onChange={(event) => setF((current) => { const next = event.target.checked ? [...new Set([...current.categories, c])] : current.categories.filter((value) => value !== c); return { ...current, categories: next, category: next[0] ?? "" }; })} />
                        <span className="adm-cat-art" aria-hidden="true"><CategoryIcon name={categoryIconFor(c)} size={30} /></span>
                        <span className="adm-cat-name">{c}</span>
                        <span className="adm-cat-tick" aria-hidden="true"><Icon name="check" size={13} strokeWidth={3} /></span>
                      </label>
                    );
                  })}
                </div>
                {f.categories.length > 1 && <p className="adm-cats-main">Asosiy kategoriya: <b>{f.categories[0]}</b></p>}
                </div>}
              </fieldset>
              <fieldset className="adm-field adm-meals">
                <legend>SmartBuy AI uchun ovqat vaqti</legend>
                <div className="adm-meals-row" role="group" aria-label="SmartBuy AI uchun ovqat vaqti">
                  {[["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"]].map(([id, label]) => {
                    const on = (f.mealTypes ?? []).includes(id);
                    return (
                      <label key={id} className={`adm-meal ${on ? "is-on" : ""}`}>
                        <input type="checkbox" checked={on} onChange={(event) => setF((current) => ({ ...current, mealTypes: event.target.checked ? [...new Set([...(current.mealTypes ?? []), id])] : (current.mealTypes ?? []).filter((value) => value !== id) }))} />
                        <span>{label}</span>
                        <i aria-hidden="true"><Icon name="check" size={12} strokeWidth={3} /></i>
                      </label>
                    );
                  })}
                </div>
                <small className="adm-meals-note">{(f.mealTypes ?? []).length ? `${f.mealTypes.length} ta tanlandi` : "Tanlanmagan — bir nechtasini tanlash mumkin"}</small>
              </fieldset>
              <label className="adm-field"><span>O‘lchov *</span><input value={f.unit} onChange={set("unit")} placeholder="1.5 L, 140 g, 1 kg…" maxLength={30} /></label>
              <label className="adm-field adm-span2"><span>Brend</span><input value={f.brand} onChange={set("brand")} placeholder="Ixtiyoriy" maxLength={60} /></label>
              <div className="adm-field adm-span2">
                <label htmlFor="adm-image-url"><span>Mahsulot rasmi</span></label>
                <div className={`adm-image-dropzone ${imageDrop ? "is-drop" : ""}`} onDragEnter={(e) => { e.preventDefault(); setImageDrop(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setImageDrop(false); }} onDrop={dropImage}>
                  <div className="adm-image-url-row"><input id="adm-image-url" value={f.image} onChange={set("image")} placeholder="Rasm URL manzilini kiriting…" inputMode="url" /><button type="button" className="adm-btn is-sm" onClick={() => imageInput.current?.click()} disabled={imageBusy}><Icon name="image" size={15} />{imageBusy ? "Yuklanmoqda…" : "Rasm tanlash"}</button></div>
                  <input ref={imageInput} type="file" accept="image/*" hidden onChange={uploadImage} />
                  <small className="adm-image-note"><Icon name="copy" size={14} /> Rasmni nusxalab shu panelda Ctrl+V bosing yoki faylni bu yerga sudrang. URL yoki qurilmadan tanlash ham mumkin. Asl rasm 8 MB gacha.</small>
                  {imageError && <p className="adm-image-error" role="alert">{imageError}</p>}
                  {imageUrl && (
                    <div className={`adm-imgprev ${imgOk ? "" : "is-bad"}`}>
                      {imgOk
                        ? <SafeImg key={imageUrl} force src={imageUrl} alt="" loading="eager" onError={() => setBadImg(imageUrl)} fallback={<small>Rasm ochilmadi — manzilni tekshiring</small>} />
                        : <small>Rasm ochilmadi — manzilni tekshiring</small>}
                    </div>
                  )}
                </div>
              </div>
              <label className="adm-field adm-span2"><span>Tavsif</span><textarea rows={3} value={f.description} onChange={set("description")} placeholder="Qisqa tavsif (ixtiyoriy)" maxLength={600} /></label>
            </div>

            <section className="adm-prices">
              <div className="adm-prices-head"><h3>Do‘kon narxlari</h3><span className="adm-pill">{prices.length}</span></div>
              <datalist id="adm-stores">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>

              {rows.map((r) => (
                <div className="adm-offer" key={r.key}>
                  <input list="adm-stores" value={r.store} onChange={(e) => setRow(r.key, { store: e.target.value })} placeholder="Do‘kon" aria-label="Do‘kon" maxLength={40} />
                  <input value={r.price} onChange={(e) => setRow(r.key, { price: digits(e.target.value) })} inputMode="numeric" placeholder="Narx, UZS" aria-label="Narx" />
                  <input value={r.oldPrice} onChange={(e) => setRow(r.key, { oldPrice: digits(e.target.value) })} inputMode="numeric" placeholder="Eski narx" aria-label="Eski narx" />
                  <label className="adm-toggle" title="Do‘konda mavjud"><input type="checkbox" checked={r.inStock} onChange={(e) => setRow(r.key, { inStock: e.target.checked })} /><i /><span>Mavjud</span></label>
                  <button type="button" className="adm-icon-btn is-danger" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label="Narxni olib tashlash"><Icon name="trash" size={16} /></button>
                </div>
              ))}

              {locked.map((o) => (
                <div className="adm-offer is-locked" key={o.store}>
                  <b>{o.store}</b><span>{spaced(o.price)} UZS</span><em><Icon name="lock" size={13} />do‘kon API’dan avtomatik yangilanadi</em>
                </div>
              ))}

              <div className="adm-chips">
                {CHAINS.filter((c) => !used.has(c.toLowerCase())).map((c) => <button key={c} type="button" onClick={() => { const next = row({ store: c }, `new-${crypto.randomUUID()}`); setRows((x) => [...x, next]); }}><Icon name="plus" size={14} />{c}</button>)}
                <button type="button" onClick={() => { const next = row({}, `new-${crypto.randomUUID()}`); setRows((x) => [...x, next]); }} disabled={rows.length >= 12}><Icon name="plus" size={14} />Boshqa do‘kon</button>
              </div>
              {!prices.length && <p className="adm-hint"><Icon name="info" size={15} />Kamida bitta narx qo‘shilmaguncha mahsulot saytda ko‘rinmaydi.</p>}
            </section>

            <section className="adm-translator">
              <div className="adm-translator-head">
                <div><span className="adm-eyebrow"><Icon name="sparkles" size={14} /> Mahsulot tarjimoni</span><h3>Tarjima va tahrirlash</h3></div>
                <label className="adm-source-lang"><span>Asosiy til</span><select value={sourceLanguage} onChange={selectSourceLanguage}>{LANGUAGES.map((lang) => <option key={lang} value={lang}>{LANGUAGE_NAMES[lang]}</option>)}</select></label>
              </div>
              <p className="adm-translate-note">Avval asosiy nom va tavsifni yozing, so‘ng kerakli tillarga tarjima qiling. Saqlashdan oldin avtomatik tarjimani tahrirlashingiz mumkin.</p>
              <div className="adm-translate-actions">
                {LANGUAGES.filter((lang) => lang !== sourceLanguage).map((lang) => <button key={lang} type="button" className="adm-btn is-sm" onClick={() => translateTo(lang)} disabled={Boolean(translating) || !f.name.trim()}>
                  <Icon name={translating === lang ? "refresh" : "sparkles"} size={15} />{translating === lang ? "Tarjima qilinmoqda…" : `${LANGUAGE_NAMES[lang]} tiliga tarjima`}
                </button>)}
              </div>
              <div className="adm-translation-list">
                {LANGUAGES.map((lang) => {
                  const isSource = lang === sourceLanguage;
                  const value = isSource ? { name: f.name, description: f.description } : translations[lang] ?? { name: "", description: "" };
                  const updateValue = (field, next) => {
                    if (isSource) set(field)({ target: { value: next } });
                    else setTranslations((current) => ({ ...current, [lang]: { ...current[lang], [field]: next } }));
                  };
                  return <details className="adm-translation-row" key={lang}>
                    <summary><span>{isSource ? `Asosiy matn · ${LANGUAGE_NAMES[lang]}` : `Tarjima · ${LANGUAGE_NAMES[lang]}`}</span><em>{value.name ? "Tayyor" : "Bo‘sh"}</em><Icon name="chevronDown" size={17} /></summary>
                    <div className="adm-translation-fields">
                      <label className="adm-field"><span>Mahsulot nomi</span><input value={value.name} onChange={(event) => updateValue("name", event.target.value)} maxLength={120} /></label>
                      <label className="adm-field"><span>Tavsif</span><textarea rows={3} value={value.description} onChange={(event) => updateValue("description", event.target.value)} maxLength={600} /></label>
                    </div>
                  </details>;
                })}
              </div>
            </section>

            {recent.length > 0 && (
              <section className="adm-history">
                <div className="adm-prices-head"><h3>Narx tarixi</h3><span className="adm-pill">{history.length}</span></div>
                <ul>
                  {recent.map((h, i) => <li key={`${h.ts}-${h.store}-${i}`}><i>{h.store}</i><b>{spaced(h.price)} UZS</b><time>{fmtDate(h.ts)}</time></li>)}
                </ul>
              </section>
            )}
          </div>

          <aside className="adm-preview" aria-label="Saytdagi ko‘rinishi">
            <span className="adm-eyebrow">Saytdagi ko‘rinishi</span>
            {preview ? <div className="adm-preview-card tc-grid" inert><ProductCard product={preview} /></div> : <div className="adm-preview-empty"><Icon name="eye" size={26} /><p>Nom va kamida bitta narx kiriting — mahsulot kartochkasi shu yerda ko‘rinadi.</p></div>}
          </aside>

          <footer className="adm-drawer-foot">
            {err && <p className="adm-err" role="alert"><Icon name="alert" size={16} />{err}</p>}
            <span className="adm-kbd-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> saqlash</span>
            <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>Bekor qilish</button>
            <button type="submit" className="adm-btn is-primary" disabled={busy || imageBusy || Boolean(translating)}>{busy ? "Saqlanmoqda…" : editing ? "Saqlash" : "Saytga qo‘shish"}</button>
          </footer>
        </form>
      </motion.aside>
    </motion.div>
  );
}
