# NarxTop: Google OAuth va email tasdiqlashni sozlash

Bu versiyada **Supabase Auth ishlatilmaydi**. Google foydalanuvchining Google akkauntini tekshiradi, NarxTop serveri esa
MongoDB’da foydalanuvchi yozuvini yaratadi va NarxTop sessiya cookie’sini beradi. Email/parol orqali ro‘yxatdan
o‘tishda tasdiqlash xatini Supabase emas, NarxTop serveri SMTP orqali yuboradi.

## 1. Kerakli dasturlar va fayllar

Node.js 20 yoki yangiroq, npm va MongoDB kerak. Arxiv papkasida terminal ochib:

```powershell
npm install
Copy-Item .env.example .env.local
```

`.env.local` faylini oching. `MONGODB_URI` qatoriga MongoDB Atlas ulanish manzilingizni yozing. MongoDB Atlas’da
ma’lumotlar bazasiga ulanish ruxsati va tarmoq IP ruxsati borligini tekshiring.

## 2. Google OAuth ma’lumotlarini olish

1. [Google Cloud Console](https://console.cloud.google.com/)’da loyiha oching va **Google Auth Platform** sozlamalarini to‘ldiring.
2. Ilova foydalanuvchilarini tanlang. Ommaviy sayt bo‘lsa, test foydalanuvchilari ro‘yxati bilan cheklanmagan ishlab chiqarish holatini sozlang.
3. **Clients → Create client → Web application** orqali OAuth mijoz yarating.
4. Mahalliy ishlashda quyidagini **Authorized JavaScript origins** maydoniga qo‘shing:
   `http://127.0.0.1:5173`
5. Mahalliy ishlashda quyidagini **Authorized redirect URIs** maydoniga qo‘shing:
   `http://127.0.0.1:5173/api/auth/google/callback`
6. Google bergan Client ID va Client Secret’ni `.env.local` ichiga kiriting:

```env
GOOGLE_CLIENT_ID=Google-bergan-client-id
GOOGLE_CLIENT_SECRET=Google-bergan-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/api/auth/google/callback
FRONTEND_URL=http://127.0.0.1:5173
```

Google’dagi redirect manzili va `GOOGLE_REDIRECT_URI` belgilarigacha bir xil bo‘lishi shart. Google OAuth callback
endi to‘g‘ridan-to‘g‘ri NarxTop serveridagi `/api/auth/google/callback` manziliga keladi; Supabase callback ishlatilmaydi.

## 3. Email xatlarini sozlash

Email/parol orqali ro‘yxatdan o‘tgan foydalanuvchi NarxTop yuborgan havolani bosib emailini tasdiqlaydi. Parolni tiklash
xati ham shu SMTP sozlamalaridan foydalanadi. `.env.local` ichida quyidagilarni kiriting:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=narxtop.yuboruvchi@gmail.com
SMTP_PASS=GMAIL_APP_PASSWORD
EMAIL_FROM=NarxTop <narxtop.yuboruvchi@gmail.com>
```

Gmail ishlatsangiz, Google akkauntingizda 2 bosqichli himoyani yoqib, **App Password** yarating. Oddiy Gmail parolingizni
`SMTP_PASS` sifatida ishlatmang. Domeningizdan xat yubormoqchi bo‘lsangiz, SMTP provayderingiz bergan host, port,
foydalanuvchi va parolni kiriting.

Mahalliy sinovda SMTP hali yo‘q bo‘lsa, `EMAIL_DEV_LOG_LINKS=true` qoldiring. Tasdiqlash havolasi va tiklash kodi faqat
server terminalida ko‘rinadi. Sayt production’da ishlaganda SMTP majburiy; email ma’lumotlarini terminalga chiqarish
production’da o‘chirilgan bo‘ladi. Parolni tiklash kodi 15 daqiqa amal qiladi va beshta noto‘g‘ri urinishdan keyin bekor bo‘ladi.

Telefon raqami ixtiyoriy profil ma’lumoti bo‘lib, SMS orqali tasdiqlash talab qilinmaydi.

## 4. Sessiya kalitini yaratish

PowerShell terminalida quyidagi buyruqni ishga tushiring:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Chiqqan qiymatni `.env.local` faylidagi `AUTH_SESSION_SECRET=` qatoriga qo‘ying. Bu qiymatni hech kimga yubormang va
`VITE_` bilan boshlanadigan o‘zgaruvchiga yozmang. Google Client Secret ham faqat server `.env.local` faylida turishi
kerak.

## 5. NarxTop’ni ishga tushirish

Ikki alohida PowerShell oynasida, loyiha papkasidan:

```powershell
npm run server
```

```powershell
npm run dev
```

Brauzerda `http://127.0.0.1:5173` manzilini oching. Google orqali kirish tugmasini bosganda Google hisob tanlash
oynasi ochiladi. Google muvaffaqiyatli tekshirganidan so‘ng foydalanuvchi NarxTop’ga qaytadi. Email/parol bilan yangi
ro‘yxatdan o‘tgan foydalanuvchi esa xatdagi havolani bosib tasdiqlaydi, so‘ng saytga kiradi.

## 6. Saytni internetga joylash

Production domeningiz uchun Google Cloud Console’da quyidagilarni kiriting:

- **Authorized JavaScript origins**: `https://saytingiz.uz`
- **Authorized redirect URIs**: `https://saytingiz.uz/api/auth/google/callback`

`.env.local` yoki hosting provayderining server muhitida `FRONTEND_URL` va `GOOGLE_REDIRECT_URI`’ni xuddi shu HTTPS
manzillarga almashtiring. `NODE_ENV=production` qo‘ying va `EMAIL_DEV_LOG_LINKS=false` qiling. Bitta domen frontend va
API’ni birga xizmat qilsa, `AUTH_COOKIE_SAME_SITE=Lax` qoldiring.

Frontend alohida hostda, API boshqa hostda bo‘lsa:

- frontend build vaqtida `VITE_API_ROOT=https://api-saytingiz.uz/api` ni bering;
- serverda `FRONTEND_URL` va `CORS_ORIGINS` qiymatiga frontend manzilini yozing;
- cookie uchun `AUTH_COOKIE_SAME_SITE=None` va HTTPS ishlating;
- `GOOGLE_REDIRECT_URI` Google’dan API hostidagi `/api/auth/google/callback` manziliga borishi kerak.

Imkon bo‘lsa, frontend va API’ni bir asosiy domen ostida joylang. Ayrim brauzerlar boshqa saytdagi cookie’larni
cheklaydi.

## 7. Oldingi Supabase foydalanuvchilari va ma’lumotlari

Yangi foydalanuvchilar NarxTop’ning MongoDB bazasida saqlanadi. Oldingi Supabase Auth akkauntlari va Supabase’dagi
`user_state` ma’lumotlari avtomatik ko‘chirilmaydi. Google bilan ro‘yxatdan o‘tgan eski foydalanuvchi shu tasdiqlangan
Google email manzili orqali kirishi mumkin; NarxTop shu email bo‘yicha mavjud MongoDB foydalanuvchisini ulaydi. Oldingi
email/parol foydalanuvchisi NarxTop’da qayta ro‘yxatdan o‘tib, yangi parol tanlashi va emailini tasdiqlashi kerak.

## Muhim

- Google Client Secret, `AUTH_SESSION_SECRET`, SMTP paroli va MongoDB parolini frontend kodiga yoki ommaviy repozitoriyga qo‘ymang.
- Faqat `.env.example` — namuna fayl. Haqiqiy kalitlarni `.env.local` yoki hosting serverining maxfiy muhit sozlamalarida saqlang.
- Google orqali kirishda tasdiqlashni Google bajaradi; NarxTop Google qaytargan email `verified` ekanini tekshiradi. Google foydalanuvchisiga alohida NarxTop tasdiqlash xati yuborilmaydi.
