/* Privacy policy + Terms of use (/privacy, /terms), in all three site languages.
 * Block shape: { h: heading, p?: [paragraphs], list?: [bullets] }.
 * NOTE: these are plain-language templates adapted from the original NarxTop build — have them reviewed
 * before you rely on them as legal documents. */
const UPDATED = "2026-10-18";

const uz = {
  privacy: {
    title: "Maxfiylik siyosati",
    lead: "Biz qanday ma’lumotlarni yig‘amiz, ulardan nima uchun foydalanamiz va ularni qanday himoya qilamiz.",
    blocks: [
      { h: "Qanday ma’lumotlar yig‘iladi", list: [
        "Hisob ma’lumotlari: ro‘yxatdan o‘tganingizda e-pochta manzili, ism va (ixtiyoriy) telefon raqami. Google orqali kirsangiz, Google hisobingizdagi ism va e-pochta olinadi.",
        "Hisobingizga bog‘langan xarid ma’lumotlari: sevimlilar, ro‘yxatlar, xaridlar tarixi, narx ogohlantirishlari, sozlamalar va (xohlasangiz) profil rasmi.",
        "Xaridni tasdiqlash uchun yuborgan chek rasmlari va undagi buyurtma ma’lumotlari tekshiruv uchun saqlanadi; ularni faqat administratorlar ko‘ra oladi. Hisobingiz o‘chirilganda ular ham o‘chiriladi.",
        "Siz yuborgan xabarlar: Aloqa sahifasi orqali yozgan matn, ismingiz va e-pochtangiz.",
        "Brauzeringizda saqlanadigan ma’lumotlar: savatdagi mahsulotlar, tanlangan til va mavzu (yorug‘/qorong‘i).",
        "Anonim signallar: qaysi mahsulot ko‘rilgani yoki savatga qo‘shilgani (shaxsni aniqlamaydi) — “Mashhur” bo‘limi uchun.",
      ] },
      { h: "Joylashuv", p: [
        "Joylashuvingiz faqat siz ruxsat bersangiz yoki o‘zingiz kiritsangiz ishlatiladi. U bizning serverda saqlanmaydi. “Yo‘lni ko‘rish” oynasida u xarita havolasini tuzish va OpenStreetMap xizmatidan atrofdagi filiallarni qidirish uchun ishlatiladi.",
      ] },
      { h: "Ma’lumotlardan foydalanish", list: [
        "Hisobingizga kirishingiz va profilingizni ko‘rsatish uchun.",
        "Savat, sevimlilar va afzal sozlamalaringizni eslab qolish hamda qurilmalar orasida sinxronlash uchun.",
        "Xabarlaringizga javob berish va xizmat sifatini yaxshilash uchun.",
      ] },
      { h: "NarxTop Premium", p: [
        "Premium obunasi uchun hisobingiz bo‘yicha holat, boshlanish va tugash sanasi hamda sovg‘a yozuvlari saqlanadi. To‘lov Click orqali amalga oshiriladi — karta ma’lumotlari NarxTop’da saqlanmaydi.",
      ] },
      { h: "Uchinchi tomon xizmatlari", p: [
        "Google OAuth Google akkauntingizni tekshiradi. NarxTop o‘z sessiyasini beradi va akkaunt hamda hisob ma’lumotlarini MongoDB’da saqlaydi. Tasdiqlash, parolni tiklash va aloqa xatlari SMTP email provayderi orqali yuboriladi. Ushbu provayderlar ma’lumotlarni o‘z siyosatlariga muvofiq qayta ishlaydi.",
      ] },
      { h: "Ma’lumotlaringizni sotmaymiz", p: [
        "Shaxsiy ma’lumotlaringiz uchinchi shaxslarga sotilmaydi va reklama maqsadida berilmaydi.",
      ] },
      { h: "Sizning huquqlaringiz", p: [
        "Hisob sahifasida ma’lumotlaringizni yuklab olishingiz, xarid ma’lumotlarini yoki butun hisobingizni o‘chirishingiz mumkin. Qo‘shimcha savollar uchun Aloqa sahifasidagi kanallar orqali murojaat qiling.",
      ] },
    ],
  },
  terms: {
    title: "Foydalanish shartlari",
    lead: "NarxTop’dan foydalanish orqali siz quyidagi shartlarga rozilik bildirasiz.",
    blocks: [
      { h: "Xizmat haqida", p: ["NarxTop — narxlarni solishtirish uchun axborot xizmati. Biz do‘konlarning o‘zi emasmiz va mahsulot sotmaymiz."] },
      { h: "Narxlarning aniqligi", p: ["Narxlar taxminiy va o‘zgarib turishi mumkin. Biz ma’lumotlarning to‘liq aniqligi yoki dolzarbligiga kafolat bermaymiz. Yakuniy narx — do‘konda ko‘rsatilgan narx."] },
      { h: "Hisob va xavfsizlik", list: [
        "Hisobingiz ma’lumotlarining xavfsizligi uchun o‘zingiz javobgarsiz.",
        "To‘g‘ri va haqiqiy ma’lumot kiritishingiz kerak.",
        "Xizmatdan noqonuniy yoki zarar yetkazuvchi maqsadlarda foydalanish mumkin emas.",
      ] },
      { h: "NarxTop Premium", list: [
        "Bepul rejada savat qiymati 1 000 000 so‘mgacha cheklangan; Premium bu cheklovni olib tashlaydi.",
        "Ishga tushirish sinovi har bir hisob uchun bir marta beriladi, pul olinmaydi va avtomatik uzaytirilmaydi.",
        "Supermarket sovg‘alari tasodifiy tanlanadi, har oy kafolatlanmaydi va kampaniya hamda zaxiraga bog‘liq.",
      ] },
      { h: "Intellektual mulk", p: ["Do‘kon nomlari va tovar belgilari ularning egalariga tegishli. NarxTop dizayni va dasturiy ta’minoti mualliflik huquqi bilan himoyalangan."] },
      { h: "Javobgarlikni cheklash", p: ["Xizmatdan foydalanish natijasida yuzaga kelgan yo‘qotishlar uchun NarxTop qonun ruxsat bergan darajada javobgar emas."] },
      { h: "O‘zgarishlar", p: ["Shartlar vaqti-vaqti bilan yangilanishi mumkin. Yangilangan shartlar shu sahifada e’lon qilinadi."] },
    ],
  },
};

