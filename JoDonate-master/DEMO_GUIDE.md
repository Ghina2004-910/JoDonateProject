# JoDonate — Demo & Evaluation Guide

Use this script to verify features during demonstration or grading. All demo accounts use password **`Demo1234!`** (shown on the login screen).

## Prerequisites

1. Firebase project **`jo-donate-68a86`** with Email/Password auth enabled
2. Cloud Functions deployed:
   ```bash
   firebase deploy --only functions --project jo-donate-68a86
   ```
3. `OPENAI_API_KEY` secret set for AI categorization
4. Firestore indexes deployed (includes `committeeId` + `createdAt` on `eligibilityReviews`)
5. Run app: `npx expo start` on a device or emulator with network access

## Demo 1 — AI Image Categorization

**Account:** `donor@jodonate.demo`

1. Sign in → **Add Item**
2. Enter title/description (optional keyword hint, e.g. “PlayStation console”)
3. Continue to **Upload Images** → pick a clear product photo
4. Wait for **“Analyzing image with AI…”** then a suggested category chip message
5. Go back to step 1 to override category if needed → publish

**Expected:** Category suggested from image and/or text; all 11 categories available.

**If AI fails:** Keyword fallback still suggests a category; verify Cloud Function deployment and `OPENAI_API_KEY`.

---

## Demo 2 — Committee Notifications

**Accounts:** `receiver@jodonate.demo` then `committee@jodonate.demo`

1. As **receiver**, open an available item → **Request**
2. Sign out → sign in as **committee@jodonate.demo**
3. Open **Notifications** (home bell or Profile → Notifications)
4. Tap **“New eligibility review”** → lands on **Committee Reviews**

**Expected:** Committee user receives in-app alert when a request creates an eligibility review.

**Setup tip:** Admin → **Init Committee** once; ensure committee user has `role: committee` and `committeeId: default`.

---

## Demo 3 — Donation Completion Notifications

**Accounts:** `donor@jodonate.demo`, `receiver@jodonate.demo`

1. Complete request flow: committee **approves** eligibility → donor **accepts** request (item status **Accepted**)
2. As **donor**, open **My Items** → **Mark Donated**
3. Sign in as **receiver** → **Notifications**

**Expected:**
- Receiver: **“Donation completed”** for the item
- Donor: **“Donation recorded”** confirmation

---

## Demo 4 — Password Reset

**Account:** any email account (not guest)

1. Login screen → enter email → **Forgot password?**
2. Check email for Firebase reset link

Or while signed in: **Profile → Settings → Email me a reset link**

**Expected:** Success alert; reset email received (check spam). Phone-only input shows guidance to use email.

---

## Demo 5 — Account Deletion

**Account:** use a **test account you can delete** (not shared demo roles during live demo)

1. **Profile → Delete Account**
2. Type **`DELETE`** and enter **current password**
3. Confirm → returned to onboarding; account cannot sign in again

Or **Settings → Delete account → Delete now** (uses recent session; if blocked, use Profile flow with password).

**Expected:** Firestore user data removed; Firebase Auth user deleted.

---

## Demo 6 — Full Donation Lifecycle (summary)

| Step | Actor | Action |
|------|-------|--------|
| 1 | Donor | List item (AI category optional) |
| 2 | Receiver | Request item |
| 3 | Committee | Approve eligibility |
| 4 | Donor | Accept request |
| 5 | Donor | Mark donated |
| 6 | Both | Check notifications |

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| AI categorization silent | Functions deployed to `jo-donate-68a86`; OPENAI_API_KEY set |
| No committee alert | `notifyCommitteeOfReview` deployed; committee user role + committeeId |
| Notifications empty | Signed-in user matches `toUserId`; Firestore rules allow read |
| Password reset fails | Email/Password enabled; authorized domains in Firebase Console |
| Delete requires password | Expected — enter current password in Profile delete modal |

---

## Requirement Mapping

- **FR-36** → Demo 1  
- **Committee management** → Demo 2, 6 step 3  
- **Notification workflows** → Demos 2, 3, 6  
- **Authentication (reset/delete)** → Demos 4, 5  
