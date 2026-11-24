# PAL – Click it

Public website + private business dashboard for **PAL – Click it**, a photobooth brand in Vadodara, Gujarat.

- **`/`** – marketing site: hero, experience, events, gallery with lightbox, packages, booking flow, FAQ, inquiry form with WhatsApp hand-off.
- **`/admin`** – password-protected CRM: inquiries (table + pipeline), follow-ups, bookings with payments, calendar, expenses, finance, reports (CSV), gallery and website content management.

Stack: React 19 · TypeScript · Tailwind CSS 4 · Vite · Express 5 · MongoDB Atlas · Recharts.

---

## 1. First-time setup

### MongoDB Atlas (free tier is plenty)
1. In Atlas open your cluster → **Connect → Drivers → Node.js** and copy the connection string.
2. **Database Access** – make sure you have a database user; **Network Access** – allow your current IP (and your server's IP once deployed).
3. Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection string. Replace `<db_password>` with the real password (URL-encode `@ : / ? # %`). |
| `MONGODB_DB` | Database name (default `pal`). Created automatically. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Owner login, created on first start only. If the password is empty a random one is printed once in the console. |
| `PORT` | API/web port (default `4000`). |
| `DATA_DIR` | Where uploaded gallery photos and private expense receipts are stored (default `data`). |
| `COOKIE_SECURE`, `TRUST_PROXY` | Set `COOKIE_SECURE=true` and `TRUST_PROXY=1` when serving over HTTPS behind a proxy. |

> Never commit `.env`. It is already in `.gitignore`.

### Install and run
```bash
npm install
npm run dev        # API on :4000, site on http://localhost:5173
```
Sign in at **http://localhost:5173/admin**.

Forgot the password?
```bash
npm run reset-admin -- you@example.com NewStrongPassword
```

## 2. Production
```bash
npm run build      # typechecks, then builds the site into dist/
npm start          # serves site + API together on $PORT
```
Deploy anywhere that runs Node 22+ (Render, Railway, Fly.io, a VPS). Requirements:
- A **persistent disk** mounted at `DATA_DIR` – gallery photos and receipts are files, not database rows.
- HTTPS, with `COOKIE_SECURE=true` and `TRUST_PROXY=1`.
- The host's outbound IP allowed in Atlas **Network Access**.

## 3. Using it day to day
- **Add Inquiry** (top-left button, always visible) for calls, DMs and walk-ins. Website enquiries arrive automatically as *New*.
- Open an inquiry → schedule follow-ups, log calls/WhatsApp chats, change status, **Convert to booking** when confirmed.
- **Bookings** – record payments (advance / partial / final) and add event expenses. Mark *Completed* when done.
- **Finance** – booked revenue vs cash received vs outstanding; net profit is *cash received − expenses*; per-event realized profit appears once an event is Completed.
- **Website Content** – hero text, WhatsApp number, Instagram, packages and prices, FAQs and event cards. Changes are live immediately.
- **Gallery** – upload photos with a category. Placeholder illustrations ship by default; hide or delete them once you have real photos.
- **Reports** – preview and download any report as CSV (opens in Excel).

### Contact details
No phone, WhatsApp or email is hard-coded. Fill them in under **Website Content → Contact & social**; empty fields are hidden from the public site. The Instagram handle defaults to `@palclickit`.

### Your real logo
No logo file was supplied, so [`src/components/Logo.tsx`](src/components/Logo.tsx) draws an SVG recreation. To use your actual artwork, save it as `public/logo.png` and set `USE_IMAGE = true` in that file.

## 4. Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + Vite dev server with reload |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | Client + server type checks |
| `npm test` | 40 API checks against a disposable in-memory MongoDB |
| `npm run test:atlas` | Same checks against Atlas in a temporary database that is dropped afterwards |
| `npm run demo` | Run the built app on http://localhost:4200 with throwaway data (`owner@pal.test` / `TestPass123`) |
| `npm run reset-admin -- email password` | Reset owner credentials |

## 5. How the data works
- Collections: admin users, sessions, inquiries, inquiry logs, follow-ups, events (bookings), event payments, expenses, packages, FAQs, event cards, gallery images and categories, settings, activity log.
- One inquiry → at most one booking. One booking → many payments and many expenses. Follow-ups and logs belong to an inquiry.
- Deleting an inquiry keeps its booking; deleting a booking keeps its expenses (they become general expenses), so financial history is never silently lost.
- Payment status is always **derived** from the payment records, never typed in by hand.

## 6. Security notes
- Single-owner login; sessions are random tokens stored hashed server-side in an HttpOnly, SameSite=Strict cookie.
- Every `/api/admin/*` route requires a valid session; receipts are only served through an authenticated route.
- Login and the public inquiry endpoint are rate limited; the public form has a honeypot; cross-origin writes are rejected.
- Strict Content-Security-Policy – fonts are bundled, no third-party scripts.