const ru = {
  privacy: {
    title: "Политика конфиденциальности",
    lead: "Какие данные мы собираем, зачем используем и как защищаем.",
    blocks: [
      { h: "Какие данные собираются", list: [
        "Данные аккаунта: при регистрации — e-mail, имя и (необязательно) номер телефона. При входе через Google — имя и e-mail из вашего аккаунта Google.",
        "Данные покупок, привязанные к аккаунту: избранное, списки, история покупок, оповещения о ценах, настройки и (по желанию) фото профиля.",
        "Фото чека и данные заказа, отправленные для подтверждения покупки, хранятся для проверки; их могут видеть только администраторы. При удалении аккаунта они также удаляются.",
        "Отправленные вами сообщения: текст со страницы «Контакты», ваше имя и e-mail.",
        "Данные, хранящиеся в вашем браузере: товары в корзине, выбранный язык и тема (светлая/тёмная).",
        "Анонимные сигналы: какой товар просмотрели или добавили в корзину (без идентификации личности) — для раздела «Популярное».",
      ] },
      { h: "Местоположение", p: [
        "Местоположение используется только если вы разрешили доступ или ввели его сами. На нашем сервере оно не сохраняется. В окне «Маршрут» оно нужно для построения ссылки на карту и для поиска ближайших филиалов через OpenStreetMap.",
      ] },
      { h: "Как мы используем данные", list: [
        "Чтобы вы могли входить в аккаунт и видеть свой профиль.",
        "Чтобы запомнить корзину, избранное и настройки и синхронизировать их между устройствами.",
        "Чтобы отвечать на ваши сообщения и улучшать качество сервиса.",
      ] },
      { h: "NarxTop Premium", p: [
        "Для подписки Premium хранятся статус, даты начала и окончания и записи о подарках. Оплата проходит через Click — данные карты в NarxTop не хранятся.",
      ] },
      { h: "Сторонние сервисы", p: [
        "Google OAuth подтверждает ваш аккаунт Google. NarxTop выдаёт собственную сессию и хранит аккаунт и данные учётной записи в MongoDB. Письма для подтверждения, сброса пароля и связи отправляются через SMTP-провайдера. Эти провайдеры обрабатывают данные согласно собственным политикам.",
      ] },
      { h: "Мы не продаём ваши данные", p: ["Ваши персональные данные не продаются третьим лицам и не передаются в рекламных целях."] },
      { h: "Ваши права", p: ["На странице аккаунта вы можете скачать свои данные, удалить данные покупок или весь аккаунт. По другим вопросам свяжитесь с нами через каналы на странице «Контакты»."] },
    ],
  },
  terms: {
    title: "Условия использования",
    lead: "Пользуясь NarxTop, вы соглашаетесь со следующими условиями.",
    blocks: [
      { h: "О сервисе", p: ["NarxTop — информационный сервис для сравнения цен. Мы не являемся магазином и не продаём товары."] },
      { h: "Точность цен", p: ["Цены приблизительные и могут меняться. Мы не гарантируем полную точность и актуальность данных. Окончательной считается цена, указанная в магазине."] },
      { h: "Аккаунт и безопасность", list: [
        "Вы сами отвечаете за безопасность данных своего аккаунта.",
        "Вы должны указывать корректные и достоверные данные.",
        "Нельзя использовать сервис в незаконных или вредоносных целях.",
      ] },
      { h: "NarxTop Premium", list: [
        "В бесплатном плане стоимость корзины ограничена 1 000 000 сум; Premium снимает это ограничение.",
        "Пробный период при запуске даётся один раз на аккаунт, бесплатно и без автоматического продления.",
        "Подарки супермаркетов выбираются случайно, не гарантируются каждый месяц и зависят от кампании и наличия.",
      ] },
      { h: "Интеллектуальная собственность", p: ["Названия магазинов и товарные знаки принадлежат их владельцам. Дизайн и программное обеспечение NarxTop защищены авторским правом."] },
      { h: "Ограничение ответственности", p: ["NarxTop не несёт ответственности за убытки, возникшие при использовании сервиса, в пределах, разрешённых законом."] },
      { h: "Изменения", p: ["Условия могут время от времени обновляться. Новая редакция публикуется на этой странице."] },
    ],
  },
};

