# الخطوة 02 — المصادقة: `AuthController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول والتزم بيهم حرفيًا. الخطوة دي: **AuthController بس** + جداول المستخدمين والتوكنات + JWT. لا تعمل إدارة المستخدمين (دي خطوة 03).

النظام **تسجيل دخول فقط** — مفيش تسجيل حساب جديد ولا "نسيت كلمة المرور" من الواجهة.

---

## 1) الـ Entities

```csharp
User {
  string Id;            // مثال للـ seed: "u-admin"
  string Name;          // max 80
  string Email;         // lowercase, unique index
  string Phone;         // max 20, "" افتراضي
  string Role;          // Admin | WarehouseManager | Cashier | Accountant
  string PasswordHash;  // PasswordHasher<User> من Microsoft.AspNetCore.Identity
  bool IsActive;
  DateTime? LastLoginAt;
  int FailedLoginCount; DateTime? LockoutEndAt;
  DateTime CreatedAt; DateTime UpdatedAt;
  ICollection<UserPermission> Permissions; // (UserId, Permission) PK مركب
}

RefreshToken {
  string Id; string UserId;
  string TokenHash;      // SHA-256 للتوكن — ممنوع تخزين التوكن نفسه
  string FamilyId;       // سلسلة التدوير (rotation family)
  string DeviceId; string DeviceInfo;  // max 100 / 300
  bool RememberMe;
  DateTime CreatedAt; DateTime ExpiresAt;
  DateTime? RevokedAt; string? ReplacedByTokenId; string? RevokeReason;
}
```

## 2) الـ JWT

- Access token: **15 دقيقة**. HMAC-SHA256، الإعدادات في `Jwt:{Issuer,Audience,Key}` (المفتاح من User Secrets / env var، مش في الريبو).
- Claims: `sub` (userId)، `name`، `email`، `role`، و claim `perm` متكرر لكل صلاحية، و `jti`.
- **الفرونت بيقرا `exp` من التوكن** عشان يجدد قبل الانتهاء — لازم يكون JWT عادي قابل للـ decode.
- `ClockSkew = 30s`.
- Refresh token: 64 byte عشوائي Base64Url. مدته **يوم واحد**، أو **30 يوم** لو `rememberMe = true`.

## 3) الـ Endpoints

Route الأساسي: `api/auth`. كلهم `[AllowAnonymous]` ما عدا `me`.

