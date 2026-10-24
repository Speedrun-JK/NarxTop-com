import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { PlusProvider } from "./context/PlusContext";
import { CatalogProvider } from "./context/CatalogContext";
import { UserDataProvider } from "./context/UserDataContext";
import { BrowserRouter } from "react-router-dom";
import { MotionPrefsProvider } from "./context/MotionPrefsContext";

import "./styles/tokens.css";
import "./index.css";
import "./styles/platform.css";
import "./styles/design.css";
import "./styles/cart-footer.css";
import "./styles/refresh.css";
import "./styles/revamp.css"; // wins every desktop conflict
import "./styles/contact.css"; // contact page + footer contact button
import "./styles/polish.css"; // site-wide polish
import "./styles/cart.css"; // cart page (simple cards, inner scroll)
import "./styles/card.css"; // product cards (.pc-*)
import "./styles/admin.css"; // admin panel (.adm-*)
import "./styles/upgrade.css"; // site-wide visual refresh (v2)
import "./styles/cards-banners.css"; // card outlines, product-card layout, stronger banners
import "./styles/about.css"; // About page
import "./styles/route.css"; // "Yo‘lni ko‘rish" popup
import "./styles/plus.css"; // NarxTop Plus (page, promo, limit toast)
import "./styles/extras.css"; // quick-view modal, deals, legal pages, store logos, admin Plus panel
import "./styles/layout.css"; // centred column + compact banners (desktop only)
import "./styles/motion.css"; // site-wide motion + typography layer (before the phone layers)
import "./styles/mobile.css"; // phones only (max-width media queries)
import "./styles/phone.css"; // phone layer v2 + compact desktop footer
import "./styles/final.css"; // performance + card / footer / about refinements
import "./styles/mobile-fit.css"; // phones only: navbar, categories, smaller text, scrollers
import "./styles/mobile-v3.css"; // phones only: price box, dark photos, visible scrollers, slim banner/footer/login
import "./styles/mobile-v4.css"; // small-phone pass: card counters, scroll bars, product page, footer
import "./styles/redesign.css"; // hero carousel, new product card, checkout popup, site-wide refresh
import "./styles/glass.css"; // quick-look pop-up + card / cart / product page refinements
import "./styles/finish.css"; // final polish for the whole site
import "./styles/cart-v2.css"; // cart summary (Xarid hisobi) v2 + scroller
import "./styles/guest-v2.css"; // signed-out visitor banner v2
import "./styles/ui-v5.css"; // category illustrations, in-cart card colour, Xarid hisobi + popups, site polish (keep last)
import "./styles/site-v2.css"; // smaller product cards + site-wide polish
import "./styles/polish-v3.css"; // cart store logos, login/sign-up pages, search drop-down
import "./styles/polish-v4.css"; // new logo + crown, favourites button, sign-out, Plus page
import "./styles/v24.css"; // v24: visible theme-aware borders, category colours + smaller pills, product-card palette (no purple); must stay last
import "./styles/search-history.css"; // warm global palette refinements, recent searches and mobile card navigation
import "./styles/warm-earth.css"; // full-site cocoa and toasted-cream light theme
import "./styles/premium-features.css"; // Smart Buy AI, favourite alerts and account icons
import "./styles/home-carousels.css"; // signed-in savings carousel, compact banner and preview polish
import "./styles/mobile-v5.css"; // phone-only refinements: compact cards/preview/premium/footer/cart (desktop untouched)
import "./styles/products.css"; // /products page: category sidebar, phone pill row, home "see all" button
import "./styles/home-v75.css"; // v75: hero like the mock-up, daily carousel, per-store card colours, sort pill, 2x2 quick tiles
import "./styles/v76.css"; // v76: sort drop-down on top, hero photo, new carousel look, gold cheapest highlight, corner foliage (keep last)
import "./styles/auth-phone.css"; // sign-in / sign-up: country phone field + password eye (scoped, keep last)
import "./styles/v78-polish.css"; // v78: corner shop decorations, one-flow Smart Cart, phone heading/categories, compact Premium (keep last)
import "./styles/site-accent.css"; // user-selected accent colours for the whole site
import "./styles/showcase.css"; // reference-led home, floating navigation, and final responsive polish
import "./styles/brand.css"; // v83: new logo + adaptive Plus crown
import "./styles/hero-v83.css"; // v83: main banner only (dark + light themes), pastel home tiles (keep last)
import "./styles/hero-v84.css"; // v84: compact one-screen banner + richer banner styling (keep last)
import "./styles/hero-v85.css"; // v85: phone-only main banner layout (keep last)
import "./styles/guest-v85.css"; // v85: signed-out visitors (banner buttons + guest showcase, keep last)
import "./styles/hero-v86.css"; // v86: readable main banner text, richer banner + signed-out styling (keep last)
import "./styles/warm-v87.css"; // v87: warm cream + brown borders everywhere in the light theme, brown-tinted banner (keep last)
import "./styles/polish-v88.css"; // v88: readable accent word, lighter banner tint, cards/grid polish, Plus crown placement (keep last)
import "./styles/polish-v89.css"; // v89: readable wordmark, plain home product list, new motion (keep last)
import "./styles/polish-v90.css"; // v90: footer wordmark, layered footer/cards/sidebar/page styling (keep last)
import "./styles/nav-m85.css"; // v85c: phone navbar + burger menu (<= 860px only, keep last)
import "./styles/staff-tools.css"; // product translations and staff profiles
import "./styles/theme-v91.css"; // v91: new navbar (dark + light), page background photos, site polish (keep last)
import "./styles/polish-v92.css";
import "./styles/staff-chat.css"; // staff chat, role themes, and responsive styling
import "./styles/chat-v93.css"; // readably themed controls, responsive chat settings and message actions
import "./styles/cursor.css"; // theme-aware desktop pointer with native text/drag cursors preserved
import "./styles/site-v100.css"; // v100: minimal theme-aware store polish and stable controls
import "./styles/site-v101.css"; // v101: chat performance, sticker messages, and shared tap feedback
import "./styles/navbar-v103.css"; // v103: centered Plus crown and stable language selector alignment
import "./styles/chat-v105.css"; // v105: robust message spacing, Telegram-sized stickers, rebuilt sticker/emoji pickers
import "./styles/minimal-commerce.css"; // calmer commerce UI, stable navigation, and language-safe controls
import "./styles/navbar-v106.css"; // v106: phone navbar — language moves into the burger menu, logo + burger always fit
import "./styles/chat-v106.css"; // v106: own-message alignment, mic banner, sticker hold-preview, background paste zone
import "./styles/site-v106.css"; // v106: phone-number gate, boot screen, site-wide polish (keep last)
import "./styles/request-fixes.css"; // requested category, mobile chat/admin, image, cursor, and layout refinements
import "./styles/navbar-v110.css"; // v110: rectangular navbar, logo/crown polish, fixed burger sheet, theme switch (keep last)
import "./styles/chat-v110.css"; // v110: chat gaps, light theme like the reference, Telegram-style sticker panel
import "./styles/pages-v110.css"; // v110: categories, mobile product page, admin form, home carousel, cards
import "./styles/v111.css"; // v111: /chat navbar + white chat + voice bubble, admin collapsible categories / multi meals, sidebar, phone preview sheet (keep last)

export default function mount(rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ThemeProvider>
      <MotionPrefsProvider>
        <LanguageProvider>
          <AuthProvider>
            <PlusProvider>
              <CatalogProvider>
                <UserDataProvider>
                  <CartProvider>
                    <BrowserRouter>
                      <App />
                    </BrowserRouter>
                  </CartProvider>
                </UserDataProvider>
              </CatalogProvider>
            </PlusProvider>
          </AuthProvider>
        </LanguageProvider>
      </MotionPrefsProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
