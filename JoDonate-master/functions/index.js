// Import Firebase Functions v2 callable HTTPS function helper
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const OpenAI = require("openai");

if (!getApps().length) {
  initializeApp();
}

const adminDb = getFirestore();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const ALLOWED = [
  "Food & Grocery",
  "Clothes & Fashion",
  "Services",
  "Company Equipment",
  "Games",
  "Electronics",
  "Sports & Fitness",
  "Education & Training",
  "Pets & Accessories",
  "Beauty & Health",
  "Books",
];

const CATEGORY_ALIASES = {
  food: "Food & Grocery",
  grocery: "Food & Grocery",
  groceries: "Food & Grocery",
  clothes: "Clothes & Fashion",
  clothing: "Clothes & Fashion",
  fashion: "Clothes & Fashion",
  apparel: "Clothes & Fashion",
  services: "Services",
  service: "Services",
  equipment: "Company Equipment",
  office: "Company Equipment",
  furniture: "Company Equipment",
  games: "Games",
  gaming: "Games",
  game: "Games",
  electronics: "Electronics",
  electronic: "Electronics",
  sports: "Sports & Fitness",
  fitness: "Sports & Fitness",
  education: "Education & Training",
  training: "Education & Training",
  pets: "Pets & Accessories",
  pet: "Pets & Accessories",
  beauty: "Beauty & Health",
  health: "Beauty & Health",
  books: "Books",
  book: "Books",
  accessories: "Beauty & Health",
  plants: "Food & Grocery",
};

const CATEGORY_HINTS =
  "Food & Grocery (food, groceries), Clothes & Fashion (clothing, shoes), " +
  "Services (repairs, labor), Company Equipment (office/industrial gear), Games (toys, consoles), " +
  "Electronics (phones, laptops, TVs), Sports & Fitness (sport gear), " +
  "Education & Training (courses, tutoring), Pets & Accessories (pet items), " +
  "Beauty & Health (cosmetics, wellness), Books (books, textbooks).";

function pickFallbackCategory() {
  return "Services";
}

function normalizeCategory(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return pickFallbackCategory();
  if (ALLOWED.includes(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  const exact = ALLOWED.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];

  for (const [key, category] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(key) || key.includes(lower)) return category;
  }

  for (const category of ALLOWED) {
    const catLower = category.toLowerCase();
    if (lower.includes(catLower) || catLower.includes(lower)) return category;
  }

  return pickFallbackCategory();
}

async function collectCommitteeRecipientIds(committeeId) {
  const recipientIds = new Set();

  const membersSnap = await adminDb
    .collection("committeeMembers")
    .where("committeeId", "==", committeeId)
    .get();
  membersSnap.forEach((docSnap) => {
    const userId = docSnap.data()?.userId;
    if (userId) recipientIds.add(String(userId));
  });

  const committeeSnap = await adminDb.collection("users").where("role", "==", "committee").get();
  committeeSnap.forEach((docSnap) => recipientIds.add(docSnap.id));

  return recipientIds;
}

exports.categorizeItemFromImage = onCall(
  {
    cors: true,
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    const { imageUrl } = request.data || {};

    if (!imageUrl || typeof imageUrl !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid imageUrl");
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    try {
      const prompt =
        "Classify the donation item in the image into exactly ONE category. " +
        "Valid categories: " +
        ALLOWED.join(", ") +
        ". Hints: " +
        CATEGORY_HINTS +
        " Return ONLY the category name exactly as written in the valid list.";

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an image classifier for a donation app." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0,
      });

      const raw = (response.choices?.[0]?.message?.content || "").trim();
      const cleaned = raw.replace(/^["']|["']$/g, "").trim();
      const category = normalizeCategory(cleaned);

      return {
        category,
        aiUsed: true,
        note: "OpenAI categorization succeeded",
      };
    } catch (err) {
      return {
        category: pickFallbackCategory(),
        aiUsed: false,
        note: "Fallback used (OpenAI unavailable / quota)",
      };
    }
  },
);

exports.notifyCommitteeOfReview = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const {
    reviewId,
    requestId,
    itemId,
    requesterId,
    requesterName,
    committeeId = "default",
  } = request.data || {};

  if (!reviewId || !requestId || !itemId || !requesterId) {
    throw new HttpsError("invalid-argument", "Missing review notification fields.");
  }

  const itemSnap = await adminDb.collection("items").doc(String(itemId)).get();
  const itemTitle = itemSnap.exists ? itemSnap.data()?.title ?? "a donation" : "a donation";

  const recipientIds = await collectCommitteeRecipientIds(String(committeeId));
  recipientIds.delete(String(requesterId));

  if (recipientIds.size === 0) {
    return { notified: 0 };
  }

  const batch = adminDb.batch();
  for (const toUserId of recipientIds) {
    const notifRef = adminDb.collection("notifications").doc();
    batch.set(notifRef, {
      toUserId,
      fromUserId: String(requesterId),
      title: "New eligibility review",
      body: `${String(requesterName || "Someone")} requested "${itemTitle}". Review recipient eligibility.`,
      type: "committee_review_pending",
      itemId: String(itemId),
      requestId: String(requestId),
      reviewId: String(reviewId),
      committeeId: String(committeeId),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return { notified: recipientIds.size };
});
