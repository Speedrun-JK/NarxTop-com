# v77 - sign-in / sign-up fixes

## Password show/hide
- **Real bug:** the password inputs were never `type="password"` (the `Field` default type was `text`), so the eye changed nothing
  and the password was always visible. Now the input is masked by default and the eye toggles `password` <-> `text`.
- New complete eye / crossed-eye icon (animated slash), proper hit area, native browser reveal buttons (Edge) hidden.

## Phone number with country picker (`src/components/auth/PhoneField.jsx`, `shared/core/phone.js`)
- Collision fixed: the "+998" is no longer an overlay on the input - flag + code is a real button inside one field shell.
- 234 countries/territories with flag, localised name (uz/ru/en), dial code, search (name, ISO, code), keyboard support.
- Number is spaced per country while typing (Uzbekistan `90 123 45 67`: 2-digit operator code + 7 digits), caret stays put,
  backspace over a space works, pasting `+82 10...`, `998901234567` or `0901234567` is understood (country switches automatically).
- Stored as E.164 (`+998901234567`) in the Supabase user metadata. Phone stays optional; if typed it must have the right length for the country.
- Profile page uses the same field (the old Uzbek-only formatter would have corrupted foreign numbers).

## Admin panel -> Users
- New "Telefon . davlat" column: flag, formatted number and country name; search by phone/country; CSV has Telefon + Davlat.
- Phone is synced to MongoDB on sign-in (and by "Supabase'dan import" for old users).

## Notes
- Flag pictures come from flagcdn.com (`https://flagcdn.com/w40/uz.png`); if they cannot load, a neat ISO badge is shown instead.
- Styles: `src/styles/auth-phone.css` only (scoped to `.nt-phone*` / `.nt-password-eye`); `admin.css` got the extra column.
