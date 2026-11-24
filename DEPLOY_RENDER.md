# Deploying PAL – Click it on Render

This guide takes the app from the GitHub repo to a live HTTPS URL on [Render](https://render.com), using MongoDB Atlas for the database.

## 1. How the app is deployed

- One Node 22+ process serves everything: the API (`/api`), the built React site (`dist/`) and uploaded images (`/uploads/*`).
- The database is **MongoDB Atlas**. It is hosted separately from the app.
- Gallery photos, reels and expense receipts are written to disk in `DATA_DIR`, not to the database.
- Build command: `npm install && npm run build`
- Start command: `npm start`

> Serverless hosts (Vercel, Netlify, Cloudflare Pages) will not work. The app runs a long-lived `app.listen()` server and writes uploads to disk.

## 2. Free vs paid: the uploads caveat

| Render plan | Persistent disk | What happens to uploads |
| --- | --- | --- |
| Free | No | Files in `DATA_DIR` are deleted on every restart, redeploy and idle spin-down. |
| Starter or higher | Yes | Files on the disk mount survive restarts and redeploys. |

On the free plan:

- All records (inquiries, bookings, payments, expenses, content) survive, because they are in Atlas.
- Uploaded gallery photos, reels and receipts are lost on restart. The database still lists them, so the site shows broken images.
- The sample gallery images are also lost. They are only regenerated when the gallery collection is empty.
- Event card photos in `public/imgs` are part of the repo and always load.
- The service sleeps after about 15 minutes without traffic. The next request takes 30–60 seconds.

Use the free plan for a demo or trial. Use a paid plan with a disk for real use.

## 3. Prerequisites

- The code is on GitHub at `https://github.com/devenkapadia/palclickit` (branch `main`).
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account.
- A [Render](https://render.com) account, signed up with GitHub for the easiest repo access.

## 4. Step 1: Set up MongoDB Atlas

1. Create a free **M0** cluster.
2. Go to **Database Access → Add New Database User**.
   - Choose password authentication.
   - Use a strong password. Prefer letters and digits so you don't need URL-encoding.
   - Give the user the **Read and write to any database** role.
3. Go to **Network Access → Add IP Address**.
   - Render does not give fixed outbound IPs on the free plan, so choose **Allow access from anywhere** (`0.0.0.0/0`).
   - This is only safe with a strong database password.
4. Go to **Database → Connect → Drivers → Node.js** and copy the connection string. It looks like this:

   ```
   mongodb+srv://<db_user>:<db_password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```

5. Replace `<db_user>` and `<db_password>` with the real values. If the password contains `@ : / ? # %`, URL-encode those characters.

The database `pal` is created automatically on first start.

## 5. Step 2: Create the Render web service

1. In Render, click **New → Web Service**.
2. Connect your GitHub account and select `devenkapadia/palclickit`.
3. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Name | `palclickit` (this becomes `palclickit.onrender.com`) |
   | Region | The one closest to your customers (e.g. Singapore) |
   | Branch | `main` |
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free for a demo, or Starter with a disk for real use |

## 6. Step 3: Add environment variables

In the service, open **Environment → Add Environment Variable** and add:

| Key | Value | Notes |
| --- | --- | --- |
| `NODE_VERSION` | `22` | The app needs Node 22 or higher. |
| `MONGODB_URI` | your Atlas connection string | Required. The app exits without it. |
| `MONGODB_DB` | `pal` | Database name. |
| `ADMIN_EMAIL` | your login email | Used only on first start. |
| `ADMIN_PASSWORD` | a strong password | Used only on first start. If empty, a random password is printed once in the logs. |
| `DATA_DIR` | `/tmp/data` on Free, `/var/data` with a disk | Where uploads and receipts are stored. |
| `APP_TIMEZONE` | `Asia/Kolkata` | |
| `COOKIE_SECURE` | `true` | The login cookie is HTTPS-only. Render serves HTTPS. |
| `TRUST_PROXY` | `1` | Needed so rate limiting sees real client IPs behind Render's proxy. |

Do not set `PORT`. Render sets it automatically.

## 7. Step 4 (paid plans only): Add a persistent disk

1. In the service, open **Disks → Add Disk**.
2. Set:
   - **Name:** `data`
   - **Mount Path:** `/var/data`
   - **Size:** 1 GB or more
3. Make sure `DATA_DIR=/var/data`.

A service with a disk cannot scale to more than one instance, and a redeploy briefly stops the service. That is fine for this app.

## 8. Step 5: Deploy and verify

1. Click **Create Web Service**. Render clones the repo, runs the build and starts the app. The first build takes a few minutes.
2. Open the **Logs** tab and look for these lines:

   ```
   Connected to MongoDB database "pal"
   PAL admin account created
   PAL server running → http://localhost:<port>
   ```

3. Open `https://<name>.onrender.com/` to see the public site.
4. Open `https://<name>.onrender.com/admin` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## 9. Step 6: After the first login

1. Change the password under **Settings**.
2. Fill in WhatsApp, phone, email and Instagram under **Website Content → Contact & social**. Empty fields are hidden on the public site.
3. Upload real gallery photos, then hide or delete the sample illustrations.
4. Submit a test inquiry on the public form and confirm it appears as *New* in the admin.

## 10. Updating the site

Render redeploys automatically on every push to `main`:

```bash
git add .
git commit -m "your change"
git push
```

To turn this off, set **Auto-Deploy** to *Off* in the service settings and use **Manual Deploy** instead.

## 11. Custom domain (optional)

1. In the service, open **Settings → Custom Domains → Add Custom Domain**.
2. Add the DNS records Render shows at your domain registrar (a CNAME for `www`, and an A record or ALIAS for the root domain).
3. Render issues the TLS certificate automatically once DNS resolves.

## 12. Keeping a free service awake (optional)

Point a free uptime monitor such as UptimeRobot at `https://<name>.onrender.com/` with a 10–14 minute interval. This avoids the cold start. It uses up your free monthly instance hours, so check Render's current free-plan limits.

## 13. Backups

- **Database:** the Atlas M0 free tier has no automated backups. Run `mongodump` on a schedule, or upgrade the cluster.
- **Files:** with a paid disk, take regular Render disk snapshots or download `DATA_DIR`.

## 14. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Logs show `MONGODB_URI is not set` | Add the variable and redeploy. |
| Logs show `Could not connect to MongoDB` | Atlas Network Access doesn't allow Render (add `0.0.0.0/0`), or the password is wrong or not URL-encoded. |
| Build fails on syntax or engine errors | Set `NODE_VERSION=22`. |
| Login succeeds but you return to the login page | `COOKIE_SECURE=true` over plain HTTP. Use the `https://` URL. |
| `Cross-origin request blocked` (403) | You're calling the API from a different origin. Use the same domain for the site and the API. |
| Uploaded images disappear after a while | The service is on the Free plan, or `DATA_DIR` is not on the disk mount. |
| First page load takes about a minute | The Free instance was asleep. See section 12. |
| Forgot the admin password | Open the service **Shell** (paid plans) and run `npm run reset-admin -- you@example.com NewPassword`. On Free, reset it with a one-off local run against the same `MONGODB_URI`. |
| Changed `ADMIN_PASSWORD` but login still uses the old one | The owner account is created only once. Use `reset-admin` or the Settings page. |