const en = {
  privacy: {
    title: "Privacy policy",
    lead: "What data we collect, why we use it and how we protect it.",
    blocks: [
      { h: "What we collect", list: [
        "Account data: when you register — your e-mail, name and (optionally) phone number. If you sign in with Google, the name and e-mail from your Google account.",
        "Shopping data tied to your account: favourites, lists, purchase history, price alerts, preferences and (if you choose) a profile photo.",
        "Receipt photos and order details you submit to confirm a purchase are stored for review and can be viewed only by admins. They are deleted when your account is deleted.",
        "Messages you send: the text from the Contact page, your name and e-mail.",
        "Data kept in your browser: the items in your cart, your chosen language and theme (light/dark).",
        "Anonymous signals: which product was viewed or added to a cart (not linked to you) — used for the “Trending” section.",
      ] },
      { h: "Location", p: [
        "Your location is used only if you allow it or enter it yourself. It is not stored on our server. In the route pop-up it is used to build the map link and to look up nearby branches through OpenStreetMap.",
      ] },
      { h: "How we use it", list: [
        "So you can sign in and see your profile.",
        "To remember your cart, favourites and preferences and sync them across devices.",
        "To answer your messages and improve the quality of the service.",
      ] },
      { h: "NarxTop Premium", p: [
        "For a Premium subscription we keep its status, start and end dates and gift records. Payment is handled by Click — NarxTop does not store card details.",
      ] },
      { h: "Third-party services", p: [
        "Google OAuth verifies your Google account. NarxTop issues its own session and stores accounts and account data in MongoDB. Confirmation, password-reset, and contact emails are sent through the configured SMTP provider. These providers process data under their own policies.",
      ] },
      { h: "We don’t sell your data", p: ["Your personal data is not sold to third parties or shared for advertising."] },
      { h: "Your rights", p: ["On your account page you can download your data, delete your shopping data or delete the whole account. For anything else, use the channels on the Contact page."] },
    ],
  },
  terms: {
    title: "Terms of use",
    lead: "By using NarxTop you agree to the following terms.",
    blocks: [
      { h: "About the service", p: ["NarxTop is an informational price-comparison service. We are not a store and we do not sell products."] },
      { h: "Price accuracy", p: ["Prices are approximate and can change. We do not guarantee that the data is fully accurate or up to date. The price shown in the store is the final price."] },
      { h: "Account and security", list: [
        "You are responsible for keeping your account details secure.",
        "You must provide correct and truthful information.",
        "The service may not be used for unlawful or harmful purposes.",
      ] },
      { h: "NarxTop Premium", list: [
        "On the free plan a basket is limited to 1,000,000 UZS; Premium removes this limit.",
        "The launch trial is given once per account, is free and does not renew automatically.",
        "Supermarket gifts are chosen at random, are not guaranteed every month and depend on campaign availability and stock.",
      ] },
      { h: "Intellectual property", p: ["Store names and trademarks belong to their owners. NarxTop’s design and software are protected by copyright."] },
      { h: "Limitation of liability", p: ["To the extent permitted by law, NarxTop is not liable for losses resulting from the use of the service."] },
      { h: "Changes", p: ["These terms may be updated from time to time. The current version is always published on this page."] },
    ],
  },
};

export const LEGAL = { uz, ru, en };
export const LEGAL_UPDATED = UPDATED;
