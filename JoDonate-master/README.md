# JoDonate

Expo / React Native donation platform for Jordan, backed by Firebase (Auth, Firestore, Cloud Functions) and Cloudinary for images.

## Implemented Features

### F1 – User Authentication
- Email/password sign-up and sign-in (Firebase Auth)
- Email verification gate for requests and publishing
- Password reset via email (Login → Forgot password, Settings → Email me a reset link)
- Account deletion with Firestore cleanup (Profile → Delete Account; requires typing `DELETE` + current password)
- Quick demo login roles on the login screen (dev / `EXPO_PUBLIC_DEMO_LOGIN=true`)

### F2 – Item Listing & AI Categorization (FR-36)
- Donors add items with images, descriptions, categories, and contact info
- **Keyword categorization** from title/description on step 1
- **AI image categorization** via Cloud Function `categorizeItemFromImage` (GPT-4o-mini Vision) after the first photo upload on step 2
- All **11 donation categories** supported with shared keyword + alias matching
- Items store `committeeId` derived from city for committee routing

### F3 – Browse Items
- Home feed, category browse, search, and location-aware filtering

### F4 – Request Item
- Beneficiaries request available items; requests create eligibility reviews for committee

### F5 – Accept / Reject Requests
- Donors accept/reject after committee eligibility approval
- In-app notifications to requester and owner

### F6 – Item Status Lifecycle
- **Available → Requested → Accepted → Donated**
- Marking an item **Donated** notifies the approved beneficiary and records a completion notice for the donor

### F7 – In-App Notifications
Central notification service (`lib/notifications.ts`) covers:

| Event | Recipient |
|-------|-----------|
| New donation request | Item owner |
| Committee review pending | Committee members (`committeeId`-scoped) |
| Eligibility approved/rejected | Requester (+ owner when approved) |
| Request approved/rejected | Requester |
| Item marked donated | Beneficiary + donor confirmation |

Push token registration exists but is optional; the app uses **Firestore in-app notifications** by default.

### F8 – Committee Management
- `committeeId` on users, items, and eligibility reviews
- Committee members see reviews for their committee; admins see all
- Admin panel: init default committee, assign roles, manual committee assignment

### F9 – User Profile & Settings
- Profile editing, password change (re-auth), notification preferences, privacy toggles

## Architecture

```
Mobile App (Expo Router)
  ├── Firebase Auth / Firestore (client SDK)
  ├── Cloudinary (image upload)
  └── Callable Cloud Functions (us-central1)
        ├── categorizeItemFromImage  — OpenAI vision categorization
        └── notifyCommitteeOfReview  — committee alerts (Admin SDK)
```

Firebase project used by the app: **`jo-donate-68a86`** (see `lib/firebase.ts`).

## Demo & Evaluation

See **[DEMO_GUIDE.md](./DEMO_GUIDE.md)** for step-by-step demo scripts (AI categorization, committee alerts, donation notifications, password reset, account deletion).

Demo accounts (password for all: `Demo1234!`):

| Role | Email |
|------|-------|
| Admin | admin@jodonate.demo |
| Committee | committee@jodonate.demo |
| Donor | donor@jodonate.demo |
| Receiver | receiver@jodonate.demo |
| Guest | guest@jodonate.demo |

## Deploy Checklist

See **[PUBLISH_CHECKLIST.md](./PUBLISH_CHECKLIST.md)** for Firebase rules, indexes, Cloud Functions, and store build steps.

### Cloud Functions (required for AI + committee alerts)

```bash
firebase deploy --only functions --project jo-donate-68a86
firebase functions:secrets:set OPENAI_API_KEY --project jo-donate-68a86
```

### Firestore indexes

```bash
firebase deploy --only firestore:indexes --project jo-donate-68a86
```

## Development

```bash
npm install
npx expo start
```

Set `SKIP_FIREBASE_AUTH = false` in `lib/dev-auth.ts` for real Firebase Auth (default).

## Functional Requirements Traceability

| Requirement | Implementation |
|-------------|----------------|
| FR-36 AI categorization | `functions/index.js` + `lib/ai-categorization.ts` + `add-item.tsx` |
| Committee notifications | `notifyCommitteeOfReview` + `lib/eligibility-reviews.ts` |
| Committee routing | `lib/committees.ts`, `committee/reviews.tsx` |
| Donation completion alerts | `lib/donation-lifecycle.ts`, `my-items.tsx` |
| Password reset | `lib/auth-password.ts`, login + settings |
| Account deletion | `lib/account-deletion.ts`, profile + settings |
