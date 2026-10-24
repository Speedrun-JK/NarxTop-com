# v75 — home page redesign

- **Hero banner** (`styles/home-v75.css`, `HeroBanner.jsx`): dark glass over a blurred supermarket background, transparent glass
  comparison card, icon stat chips, white search pill with pink "Qidirish" button, gradient second headline line.
  Optional photo: put `hero.jpg` in `src/assets/hero/` (see the README there). Without it a soft coloured background is used.
- **Daily carousel** (`components/home/DailyPicks.jsx`, `shared/core/dailyPicks.js`): between the banner and "Salom, ...".
  3 slides x 3 products, picked at random from the cheaper half of the in-stock catalog. Seeded by the Tashkent date, so everyone sees
  the same 9 all day and the set changes at midnight (also while the page is open). Unit-tested.
- **Store colours**: Korzinka red, Havas green, Makro blue on every product row. The cheapest row used to turn green (making it look
  the same as Havas); it now keeps its store colour and is highlighted with a thick border, glow and check badge.
- **"Mahsulotlar"** title (was "Barcha mahsulotlar") with the **Tartiblash** sort pill on the right. Also on `/products` (kept in `?sort=`).
  Options: cheapest, most expensive, biggest discount, biggest savings, name A-Z.
- **Home product count**: 8 on desktop, 4 on phones (<= 640px).
- **Quick tiles**: 2 x 2 - Savat, Sevimlilar, Premium (-> `/premium`), Smart Card AI (-> `/smart-buy`).
- Texts added in uz / ru / en (`translations.smartbuy.js`).
