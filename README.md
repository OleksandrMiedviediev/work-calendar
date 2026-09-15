# Work Calendar — multi-user

Next.js app for Amazon work schedules: PDF/image → text/OCR → shift parser → Apple Calendar.

## Features
- Registration and login with email/password.
- HTTP-only signed session cookie (30 days).
- Every calendar belongs to the logged-in user.
- PDF.js text extraction with automatic Tesseract OCR fallback.
- PNG/JPG upload.
- Shift preview/edit/delete.
- `.ics` download.
- Personal `webcal://` Apple Calendar feed.
- MongoDB persistence.

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```

Required variables:
- `MONGODB_URI`
- `MONGODB_DB`
- `AUTH_SECRET` — long random secret
- `CALENDAR_BASE_URL` — production URL, e.g. `https://your-project.vercel.app`

## Vercel
Push the project to GitHub, import it into Vercel, then add the same environment variables under Settings → Environment Variables and redeploy. Vercel documents environment variables and recommends keeping secrets server-side, not in `NEXT_PUBLIC_*`. citeturn0search0turn0search1

## Security
- Passwords are bcrypt-hashed.
- Session cookie is HTTP-only and signed.
- Calendar creation requires an authenticated session.
- Calendar feed token is a secret URL; anyone who has the URL can subscribe to that calendar. Do not publish it.
- Database credentials and `AUTH_SECRET` must never use `NEXT_PUBLIC_`.

## Next planned additions
- Google and Apple OAuth via Auth.js.
- Forgot/reset password email flow.
- Persistent calendar token so uploading a new PDF updates the same Apple subscription.
- Schedule history and visual diff between old/new PDFs.
- More robust grid-aware Amazon parser for OCR output.
- User profile and multiple calendars per account.
