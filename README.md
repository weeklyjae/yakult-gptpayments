## Yakult GPT Payments – React App

This is a small React + Vite single page app for collecting monthly Yakult GPT payments and receipt proofs from a **whitelisted** set of users.

Users sign in with **Google**, upload a receipt, and the app tracks which months have been paid. The UI is designed to be **mobile‑first** with a modern glowing aesthetic.

### Firebase Configuration

The app uses **Firebase** for authentication (Google) and Firestore as the primary database.

Create a Firebase project and a Web App, enable Google sign‑in, then create the following environment variables for Vite:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

In local development, you can place these in a `.env` file at the project root (do **not** commit secrets):

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

On Cloudflare Pages, configure these same names as **Environment Variables** in the project settings. The app reads them via `import.meta.env` in `src/firebase.js`.

### Cloudflare Pages + R2 Deployment

This project is designed to be deployed on **Cloudflare Pages** with a built‑in API for uploads backed by **R2 object storage**.

#### 1. Build settings

- Build command: `npm run build`
- Build output directory: `dist`
- Functions directory: `functions`

#### 2. Create an R2 bucket

1. In Cloudflare, go to **R2** and create a bucket, e.g. `yakult-gpt-receipts`.
2. In your Cloudflare Pages project, go to **Settings → Functions → R2 bindings** and add:
   - Binding name: `RECEIPTS_BUCKET`
   - Bucket: your new R2 bucket
3. (Optional) If you expose the bucket via a public domain or R2 public bucket URL, add an env var:
   - `RECEIPTS_PUBLIC_BASE_URL=https://your-public-r2-endpoint`

The upload API is implemented in `functions/api/upload-receipt.js` and will be available at `/api/upload-receipt` from the frontend.

#### 3. Environment variables on Cloudflare

In your Cloudflare Pages project **Environment Variables** (for the production environment), add all of the `VITE_FIREBASE_*` variables listed above and, optionally, `RECEIPTS_PUBLIC_BASE_URL`.

#### 4. Whitelisting users

Edit `src/config/whitelist.js` and add the **exact** Google email addresses that are allowed to access the app. Any non‑whitelisted user who signs in with Google will be signed out and shown a \"not authorized\" message.