### 3.1 `POST /api/auth/login`
Body:
```json
{ "email": "admin@xturbo.com", "password": "Admin@123", "rememberMe": true, "deviceInfo": "Chrome 131 on Windows", "deviceId": "b7c1…" }
```
الخطوات:
1. Normalize الإيميل (trim + lowercase).
2. لو المستخدم مش موجود **أو موقوف (`IsActive=false`)** **أو** الباسورد غلط ← **401** `البريد الإلكتروني أو كلمة المرور غير صحيحة` (نفس الرسالة في التلات حالات — ماتكشفش السبب).
3. Lockout: بعد **5** محاولات غلط متتالية يتقفل 15 دقيقة ← **429** `تم إيقاف الدخول مؤقتًا بسبب محاولات متكررة، حاول بعد 15 دقيقة`. النجاح بيصفر العداد.
4. Rehash لو `PasswordVerificationResult.SuccessRehashNeeded`.
5. حدّث `LastLoginAt`.
6. أنشئ refresh token جديد (Family جديدة) مربوط بالـ `deviceId`. لو نفس `deviceId` عنده توكنات قديمة شغالة — اعمل لها revoke (`RevokeReason = "relogin"`).
7. Response ← 200:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ…",
    "refreshToken": "kq9…",
    "userId": "u-admin",
    "email": "admin@xturbo.com",
    "userName": "أحمد حسن",
    "role": "Admin",
    "permissions": ["Dashboard.View", "Reports.View", "…"],
    "expiresAtUtc": "2026-11-09T10:30:00Z"
  }
}
```
`expiresAtUtc` = وقت انتهاء الـ **access token**.

Validation (422): `email` مطلوب → `البريد الإلكتروني مطلوب`، `password` مطلوب → `كلمة المرور مطلوبة`.

### 3.2 `POST /api/auth/refresh-token`
Body: `{ "refreshToken": "…", "deviceInfo": "…", "deviceId": "…" }`
- دوّر على التوكن بالـ hash.
- لو مش موجود / منتهي / المستخدم موقوف أو اتمسح ← **401** `انتهت صلاحية الجلسة`.
- **Reuse detection**: لو التوكن متعمله revoke قبل كده (يعني حد بيستخدم توكن قديم) ← اعمل revoke للـ Family كلها و **401** `انتهت صلاحية الجلسة`.
- Rotation: revoke القديم (`ReplacedByTokenId`) وأنشئ جديد في **نفس الـ Family** بنفس `RememberMe`، والـ `ExpiresAt` الجديد = نفس مدة الـ remember من دلوقتي.
- الـ access token الجديد بيتبني من **بيانات المستخدم الحالية في الداتابيز** (عشان تغيير الصلاحيات يسري خلال 15 دقيقة).
- Response نفس شكل الـ login بالظبط.

### 3.3 `POST /api/auth/logout`
Body: `{ "refreshToken": "…" }`
- **مهم:** الفرونت بيبعته **من غير** Authorization header — لازم يكون `AllowAnonymous`.
- اعمل revoke للتوكن لو موجود (`RevokeReason = "logout"`). لو مش موجود: برضه نجاح.
- Response: `{ "success": true, "data": null }`.

### 3.4 `GET /api/auth/me`  ← `[Authorize]`
```json
{ "success": true, "data": { "userId": "u-admin", "userName": "أحمد حسن", "email": "admin@xturbo.com", "role": "Admin", "permissions": ["…"] } }
```
- يقرا من الداتابيز (مش من الـ claims). لو المستخدم اتمسح أو اتوقف ← 401 `غير مصرح`.

## 4) الـ Authorization

- كمّل الـ Policy provider من خطوة 01: `[HasPermission]` و `[HasAnyPermission]` بيقروا claims `perm`.
- `FallbackPolicy` = authenticated user — يعني أي endpoint من غير `[AllowAnonymous]` محمي تلقائيًا.

## 5) الـ Seed (Development)

| Id | Name | Email | Password | Role | Permissions |
|---|---|---|---|---|---|
| `u-admin` | أحمد حسن | admin@xturbo.com | `Admin@123` | Admin | **كل** الصلاحيات |
| `u-warehouse` | منى عادل | warehouse@xturbo.com | `Warehouse@123` | WarehouseManager | Dashboard.View, Items.View, Warehouses.View, Inventory.View, Invoices.View |

## 6) الأمان

- Rate limiting (`Microsoft.AspNetCore.RateLimiting`) على `login` و `refresh-token`: 10 طلبات/دقيقة لكل IP → 429 بالـ envelope ورسالة `طلبات كثيرة، حاول بعد قليل`.
- Background job (`IHostedService`) يمسح الـ refresh tokens المنتهية من أكتر من 7 أيام مرة كل يوم.
- ماتعملش log لأي باسورد أو توكن.

## 7) الاختبارات

- login صح ← 200 والـ shape مطابق، والـ JWT فيه `exp` و `perm`.
- إيميل غلط / باسورد غلط / مستخدم موقوف ← 401 بنفس الرسالة.
- 5 محاولات غلط ← السادسة 429.
- refresh ← توكن جديد، والقديم لو اتستخدم تاني ← 401 والـ family كلها revoked.
- logout من غير header ← 200، وبعدها refresh بنفس التوكن ← 401.
- `me` من غير توكن ← 401 بالـ envelope.
- endpoint تجريبي عليه `[HasPermission("Items.View")]` ← 403 للمستخدم اللي معندوش الصلاحية.
- كمّل helper `AuthenticateAs(...)` في `ApiFactory` عشان الخطوات الجاية.

## معايير القبول

- [ ] الـ 4 endpoints شغالة ومطابقة للـ shapes فوق حرفيًا.
- [ ] Swagger فيه زرار Authorize بيشتغل.
- [ ] الاختبارات خضرا، و `docs/PROGRESS.md` محدث (02 ✅).
