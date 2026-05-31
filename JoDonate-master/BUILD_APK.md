# بناء APK لـ JoDonate

## الطريقة الموصى بها: EAS Build (سحابي)

### 1) تثبيت EAS CLI (مرة واحدة)
```bash
npm install -g eas-cli
```

### 2) تسجيل الدخول لحساب Expo
```bash
eas login
```
أنشئ حساب مجاني على https://expo.dev إذا لم يكن لديك حساب.

### 3) بناء APK
```bash
cd C:\Users\a3m20\Desktop\JoDonate-master
npm run build:apk
```

أو للإنتاج:
```bash
npm run build:apk:prod
```

### 4) تحميل الملف
- بعد اكتمال البناء (10–20 دقيقة)، افتح الرابط الذي يظهر في التيرمنال
- أو ادخل إلى https://expo.dev → مشروع **jodonate** → Builds
- حمّل ملف `.apk` وثبّته على أندرويد

---

## ملاحظات مهمة

1. **Firebase**: تأكد أن `lib/firebase.ts` فيه إعدادات المشروع الصحيحة قبل البناء.
2. **Email/Password**: فعّل Email/Password في Firebase Console → Authentication.
3. **Firestore rules**: انشر القواعد:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```
4. **أول بناء**: قد يطلب EAS إنشاء Android keystore — اختر **Let Expo handle it**.

---

## بديل محلي (يتطلب Android Studio)

```bash
npx expo prebuild --platform android
cd android
.\gradlew assembleRelease
```

الملف يكون في:
`android\app\build\outputs\apk\release\app-release.apk`

---

## أوامر سريعة

| الأمر | الوصف |
|-------|--------|
| `npm run build:apk` | APK للاختبار (preview) |
| `npm run build:apk:prod` | APK إنتاج |
