# الخطوة 03 — إدارة المستخدمين: `UsersController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **UsersController بس**، وبتستخدم جدول `User` اللي اتعمل في خطوة 02.

Route: `api/users` — كل الـ endpoints عليها `[HasPermission("Users.Manage")]`.

---

## 1) الـ DTOs

```csharp
// الرد — ممنوع يرجع الباسورد أو الـ hash
public sealed record AdminUserDto(
    string Id, string Name, string Email, string Phone,
    string Role,                       // Admin | WarehouseManager | Cashier | Accountant
    IReadOnlyList<string> Permissions, // مرتبة بترتيب Permissions.All
    bool IsActive,
    DateTime? LastLoginAt,             // null = عمره ما دخل
    DateTime CreatedAt, DateTime UpdatedAt);

public sealed record UserPayload(
    string Name, string Email, string Phone, string Role,
    IReadOnlyList<string> Permissions, bool IsActive,
    string? Password);                 // مطلوب في الإنشاء، يتجاهل في التعديل

public sealed record UserStatsDto(
    int Total, int Active, int Suspended,
    IReadOnlyDictionary<string, int> ByRole, // كل الأدوار الأربعة موجودة حتى لو 0
    int ActiveAdmins);                        // عدد المديرين النشطين في النظام كله
```

## 2) قواعد التحقق المشتركة (create + update)

| القاعدة | الكود | الرسالة |
|---|---|---|
| `name` فاضي | 422 | `اسم المستخدم مطلوب` |
| `email` فاضي | 422 | `البريد الإلكتروني مطلوب` |
| `email` شكله غلط | 422 | `البريد الإلكتروني غير صالح` |
| `email` موجود لمستخدم تاني (case-insensitive) | 409 | `البريد الإلكتروني مستخدم لحساب آخر` |
| `role` مش من الأربعة | 422 | `اختر دور المستخدم` |
| بعد تنظيف `permissions` (إبقاء المعروف بس، بدون تكرار، بترتيب `Permissions.All`) القائمة فاضية | 422 | `امنح المستخدم صلاحية واحدة على الأقل` |

التطبيع: `name` trim و max 80، `email` trim + lowercase، `phone` trim و max 20، `isActive` الافتراضي `true`.

### سياسة الباسورد (في الإنشاء و reset-password)
كل قاعدة مش متحققة تتضاف للرسالة:
- `8 أحرف على الأقل`
- `حرف إنجليزي كبير (A-Z)`
- `حرف إنجليزي صغير (a-z)`
- `رقم واحد على الأقل`
- `رمز خاص مثل @ # !` (أي حرف مش حرف/رقم/مسافة)

← 422 `كلمة المرور ضعيفة: {القواعد الناقصة مفصولة بـ "، "}`

### حماية آخر مدير نظام
"مدير نشط" = `Role == "Admin" && IsActive`. لو العملية هتخلي عدد المديرين النشطين **صفر** ← 422 `لا يمكن {الفعل} آخر مدير نظام نشط` والفعل حسب العملية:
- update: `تغيير دور أو إيقاف`
- status (إيقاف): `إيقاف`
- delete: `حذف`

### حماية النفس (المستخدم الحالي = الهدف)
| الحالة | الكود | الرسالة |
|---|---|---|
| update بـ `isActive=false` | 422 | `لا يمكنك إيقاف حسابك` |
| update بدور مختلف | 422 | `لا يمكنك تغيير دورك بنفسك` |
| update من غير `Users.Manage` | 422 | `لا يمكنك سحب صلاحية إدارة المستخدمين من حسابك` |
| status بـ `isActive=false` | 422 | `لا يمكنك إيقاف حسابك` |
| delete | 422 | `لا يمكنك حذف حسابك` |

## 3) الـ Endpoints

### 3.1 `GET /api/users` — قائمة paged
- Search في: `name`, `email`, `phone`.
- فلاتر: `role` (قيمة الدور بالظبط)، `status` = `active` | `suspended`.
- `sortBy` المسموح: `name`, `email`, `role`, `isActive`, `lastLoginAt`, `createdAt`. **الافتراضي** لو مفيش `sortBy`: `name asc`.
- `data.data[]` = `AdminUserDto`.

### 3.2 `GET /api/users/stats?search=`
- بياخد `search` بس (فلاتر `role`/`status` **بتتجاهل**).
- `total`/`active`/`suspended`/`byRole` محسوبين على نتيجة البحث. `activeAdmins` على النظام كله.

### 3.3 `GET /api/users/{id}` ← `AdminUserDto` أو 404 `المستخدم غير موجود`.

### 3.4 `POST /api/users` ← 201
- التحقق المشترك + الباسورد مطلوب وبيعدي السياسة.
- `LastLoginAt = null`، `CreatedAt = UpdatedAt = now`.

### 3.5 `PUT /api/users/{id}`
- التحقق المشترك + حماية النفس + حماية آخر مدير.
- `password` لو اتبعت **يتجاهل**.
- `UpdatedAt = now`.
- لو المستخدم اتوقف أو اتغيرت صلاحياته/دوره: اعمل revoke لكل الـ refresh tokens بتاعته (عشان يتطلع خلال 15 دقيقة كحد أقصى).

### 3.6 `DELETE /api/users/{id}`
- حماية النفس + حماية آخر مدير.
- امسح المستخدم وتوكناته. (لو عندك FK من جداول تانية لـ UserId في المستقبل، استخدم الاسم المخزن نصيًا في `CreatedBy` — عشان الحذف ميكسرش حاجة.)

### 3.7 `POST /api/users/{id}/status`
Body: `{ "isActive": false }` ← يرجع `AdminUserDto`.
- لو إيقاف: حماية النفس + آخر مدير، و revoke لكل توكناته.

### 3.8 `POST /api/users/{id}/reset-password`
Body: `{ "password": "N3w@Passw0rd" }` ← `{ success: true, data: null }`.
- سياسة الباسورد. Hash جديد، `UpdatedAt = now`، و revoke لكل توكناته (يدخل تاني).

## 4) قيم مفيدة للفرونت (للعلم)

الصلاحيات الافتراضية لكل دور (الفرونت بيطبقها لما تختار الدور، بس الـ API بيقبل أي مجموعة):
- Admin: الكل
- WarehouseManager: Dashboard.View, Items.View, Warehouses.View, Inventory.View, Invoices.View
- Cashier: Dashboard.View, Orders.View, Invoices.View, Pos.Access, Customers.View, Payments.View
- Accountant: Dashboard.View, Reports.View, Invoices.View, Customers.View, Vouchers.View, Payments.View, Accounts.View

حط الـ map ده في الـ Domain كـ `RoleDefaults` (هيتستخدم في الـ seed).

## 5) الاختبارات

- CRUD كامل + الـ paging والفلاتر والبحث بالعربي.
- إيميل مكرر بحروف كبيرة ← 409.
- باسورد ضعيف ← 422 والرسالة فيها القواعد الناقصة بالظبط.
- إيقاف/حذف/تغيير دور آخر Admin نشط ← 422.
- المستخدم يحاول يوقف/يحذف نفسه ← 422.
- مستخدم معندوش `Users.Manage` ← 403 على كل الـ endpoints.
- بعد reset-password: الـ refresh القديم ← 401.

## معايير القبول

- [ ] 8 endpoints مطابقة للعقد، وكل رسائل الخطأ بالحرف.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (03 ✅).
