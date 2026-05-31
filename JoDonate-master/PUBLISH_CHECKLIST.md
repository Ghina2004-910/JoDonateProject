# JoDonate — Publish checklist

## Firebase project

The mobile app connects to **`jo-donate-68a86`** (`lib/firebase.ts`). Deploy all backend assets to this project:

```bash
firebase login
firebase use jo-donate-68a86
```

## Firestore & Storage

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project jo-donate-68a86
```

Indexes include `eligibilityReviews` by `committeeId` + `createdAt` (committee-scoped review lists).

## Cloud Functions (AI + committee alerts)

```bash
cd functions && npm install && cd ..
firebase functions:secrets:set OPENAI_API_KEY --project jo-donate-68a86
firebase deploy --only functions --project jo-donate-68a86
```

Functions:

- `categorizeItemFromImage` — GPT-4o-mini vision categorization
- `notifyCommitteeOfReview` — committee in-app notifications

## Authentication

1. Enable **Email/Password** in Firebase Console → Authentication → Sign-in method
2. Add app domains under **Authorized domains** (localhost, production host)
3. Configure email templates for password reset (optional branding)

## First admin & committee

1. Sign up a normal account or use demo admin after first demo login creates users
2. Firestore: set `users/{uid}.role` to `admin`
3. App → Profile → **Admin** → **Init Committee**
4. Set committee users: `role: committee`, `committeeId: default`, and/or `committeeMembers` doc

Demo accounts auto-provision on first login (`lib/demo-accounts.ts`); password `Demo1234!`.

## Pre-demo verification

Follow **[DEMO_GUIDE.md](./DEMO_GUIDE.md)** on a physical device or emulator before evaluation.

## EAS / stores

1. `eas build --platform all`
2. Configure `app.json` bundle IDs, icons, privacy strings (camera, photos, location, notifications)
3. Test push on a physical device (not Expo Go for production push)

## Security

- Rotate any leaked API keys if repo was public
- Review Firestore rules after schema changes
- Do not commit `.env` with secrets
- Account deletion removes Firestore data then Firebase Auth user (`lib/account-deletion.ts`)

## Documentation

- **README.md** — feature list aligned with implementation
- **DEMO_GUIDE.md** — evaluation/demo scripts
