# برومبتات الـ Backend (.NET) لمشروع X-TURBO

الملفات دي مكتوبة عشان تتبعت **واحد واحد** لأي AI agent (Claude Code / Cursor / Copilot) شغال على ريبو الـ Backend.
كل ملف = خطوة واحدة = Controller واحد (أو أساس مشترك). متبعتش خطوتين مع بعض.

## طريقة الاستخدام

1. اعمل ريبو فاضي للـ Backend وافتحه في الـ agent.
2. ابعت محتوى `01-foundation.md` كامل كرسالة واحدة.
3. استنى لحد ما يخلص، وتأكد من **"معايير القبول"** اللي في آخر الملف (build + tests + Swagger).
4. اعمل commit، وبعدين ابعت الملف اللي بعده.
5. لو الـ agent فتح session جديدة، ابدأ الرسالة بـ: «اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول».

> الخطوة 01 بتخلي الـ agent يحفظ القواعد المشتركة في `docs/CONVENTIONS.md` جوه ريبو الـ Backend، وكل خطوة بعدها بتحدث `docs/PROGRESS.md`. عشان كده كل برومبت بعد كده قصير نسبيًا ومش بيكرر القواعد.

## ترتيب الخطوات (الترتيب مهم — كل خطوة بتعتمد على اللي قبلها)

| # | الملف | الـ Controller | الـ Endpoints |
|---|------|----------------|---------------|
| 01 | `01-foundation.md` | — (الأساس) | Envelope، Paging، Errors، Search عربي، Numbering |
| 02 | `02-auth.md` | `AuthController` | `auth/login` · `auth/refresh-token` · `auth/logout` · `auth/me` |
| 03 | `03-users.md` | `UsersController` | `users` + stats + status + reset-password |
| 04 | `04-settings.md` | `SettingsController` | `settings` |
| 05 | `05-item-groups.md` | `ItemGroupsController` | `item-groups` + lookup |
| 06 | `06-items.md` | `ItemsController` | `items` |
| 07 | `07-warehouses.md` | `WarehousesController` | `warehouses` + lookup |
| 08 | `08-stock.md` | `StockController` | `stock` · `stock/summary` · `stock/items/{id}` · `items/lookup` |
| 09 | `09-parties.md` | `PartiesController` (CRUD) | `parties` + lookup |
| 10 | `10-accounts.md` | `AccountsController` | `accounts` + lookup |
| 11 | `11-cost-centers.md` | `CostCentersController` | `cost-centers` + lookup |
| 12 | `12-ledger-engine.md` | — (محرك القيود) | خدمة الترحيل المحاسبي + أرصدة الحسابات |
| 13 | `13-documents-crud.md` | `DocumentsController` (1) | list · stats · get · create · update · delete |
| 14 | `14-documents-workflow.md` | `DocumentsController` (2) | post · complete · cancel · convert |
| 15 | `15-vouchers.md` | `VouchersController` | `vouchers` + stats + post + cancel |
| 16 | `16-party-statements.md` | `PartiesController` (2) | statement · statement/detailed · balances · balances/summary |
| 17 | `17-employees.md` | `EmployeesController` | `employees` + stats |
| 18 | `18-budget.md` | `BudgetController` | `budget` · `budget/{year}` |
| 19 | `19-currencies.md` | `CurrenciesController` | `currencies` |
| 20 | `20-pos-settings.md` | `PosSettingsController` | `pos/settings` |
| 21 | `21-orders.md` | `OrdersController` | `orders` + stats + status |
| 22 | `22-payments.md` | `PaymentsController` | `payments` + stats + confirm/fail/retry/refund/settle |
| 23 | `23-dashboard.md` | `DashboardController` | `dashboard/overview` |
| 24 | `24-reports.md` | `ReportsController` | `reports/overview` · `reports/products` |
| 25 | `25-final-hardening.md` | — | Seed كامل، أمان، أداء، ربط الفرونت |

## بعد ما الـ Backend يخلص — ربط الفرونت

في `src/environments/environment.ts` و `environment.prod.ts`:

```ts
apiUrl: 'https://localhost:5001/api',   // أو رابط السيرفر الحقيقي
mockApi: false,
```

## قرارات اتاخدت في البرومبتات (غيّرها لو حابب قبل ما تبعت)

- **.NET 10 (LTS)** + **SQL Server** + **EF Core** + **Clean Architecture** (4 مشاريع).
- الـ IDs كلها `string`. الحسابات بالذات لازم تبقى `acc-{code}` لأن الفرونت كاتب `acc-1101`… ثابتين في الكود.
- القيود المحاسبية **بتتسجل فعليًا في جدول** وقت الترحيل (مش بتتحسب كل مرة زي الـ mock) — أسرع وأدق.
- الطلبات (Orders) هي مصدر أرقام الـ Dashboard والتقارير، زي ما الفرونت مصمم.


---
---

# الخطوة 01 — تأسيس المشروع والقواعد المشتركة

أنت مهندس Backend خبير في ASP.NET Core. هنبني مع بعض الـ API الخاص بنظام **X-TURBO** — نظام ERP لشركة قطع غيار سيارات (مخازن، فواتير، نقطة بيع، حسابات، متجر إلكتروني). الفرونت إند مكتوب بالفعل بـ Angular وشغال على Mock API، ومهمتنا نبني API **مطابق حرفيًا** للعقد (contract) اللي الفرونت مستنيه.

هنشتغل على خطوات. **الخطوة دي بس** للأساس — ممنوع تعمل أي Controller خاص بموديول (items, documents…) دلوقتي.

---

## 1) التقنيات

- **.NET 10 (LTS)**، C# أحدث إصدار، `Nullable` و `ImplicitUsings` مفعلين، `TreatWarningsAsErrors` للمشاريع الأساسية.
- **SQL Server** + **EF Core 10** (Code-First + Migrations).
- **FluentValidation** للتحقق من المدخلات.
- **Serilog** للـ logging (Console + File).
- **Swashbuckle / OpenAPI** مع دعم JWT Bearer في Swagger UI.
<!-- - الاختبارات: **xUnit** + **FluentAssertions** + `WebApplicationFactory` + **Testcontainers.MsSql** (قاعدة SQL Server حقيقية في Docker للاختبارات). -->

## 2) هيكل الـ Solution (Clean Architecture)

```
XTurbo.sln
src/
  XTurbo.Domain/          ← Entities, Enums, Domain exceptions, ثوابت (بدون أي dependency)
  XTurbo.Application/     ← DTOs, Interfaces, Services/Use-cases, Validators, Paging, Search
  XTurbo.Infrastructure/  ← EF Core DbContext, Configurations, Migrations, Repos, JWT, Hashing
  XTurbo.Api/             ← Controllers, Middleware, Filters, Program.cs, appsettings
tests/
  XTurbo.Api.Tests/       ← Integration tests (WebApplicationFactory + Testcontainers)
  XTurbo.Application.Tests/ ← Unit tests للحسابات والقواعد
docs/
  CONVENTIONS.md
  PROGRESS.md
```

- الـ Controllers **رفيعة**: بتستقبل الطلب، تنادي Service من الـ Application، وترجع النتيجة. مفيش business logic في الـ Controller.
- كل موديول في الـ Application في فولدر خاص بيه: `Features/Items/{Dtos, Validators, ItemsService.cs, IItemsService.cs}`.

## 3) عقد الاستجابة (Response Envelope) — إلزامي لكل Endpoint

### نجاح
```json
{ "success": true, "data": <payload> }
```
- `GET` / `PUT` / `PATCH` / أكشنز `POST .../post` إلخ ← **200**.
- `POST` اللي بينشئ resource جديد ← **201** ونفس الـ envelope والـ `data` = العنصر الجديد كامل.
- `DELETE` ← **200** و `{ "success": true, "data": null }`.

### خطأ
```json
{ "success": false, "message": "رسالة عربية واضحة للمستخدم", "errors": { "fieldName": ["رسالة"] } }
```
- `errors` اختياري (للـ validation بس). الفرونت بيعرض `message` في Toast، ولو فيه `errors` بيعرضها بدلها.
- **ممنوع** ترجع `ProblemDetails` الافتراضي بتاع ASP.NET في أي حالة.

| الحالة | الكود | الرسالة الافتراضية |
|---|---|---|
| JSON بايظ / body مش مقروء | 400 | `البيانات المرسلة غير صالحة` |
| مش مسجل دخول / توكن منتهي | 401 | `غير مصرح` |
| معندوش الصلاحية | 403 | `ليس لديك صلاحية لتنفيذ هذا الإجراء` |
| العنصر مش موجود | 404 | `{اسم العنصر} غير موجود` (مثال: `المخزن غير موجود`) |
| تعارض حالة / تكرار / قاعدة عمل | 409 | رسالة القاعدة نفسها |
| فشل التحقق من المدخلات | **422** | أول رسالة تحقق، و `errors` فيها الكل |
| خطأ غير متوقع | 500 | `حدث خطأ غير متوقع، حاول مرة أخرى` |

### التنفيذ المطلوب
- Domain exceptions: `NotFoundException(string what)` → 404 برسالة `"{what} غير موجود"`، `BusinessRuleException(string message)` → 409، `ValidationFailedException(string message, IDictionary<string,string[]>? errors)` → 422، `ForbiddenException` → 403.
- `ExceptionHandlingMiddleware` (أو `IExceptionHandler`) يحول الاستثناءات للـ envelope ويعمل log للـ 500 بس.
- `ApiBehaviorOptions.InvalidModelStateResponseFactory` → 422 بنفس الـ envelope.
- FluentValidation: اعمل `ValidationFilter` أو نادي الـ validator جوه الـ service، والنتيجة 422 بنفس الشكل. رسائل الـ validators **بالعربي**.
- 401/403 من الـ JWT middleware لازم كمان يرجعوا بنفس الـ envelope (اعمل `JwtBearerEvents.OnChallenge` و `OnForbidden`).
- Helper في `BaseApiController`: `Ok(data)`، `Created(data)`، `NoContentOk()` بيرجعوا الـ envelope.

## 4) القوائم والـ Paging — عقد موحد لكل List

### Query params (كلها اختيارية)
| param | النوع | القاعدة |
|---|---|---|
| `pageIndex` | int | **1-based**. الافتراضي 1. يتقص (clamp) بين 1 و `totalPages`. |
| `pageSize` | int | الافتراضي 10، يتقص بين 1 و 100. |
| `search` | string | بحث عربي ذكي (تحت). |
| `sortBy` | string | اسم الحقل **camelCase** زي ما هو في الـ DTO (مثال `salePrice`). من whitelist بس — أي قيمة مش معروفة تتجاهل. |
| `sortDir` | `asc` \| `desc` | الافتراضي `asc`. |
| فلاتر | string | كل فلتر param عادي (`status=active&groupId=...`). **القيمة الفاضية تتجاهل.** |

### شكل الاستجابة (جوه `data`)
```json
{ "pageIndex": 1, "pageSize": 10, "count": 137, "totalPages": 14, "data": [ ... ] }
```
- `count` = إجمالي الصفوف بعد البحث والفلترة.
- `totalPages` = `max(1, ceil(count / pageSize))`.

اعمل في الـ Application:
```csharp
public sealed record ListQuery(int PageIndex = 1, int PageSize = 10, string? Search = null, string? SortBy = null, string? SortDir = null);
public sealed record PagedResult<T>(int PageIndex, int PageSize, int Count, int TotalPages, IReadOnlyList<T> Data);
public static class QueryableExtensions {
    // ApplySort(sortBy, sortDir, IReadOnlyDictionary<string, Expression<Func<T, object>>> whitelist, defaultSort)
    // ToPagedAsync(listQuery) — بيعمل clamp للـ pageIndex زي ما فوق
}
```
- Endpoints الـ **lookup** (`.../lookup`) بترجع **Array عادي** مش paged.
- Endpoints الـ **stats/summary** بتاخد **نفس** البحث والفلاتر بتاعة الـ list (وفي حالات محددة بتتجاهل فلتر `status` — هتتقال في كل خطوة).

## 5) البحث العربي (مهم جدًا)

الفرونت بيبحث بطريقة "مرنة": `اعدادات` لازم تلاقي `إعدادات`، و`مـبـيـعـات` تلاقي `مبيعات`.

قواعد التطبيع (Normalize):
- `أ إ آ ٱ` → `ا` ، `ة` → `ه` ، `ى` → `ي` ، `ؤ` → `و` ، `ئ` → `ي`
- حذف التشكيل (U+064B..U+065F و U+0670) والتطويل `ـ`.
- الحروف اللاتيني lowercase.
- نص البحث يتقسم كلمات بالمسافات؛ **كل كلمة لازم تتواجد** في واحد على الأقل من حقول البحث.

التنفيذ:
- `ArabicText.Normalize(string)` في الـ Application + unit tests.
- كل Entity قابلة للبحث فيها عمود `SearchText nvarchar(1000)` = تطبيع (حقول البحث متوصلة بمسافة)، بيتحدث تلقائيًا في `SaveChanges` (Interceptor أو `ISearchable.BuildSearchText()`).
- البحث: لكل كلمة `WHERE SearchText LIKE '%' + token + '%'` (AND بين الكلمات). اعمل index مناسب.
- لما بيانات مشتقة تتغير (مثلًا اسم مجموعة → `groupName` في الأصناف) لازم الـ `SearchText` بتاع الصفوف المتأثرة يتحدث.

## 6) JSON والأنواع

- `camelCase` لكل الخصائص.
- الـ **nulls تتبعت كـ `null`** (ممنوع `WhenWritingNull`) — الفرونت متوقع كل الحقول موجودة.
- الـ Enums تتبعت **strings بالقيمة الحرفية** اللي هتتحدد في كل خطوة (فيها kebab-case زي `sale-return` و snake_case زي `partially_refunded`). استخدم `[JsonStringEnumMemberName("sale-return")]` على كل قيمة + `JsonStringEnumConverter`. وفي قاعدة البيانات خزنها **string** بنفس القيمة (`HasConversion<string>()` مع mapping).
- التاريخ فقط (`date`, `dueDate`, `hireDate`) ← `DateOnly` ويتبعت `"2026-11-09"`.
- الطوابع الزمنية (`createdAt`, `postedAt`, …) ← UTC ويتبعت ISO-8601 بـ `Z` (`"2026-11-09T10:15:00Z"`).
- الفلوس `decimal(18,2)`، أسعار الصرف `decimal(18,4)`. التقريب `Math.Round(x, 2, MidpointRounding.AwayFromZero)` في helper اسمه `Money.Round2`.
- النصوص اللي في العقد `string` (مش nullable) تتبعت `""` مش `null`. اعمل Trim لكل النصوص الداخلة.

## 7) الـ IDs والأكواد

- كل الـ IDs نوعها **string** (`nvarchar(64)`). الافتراضي للجديد: `Guid.NewGuid().ToString("N")`.
- **استثناء**: الحسابات `acc-{code}` (مثال `acc-1101`) لأن الفرونت كاتبها ثابتة. هتتعمل في خطوة 10.
- الأكواد البشرية (`IT-00042`, `SI-001245`…) بتتولد في السيرفر عن طريق **`INumberSequenceService`**:
  - جدول `NumberSequences(Key nvarchar(50) PK, Prefix nvarchar(10), NextNumber int, Digits int, RowVersion)`.
  - `Task<string> NextAsync(string key)` → يقرأ ويزوّد في نفس الـ transaction بـ `UPDLOCK, ROWLOCK` (أو optimistic concurrency + retry) عشان مايحصلش تكرار تحت الضغط.
  - الشكل: `{Prefix}-{NextNumber padded to Digits}`.
  - Seed مبدئي (هيتكمل في كل خطوة): `item:IT:5`، `item-group:GR:3`، `warehouse:WH:3`، `customer:CU:5`، `supplier:SU:5`، `cost-center:CC:2`، `employee:EMP:4`، `payment:PAY:6`، `order:ORD:5`.

## 8) Auditing

- كل Entity فيها `CreatedAt` (UTC)، وأغلبها `UpdatedAt`، وفي المستندات `CreatedBy` = **اسم** المستخدم (مش الـ id).
- `ICurrentUser` (UserId, Name, Email, Role, Permissions) من الـ Claims. لو مفيش مستخدم: الاسم `"النظام"`.

## 9) الصلاحيات (Authorization)

الفرونت بيستخدم دول بالحرف — **ممنوع تغير الأسماء**:
```
Dashboard.View, Reports.View, Orders.View, Invoices.View, Pos.Access,
Items.View, Warehouses.View, Inventory.View, Customers.View, Vouchers.View,
Payments.View, Accounts.View, Users.Manage, Settings.Manage
```
- حطهم كثوابت في `XTurbo.Domain/Auth/Permissions.cs` + `Permissions.All`.
- الأدوار: `Admin`, `WarehouseManager`, `Cashier`, `Accountant`.
- اعمل Attribute: `[HasPermission(Permissions.Items)]` و `[HasAnyPermission(a, b, ...)]` مبنيين على Policy ديناميكي (`IAuthorizationPolicyProvider`) بيقرا claims من نوع `perm`.
- (الـ JWT نفسه هيتعمل في خطوة 02 — دلوقتي جهز البنية بس.)

## 10) Program.cs

- CORS policy باسم `Frontend` من `appsettings` (`Cors:Origins` — افتراضي `http://localhost:4200`)، مع `AllowAnyHeader/AnyMethod`.
- كل الـ routes تحت `/api` (مثال `[Route("api/items")]`). أسماء الـ routes **kebab-case** بالظبط زي ما هتتحدد.
- Swagger في Development.
- Health check على `/health`.
- `UseHttpsRedirection`، Kestrel على `https://localhost:5001` (الفرونت متظبط عليه).
- Response compression.

## 11) قاعدة البيانات

- `XTurboDbContext` + `IEntityTypeConfiguration` لكل Entity في ملف منفصل.
- Connection string في `appsettings.Development.json`.
- Migration أولى `Initial` فيها `NumberSequences` بس.
- `DbSeeder` بيشتغل عند الإقلاع في Development (idempotent).

## 12) الاختبارات

- `ApiFactory : WebApplicationFactory<Program>` بيشغل SQL Server في Testcontainers ويعمل migrate + seed.
- Helper `AuthenticateAs(permissions...)` (هيتكمل في خطوة 02).
- اختبارات الخطوة دي: الـ envelope للنجاح والخطأ، 422 من model binding، الـ paging clamp، `ArabicText.Normalize`، `NumberSequenceService` تحت التوازي (20 طلب متوازي → 20 رقم مختلف متتالي).

## 13) ملفات التوثيق (اعملها دلوقتي)

1. **`docs/CONVENTIONS.md`**: انسخ فيه البنود من 3 لـ 12 من الرسالة دي **كما هي** — ده المرجع لكل الخطوات الجاية.
2. **`docs/PROGRESS.md`**: جدول بالخطوات 01→25 وحالة كل واحدة، وعلّم 01 ✅. في كل خطوة جاية هتحدثه.

---

## معايير القبول (Definition of Done)

- [ ] `dotnet build` بدون warnings/errors، و `dotnet test` كله أخضر.
- [ ] `GET /health` ← 200.
- [ ] Endpoint تجريبي داخلي (في الاختبارات بس) بيأكد: نجاح ← `{success:true,data}`، `NotFoundException("المخزن")` ← 404 `{"success":false,"message":"المخزن غير موجود"}`، body بايظ ← 422/400 بنفس الشكل.
- [ ] `docs/CONVENTIONS.md` و `docs/PROGRESS.md` موجودين.
- [ ] مفيش أي Controller خاص بموديول اتعمل.

لما تخلص اكتبلي ملخص: الملفات اللي اتعملت، وأي قرار اتاخد ومش مذكور هنا.


---
---

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


---
---

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


---
---

# الخطوة 04 — إعدادات النظام: `SettingsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **SettingsController بس** + ربط الترقيم بجدول `NumberSequences` من خطوة 01.

الإعدادات **سجل واحد** للنظام كله. (إعدادات نقطة البيع منفصلة في خطوة 20.)

Route: `api/settings`
- `GET` ← أي مستخدم مسجل دخول (شاشات تانية بتحتاج نسبة الضريبة).
- `PUT` ← `[HasPermission("Settings.Manage")]`.

---

## 1) الـ DTO (نفس الشكل للـ GET والـ PUT response)

```json
{
  "company": {
    "name": "X-TURBO لقطع غيار السيارات",
    "taxNumber": "512-874-339",
    "commercialRegister": "184562",
    "phone": "0225678900",
    "email": "info@xturbo.com",
    "address": "التجمع الخامس — شارع التسعين الجنوبي، القاهرة الجديدة",
    "logoInitials": "XT"
  },
  "financial": {
    "baseCurrency": "EGP",
    "vatRate": 14,
    "pricesIncludeTax": false,
    "fiscalYearStartMonth": 1,
    "decimalPlaces": 2
  },
  "numbering": [
    { "kind": "quotation", "prefix": "QT", "nextNumber": 58, "digits": 6 },
    { "kind": "sale", "prefix": "SI", "nextNumber": 1245, "digits": 6 }
  ],
  "inventory": {
    "allowNegativeStock": false,
    "lowStockThreshold": 5,
    "defaultWarehouseId": null
  },
  "updatedAt": "2026-10-28T09:00:00Z",
  "updatedBy": "أحمد حسن"
}
```

- `numbering` **دايمًا 11 عنصر بالترتيب ده**: `quotation, sale, purchase, sale-return, purchase-return, transfer, goods-issue, goods-receipt, receipt, payment, journal`.
- الـ PUT payload = نفس الشكل من غير `updatedAt`/`updatedBy`.

## 2) التخزين

- جدول `SystemSettings` (صف واحد Id=1) فيه أعمدة `company`/`financial`/`inventory` (owned types أو أعمدة عادية) + `UpdatedAt` + `UpdatedBy`.
- **الترقيم مش متخزن هنا** — بيتقرا ويتكتب من جدول `NumberSequences` (خطوة 01) بالمفاتيح:

| kind | المفتاح في NumberSequences | Prefix افتراضي | NextNumber افتراضي | Digits |
|---|---|---|---|---|
| quotation | `doc:quotation` | QT | 58 | 6 |
| sale | `doc:sale` | SI | 1245 | 6 |
| purchase | `doc:purchase` | PI | 312 | 6 |
| sale-return | `doc:sale-return` | SR | 37 | 6 |
| purchase-return | `doc:purchase-return` | PR | 12 | 6 |
| transfer | `doc:transfer` | TR | 96 | 6 |
| goods-issue | `doc:goods-issue` | GI | 141 | 6 |
| goods-receipt | `doc:goods-receipt` | GRN | 203 | 6 |
| receipt | `voucher:receipt` | RV | 428 | 6 |
| payment | `voucher:payment` | PV | 365 | 6 |
| journal | `voucher:journal` | JV | 89 | 6 |

وكمان (مش ظاهرين في الإعدادات بس لازم يتعملهم seed): `doc:voucher-transfer` → `VT`، `doc:reservation` → `RS` (NextNumber 1، Digits 6).

> لو بتبدأ على داتابيز إنتاج فاضية، خلي الـ NextNumber = 1 للكل. القيم فوق للـ Development seed.

## 3) قواعد التحقق للـ PUT

| الحقل | القاعدة | الكود | الرسالة |
|---|---|---|---|
| company.name | مطلوب بعد trim (max 120) | 422 | `اسم الشركة مطلوب` |
| company.logoInitials | من 1 لـ 3 حروف بعد trim | 422 | `حروف الشعار من حرف إلى 3 أحرف` |
| financial.vatRate | 0..100 | 422 | `نسبة الضريبة يجب أن تكون بين 0 و 100` |
| financial.fiscalYearStartMonth | 1..12 (int) | 422 | `شهر بداية السنة المالية غير صالح` |
| financial.decimalPlaces | 0..4 (int) | 422 | `عدد الخانات العشرية من 0 إلى 4` |
| numbering | لازم الـ 11 kind موجودين | 422 | `إعدادات الترقيم ناقصة` |
| numbering[].prefix | بعد trim+uppercase يطابق `^[A-Z]{1,5}$` | 422 | `بادئة غير صالحة: «{القيمة الأصلية}»` |
| numbering[].nextNumber | ≥ 1 | 422 | `الرقم التالي لـ {PREFIX} يجب أن يكون 1 أو أكثر` |
| numbering[].digits | 1..10 | 422 | `عدد خانات الرقم من 1 إلى 10` |
| numbering | prefix مكرر بين أكتر من kind | 422 | `البادئة «{PREFIX}» مكررة لأكثر من مستند` |
| inventory.lowStockThreshold | ≥ 0 (int) | 422 | `حد التنبيه للمخزون يجب أن يكون 0 أو أكثر` |
| inventory.defaultWarehouseId | لو مبعوت: موجود | 404 | `المخزن غير موجود` |
| inventory.defaultWarehouseId | لو مبعوت: نشط | 422 | `المخزن «{name}» موقوف` |

> جدول المخازن لسه مش موجود (خطوة 07). اعمل interface `IWarehouseLookup` في الـ Application دلوقتي بـ implementation مؤقت، وفي خطوة 07 هيتربط بالحقيقي. أو أجّل التحقق ده لخطوة 07 واكتب TODO واضح في `PROGRESS.md`.

التطبيع:
- `taxNumber`/`commercialRegister` max 30، `phone` max 20، `email` max 80، `address` max 250، كلها trim.
- `logoInitials` → uppercase.
- `vatRate` يتقرب لرقمين عشريين.
- `baseCurrency` دايمًا `"EGP"` (يتجاهل اللي جاي).
- `pricesIncludeTax` / `allowNegativeStock` → bool.
- `defaultWarehouseId` الفاضي → `null` (يعني استخدم المخزن اللي عليه `isDefault`).

حفظ الترقيم: حدّث صفوف `NumberSequences` (prefix, nextNumber, digits) **في نفس الـ transaction** بتاعة الإعدادات. `UpdatedAt = now`، `UpdatedBy = اسم المستخدم الحالي`.

> **قاعدة أمان إضافية (هتتفعل في خطوة 13 و 15):** لما جداول المستندات/السندات تتعمل، امنع إن `nextNumber` + `prefix` يولدوا رقم موجود فعلًا (409 `الرقم التالي لـ {PREFIX} يتعارض مع مستند موجود`). اعمل الـ hook دلوقتي كـ interface `INumberCollisionChecker` بيرجع false.

## 4) خدمة مساعدة للموديولات التانية

```csharp
public interface ISystemSettingsProvider {
    Task<SystemSettingsDto> GetAsync(CancellationToken ct);   // مع cache في الذاكرة يتمسح بعد الـ PUT
    Task<decimal> VatRateAsync(CancellationToken ct);
    Task<bool> AllowNegativeStockAsync(CancellationToken ct);
    Task<int> LowStockThresholdAsync(CancellationToken ct);
}
```

## 5) الـ Seed

القيم اللي في مثال الـ JSON فوق + `inventory = { allowNegativeStock: false, lowStockThreshold: 5, defaultWarehouseId: null }`، `updatedBy = "أحمد حسن"`.

## 6) الاختبارات

- GET بأي مستخدم ← 200 والشكل كامل والترتيب صح.
- PUT من غير `Settings.Manage` ← 403.
- كل قاعدة في جدول التحقق ليها test.
- بعد PUT بتغيير `sale` إلى `prefix: "inv", nextNumber: 5000` ← `INumberSequenceService.NextAsync("doc:sale")` يرجع `INV-005000`.

## معايير القبول

- [ ] GET/PUT مطابقين للعقد.
- [ ] الترقيم مقروء ومكتوب من `NumberSequences` (مصدر واحد للحقيقة).
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (04 ✅).


---
---

# الخطوة 05 — مجموعات الأصناف: `ItemGroupsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **ItemGroupsController بس**.

Route: `api/item-groups` — كل الـ endpoints عليها `[HasPermission("Items.View")]`، ما عدا `lookup` عليها `[HasAnyPermission("Items.View","Inventory.View","Invoices.View","Pos.Access","Reports.View")]` (بتتستخدم كفلتر في شاشات كتير).

---

## 1) الـ Entity

```csharp
ItemGroup {
  string Id;
  string Code;          // GR-001 — من NumberSequences key "item-group" (Prefix GR, Digits 3)
  string Name;          // unique, max 80
  string? ParentId;     // self reference (اختياري)
  string Description;   // "" افتراضي, max 300
  string Color;         // hex مثل "#e31e24"
  bool IsActive;
  DateTime CreatedAt;
  string SearchText;    // name + code + description
}
```

## 2) الـ DTOs

```csharp
public sealed record ItemGroupDto(
    string Id, string Code, string Name,
    string? ParentId, string? ParentName,  // ParentName محسوب
    string Description, string Color, bool IsActive,
    int ItemsCount,                        // محسوب: عدد الأصناف (نشطة وغير نشطة) في المجموعة
    DateTime CreatedAt);

public sealed record ItemGroupPayload(string Name, string? ParentId, string Description, string Color, bool IsActive);

public sealed record ItemGroupOption(string Id, string Name, string Color);
```

> `ItemsCount` = 0 دلوقتي لأن جدول الأصناف لسه مش موجود. اكتبه كـ subquery هيشتغل لما خطوة 06 تضيف الجدول (أو حط TODO في `PROGRESS.md` واتأكد منه في خطوة 06).

## 3) الـ Endpoints

### 3.1 `GET /api/item-groups` — paged
- Search: `name`, `code`, `description`.
- فلتر: `status` = `active` | `inactive`.
- sortBy المسموح: `name`, `code`, `itemsCount`, `isActive`, `createdAt`. الافتراضي `createdAt desc`.

### 3.2 `GET /api/item-groups/lookup`
- Array من `ItemGroupOption` للمجموعات **النشطة فقط**، مرتبة بالاسم.

### 3.3 `POST /api/item-groups` ← 201 + `ItemGroupDto`
### 3.4 `PUT /api/item-groups/{id}` ← `ItemGroupDto`
### 3.5 `DELETE /api/item-groups/{id}` ← `data: null`

(مفيش `GET /item-groups/{id}` — الفرونت مش بيستخدمه، بس مفيش مانع تضيفه.)

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي بعد trim | 422 | `اسم المجموعة مطلوب` |
| اسم موجود لمجموعة تانية (بعد trim، مقارنة تامة) | 409 | `يوجد مجموعة بنفس الاسم` |
| `parentId` مبعوت ومش موجود | 404 | `المجموعة الرئيسية غير موجود` ← استخدم `NotFoundException("المجموعة الرئيسية")` |
| update و `parentId == id` | 422 | `لا يمكن أن تكون المجموعة أبًا لنفسها` |
| update و `parentId` واحد من أحفادها (يعمل دورة) | 422 | `لا يمكن نقل المجموعة تحت إحدى مجموعاتها الفرعية` |
| delete ومجموعة فيها أصناف | 409 | `لا يمكن حذف مجموعة تحتوي على أصناف` |
| delete ومجموعة ليها مجموعات فرعية | 409 | `لا يمكن حذف مجموعة لها مجموعات فرعية` |
| id مش موجود | 404 | `العنصر غير موجود` ← `NotFoundException("العنصر")` |

- `parentId` الفاضي `""` → `null`.
- `color` لو فاضي أو مش hex صالح → `#64748b`.
- لما اسم أو لون المجموعة يتغير: الأصناف بتعرض `groupName` و `groupColor` — لو هتعملهم denormalized في خطوة 06 لازم يتحدثوا هنا في نفس الـ transaction (ومعاهم `SearchText` للأصناف). الأفضل: **ماتخزنهمش** في الأصناف واعمل join.

## 5) الـ Seed (Development)

12 مجموعة بالترتيب (الكود GR-001…GR-012، كلها نشطة ما عدا الأخيرة):

| الاسم | الوصف | اللون |
|---|---|---|
| الفرامل | تيل وطنابير وأسطوانات الفرامل | #e31e24 |
| الفلاتر | فلاتر الزيت والهواء والبنزين والتكييف | #f97316 |
| الإشعال | البوجيهات والموبينات والأسلاك | #eab308 |
| المحرك | سيور وجوانات وقطع المحرك | #22c55e |
| العفشة | المساعدين والمقصات والبلي | #14b8a6 |
| الكهرباء | البطاريات والدينامو والمارش | #0ea5e9 |
| الزيوت | زيوت المحرك والفتيس والفرامل | #6366f1 |
| التكييف | كمبروسر ورادياتير التكييف | #a855f7 |
| الإضاءة | الفوانيس واللمبات | #ec4899 |
| الهيكل | الصدامات والمرايات والأبواب | #64748b |
| الإطارات | الكاوتش والجنوط | #e31e24 |
| الإكسسوارات | الدواسات والفرش والكماليات | #f97316 (غير نشطة) |

## 6) الاختبارات

- CRUD + البحث العربي (`الاكسسوارات` تلاقي `الإكسسوارات`).
- lookup بيرجع النشطة بس.
- اسم مكرر ← 409، دورة في الأب ← 422.
- 403 لمستخدم من غير صلاحية.

## معايير القبول

- [ ] 5 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (05 ✅).


---
---

# الخطوة 06 — الأصناف: `ItemsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **ItemsController بس** (`items` و `items/{id}`). الـ endpoint `items/lookup` **مش هنا** — هيتعمل في خطوة 08 في `StockController`.

Route: `api/items` — `[HasPermission("Items.View")]`.

---

## 1) الـ Entity

```csharp
Item {
  string Id;
  string Code;            // IT-00042 — NumberSequences key "item" (Prefix IT, Digits 5)
  string Name;            // max 200
  string GroupId;         // FK → ItemGroup (Restrict delete)
  string Unit;            // واحدة من: قطعة | طقم | لتر | علبة | كرتونة | متر | زوج
  string Barcode;         // "" مسموح، لو مش فاضي → unique (filtered unique index WHERE Barcode <> '')
  string Brand;           // max 60
  decimal PurchasePrice;  // ≥ 0 — هو كمان "التكلفة" المستخدمة في تقييم المخزون
  decimal SalePrice;      // ≥ 0
  int MinStock;           // حد إعادة الطلب ≥ 0
  string Description;     // max 1000
  bool IsActive;
  DateTime CreatedAt;
  string SearchText;      // name + code + barcode + brand + groupName
}
```

> `Stock` **مش عمود** — هو مجموع أرصدة الصنف في كل المخازن (جدول `StockBalances` هيتعمل في خطوة 08). دلوقتي رجّعه `0`، وفي خطوة 08 هيتحسب `SUM(qty)`.

## 2) الـ DTOs

```csharp
public sealed record ItemDto(
    string Id, string Code, string Name,
    string GroupId, string GroupName, string GroupColor,   // join مع المجموعة
    string Unit, string Barcode, string Brand,
    decimal PurchasePrice, decimal SalePrice,
    int MinStock,
    decimal Stock,            // مجموع الرصيد في كل المخازن
    string Description, bool IsActive, DateTime CreatedAt);

public sealed record ItemPayload(
    string Name, string GroupId, string Unit, string Barcode, string Brand,
    decimal PurchasePrice, decimal SalePrice, int MinStock, string Description, bool IsActive);
```

## 3) مستوى المخزون (`stock level`) — هيتستخدم في أكتر من مكان

```
if stock <= 0           → "out"   (نفد)
else if stock <= minStock → "low" (منخفض)
else                     → "ok"   (متوفر)
```
حطها في الـ Domain: `StockLevel.Of(decimal qty, decimal min)`.

## 4) الـ Endpoints

### 4.1 `GET /api/items` — paged
- Search: `name`, `code`, `barcode`, `brand`, `groupName`.
- فلاتر:
  - `groupId` — مساواة.
  - `status` — `active` | `inactive`.
  - `stock` — `out` | `low` | `ok` (حسب القاعدة فوق على الرصيد الإجمالي).
- sortBy: `code`, `name`, `groupName`, `salePrice`, `purchasePrice`, `stock`, `minStock`, `isActive`, `createdAt`. الافتراضي `createdAt desc`.
- خلي بالك من الأداء: الـ `stock` محسوب، فاعمل الـ query كـ projection واحد فيه subquery `SUM` (مش N+1).

### 4.2 `GET /api/items/{id}` ← `ItemDto` أو 404 `العنصر غير موجود`.

### 4.3 `POST /api/items` ← 201
- `Code` يتولد، `Stock = 0`، `CreatedAt = now`.
- **الرصيد الافتتاحي ميتحطش هنا** — بيدخل بسند استلام بضاعة سببه "رصيد افتتاحي" (خطوة 13).

### 4.4 `PUT /api/items/{id}` ← `ItemDto`
- الكود والرصيد ميتغيروش من هنا.

### 4.5 `DELETE /api/items/{id}` ← `data: null`

## 5) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي | 422 | `اسم الصنف مطلوب` |
| `groupId` مش موجود | 404 | `العنصر غير موجود` |
| `unit` مش من القائمة | 422 | `الوحدة غير صحيحة` |
| `purchasePrice` أو `salePrice` سالب | 422 | `الأسعار لا يمكن أن تكون سالبة` |
| `minStock` سالب | 422 | `حد إعادة الطلب لا يمكن أن يكون سالبًا` |
| `barcode` (بعد trim) مستخدم لصنف تاني | 409 | `الباركود مستخدم لصنف آخر` |
| delete وفيه رصيد أو حجز في أي مخزن | 409 | `لا يمكن حذف صنف له رصيد — أوقفه بدلًا من ذلك` |
| delete وظاهر في أي مستند أو طلب | 409 | `لا يمكن حذف صنف عليه حركات — أوقفه بدلًا من ذلك` |

> الشرطين الأخيرين بيعتمدوا على جداول هتتعمل بعدين (08، 13، 21). اعمل `IItemUsageChecker` بـ implementation بيرجع false دلوقتي، وكل خطوة تضيف جدول تحدّثه. سجّل ده في `PROGRESS.md`.

- `name`, `barcode`, `brand`, `description` → trim.
- `groupName`/`groupColor` في الرد دايمًا من المجموعة الحالية (join).

## 6) الـ Seed (Development) — بيانات واقعية

لكل مجموعة من خطوة 05 أضف أصناف بالشكل `"{القطعة} — {السيارة}"` (حوالي 80–120 صنف):

| المجموعة | القطع |
|---|---|
| الفرامل | تيل فرامل أمامي، تيل فرامل خلفي، طنبورة فرامل، أسطوانة فرامل |
| الفلاتر | فلتر زيت، فلتر هواء، فلتر بنزين، فلتر تكييف |
| الإشعال | بوجيه إيريديوم، موبينة، طقم أسلاك بوجيهات |
| المحرك | طقم سير كاتينة، جوان وش سلندر، طرمبة مياه، سير دينامو |
| العفشة | مساعد أمامي، مساعد خلفي، مقص سفلي، بلية عجل |
| الكهرباء | بطارية 70 أمبير، دينامو، مارش، حساس أكسجين |
| الزيوت | زيت محرك 5W-30، زيت فتيس أوتوماتيك، زيت فرامل DOT4 |
| التكييف | كمبروسر تكييف، رادياتير تكييف، مروحة تكييف |
| الإضاءة | فانوس أمامي، فانوس خلفي، لمبة LED H4 |
| الهيكل | صدام أمامي، مراية جانبية، كبوت |
| الإطارات | كاوتش 195/65R15، جنط ألمونيوم 15 |
| الإكسسوارات | طقم دواسات، فرش كراسي، شاشة أندرويد |

- السيارات: تويوتا كورولا، هيونداي إلنترا، كيا سيراتو، نيسان صني، شيفروليه لانوس، ميتسوبيشي لانسر، سكودا أوكتافيا، رينو لوجان.
- الماركات: بوش، دينسو، NGK، فاليو، مان، أصلي، TRW، KYB.
- الوحدة: `طقم` لو الاسم فيه "طقم"، `لتر` لو فيه "زيت"، غير كده `قطعة`.
- سعر الشراء 90–4300 (مضاعفات 5)، البيع = الشراء × 1.18–1.53، `minStock` 5–35، باركود 13 رقم يبدأ `6221`، 7% غير نشط.
- استخدم `Random` بـ seed ثابت عشان الداتا تبقى ثابتة.

## 7) الاختبارات

- CRUD + كل فلتر + البحث بالباركود والماركة واسم المجموعة.
- باركود مكرر ← 409، باركود فاضي في صنفين ← مسموح.
- sortBy بقيمة مش معروفة ← يتجاهل (مش 500).
- بعد تغيير اسم المجموعة: `GET /items?search={الاسم الجديد}` يلاقي أصنافها.

## معايير القبول

- [ ] 5 endpoints مطابقة للعقد، و `stock` بيرجع رقم (0 لحد خطوة 08).
- [ ] تأكد إن `itemsCount` في المجموعات (خطوة 05) بقى شغال صح.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (06 ✅).


---
---

# الخطوة 07 — المخازن: `WarehousesController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **WarehousesController** + إنشاء جدول الأرصدة `StockBalances` (من غير endpoints بتاعته — دي خطوة 08).

Route: `api/warehouses`
- كل الـ endpoints: `[HasPermission("Warehouses.View")]`.
- **ما عدا** `GET lookup`: أي مستخدم مسجل دخول (بيتستخدم في الفواتير ونقطة البيع والتقارير).

---

## 1) الـ Entities

```csharp
Warehouse {
  string Id;
  string Code;            // WH-003 — NumberSequences key "warehouse" (Prefix WH, Digits 3)
  string Name;            // unique, max 100
  string Type;            // main | branch | showroom | transit
  string City; string Address; string Manager; string Phone; // كلهم "" افتراضي
  int Capacity;           // ≥ 0 (وحدات) — لعداد الامتلاء
  bool AllowNegative;     // يسمح بالصرف بأكتر من الرصيد
  bool IsDefault;         // مخزن واحد بس افتراضي في النظام كله
  bool IsActive;
  string Notes;
  string? CostCenterId;   // داخلي (مش في الـ DTO) — هيتستخدم في القيود (خطوة 12)
  DateTime CreatedAt;
  string SearchText;      // name + code + city + manager + address
}

// رصيد صنف في مخزن — الجدول ده هو مصدر الحقيقة للمخزون
StockBalance {
  string ItemId; string WarehouseId;   // PK مركب
  decimal Qty;                          // ممكن يبقى سالب لو المخزن AllowNegative
  decimal Reserved;                     // ≥ 0 — محجوز لحجوزات مفتوحة
  DateTime? LastMovementAt;
  byte[] RowVersion;                    // concurrency
}
```

- Filtered unique index: `IsDefault = 1` (يضمن مخزن افتراضي واحد).

## 2) الـ DTOs

```csharp
public sealed record WarehouseDto(
    string Id, string Code, string Name, string Type,
    string City, string Address, string Manager, string Phone,
    int Capacity, bool AllowNegative, bool IsDefault, bool IsActive,
    string Notes, DateTime CreatedAt,
    // ── محسوبة ──
    int ItemsCount,        // عدد الأصناف اللي رصيدها > 0 في المخزن ده
    decimal TotalQty,      // Σ qty
    decimal StockValue,    // Σ qty × item.PurchasePrice (مقرّب لأقرب جنيه)
    int LowStockCount,     // أصناف نشطة رصيدها في المخزن ≤ حد المخزن (تحت)
    int UsagePct);         // capacity > 0 ? round(totalQty / capacity × 100) : 0 — ممكن يعدي 100

public sealed record WarehousePayload(
    string Name, string Type, string City, string Address, string Manager, string Phone,
    int Capacity, bool AllowNegative, bool IsDefault, bool IsActive, string Notes);

public sealed record WarehouseOption(string Id, string Code, string Name, bool IsDefault);
```

### حد إعادة الطلب على مستوى المخزن
`warehouseMin(item) = ceil(item.MinStock / عدد المخازن النشطة)` (لو مفيش مخازن نشطة اعتبرها 1).
حطها في Domain service `StockRules.WarehouseMin(...)` — هتتستخدم في خطوات 08 و 23.

## 3) الـ Endpoints

### 3.1 `GET /api/warehouses` — paged
- Search: `name`, `code`, `city`, `manager`, `address`.
- فلاتر: `type` (main|branch|showroom|transit)، `status` (active|inactive).
- sortBy: `code`, `name`, `type`, `city`, `capacity`, `itemsCount`, `totalQty`, `stockValue`, `lowStockCount`, `usagePct`, `createdAt`. الافتراضي `code asc`.
- الإحصائيات المحسوبة بـ aggregate واحد group by warehouse (مش لكل صف لوحده).

### 3.2 `GET /api/warehouses/lookup`
- Array `WarehouseOption` للمخازن **النشطة** — **الافتراضي الأول** وبعدين بالكود.

### 3.3 `GET /api/warehouses/{id}` ← `WarehouseDto` أو 404 `المخزن غير موجود`.

### 3.4 `POST /api/warehouses` ← 201
- لو `isDefault = true` ← شيل الافتراضي من أي مخزن تاني في نفس الـ transaction.

### 3.5 `PUT /api/warehouses/{id}`

### 3.6 `DELETE /api/warehouses/{id}`

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي | 422 | `اسم المخزن مطلوب` |
| اسم مكرر | 409 | `يوجد مخزن بنفس الاسم` |
| `type` مش من الأربعة | 422 | `نوع المخزن غير صحيح` |
| `isDefault = true` و `isActive = false` | 422 | `المخزن الافتراضي يجب أن يكون نشطًا` |
| update: المخزن افتراضي والـ payload بيشيل الافتراضي | 422 | `يجب أن يكون هناك مخزن افتراضي — اجعل مخزنًا آخر افتراضيًا أولًا` |
| update: المخزن افتراضي والـ payload بيوقفه | 422 | `لا يمكن إيقاف المخزن الافتراضي` |
| delete: المخزن افتراضي | 409 | `لا يمكن حذف المخزن الافتراضي` |
| delete: فيه أي `StockBalance` بـ qty ≠ 0 أو reserved ≠ 0 | 409 | `لا يمكن حذف مخزن به أرصدة — حوّل البضاعة أولًا أو أوقف المخزن` |
| delete: عليه مستندات (كمخزن أو كمخزن مستلم) | 409 | `لا يمكن حذف مخزن عليه حركات — أوقفه بدلًا من ذلك` |

- التطبيع: trim لكل النصوص، `capacity = max(0, round(capacity))`.
- لما مخزن يتمسح: امسح صفوف `StockBalances` الصفرية بتاعته.
- شرط "عليه مستندات" بيعتمد على خطوة 13 — `IWarehouseUsageChecker` مؤقت بيرجع false.
- اربط هنا الـ `IWarehouseLookup` اللي اتعمل مؤقت في خطوة 04 (التحقق من `defaultWarehouseId` في الإعدادات).

## 5) خدمة مشتركة: `IStockLedger` (مهمة جدًا — كل حركات المخزون هتعدي منها)

```csharp
public interface IStockLedger {
    Task<StockBalance> GetOrCreateAsync(string itemId, string warehouseId, CancellationToken ct);
    Task AdjustQtyAsync(string itemId, string warehouseId, decimal delta, DateTime at, CancellationToken ct);      // + دخول / − خروج
    Task AdjustReservedAsync(string itemId, string warehouseId, decimal delta, CancellationToken ct);            // ميقلش عن 0
    Task<decimal> AvailableAsync(string itemId, string warehouseId, CancellationToken ct);                       // qty − reserved
    /// يتأكد إن كل الكميات المطلوبة متاحة (مجمعة لكل صنف) — بيتخطى الفحص لو المخزن AllowNegative
    /// أو إعداد النظام inventory.allowNegativeStock = true.
    /// الفشل ← 409: "الكمية غير متاحة: «{اسم الصنف}» — المتاح في {اسم المخزن} {max(available,0)} {الوحدة}"
    /// (أو رسالة مخصصة لو اتبعتت)
    Task AssertAvailableAsync(string warehouseId, IEnumerable<(string ItemId, decimal Qty)> lines, string? customMessage, CancellationToken ct);
}
```
- الكتابة على `StockBalance` بـ optimistic concurrency (`RowVersion`) + retry، أو `UPDLOCK` — ماينفعش اتنين يصرفوا نفس الرصيد في نفس اللحظة.
- اعمل unit/integration tests للـ service ده دلوقتي.

## 6) الـ Seed (Development)

| Id | الاسم | النوع | المدينة | العنوان | المدير | السعة |
|---|---|---|---|---|---|---|
| `wh-cai` | المخزن الرئيسي (افتراضي) | main | القاهرة | مدينة نصر — المنطقة السابعة، شارع مصطفى النحاس | منى عادل | 12000 |
| `wh-alx` | مخزن الإسكندرية | branch | الإسكندرية | سموحة — شارع فوزي معاذ | كريم السيد | 6000 |
| `wh-giz` | مخزن الجيزة | branch | الجيزة | الهرم — شارع العريش | هاني فؤاد | 5000 |
| `wh-oct` | مخزن 6 أكتوبر | branch | 6 أكتوبر | المنطقة الصناعية الثالثة | سامح رأفت | 4500 |
| `wh-shw` | صالة عرض التجمع | showroom | القاهرة الجديدة | التجمع الخامس — شارع التسعين الجنوبي | ياسمين فتحي | 1500 |

> **الأرصدة الافتتاحية مش هتتعمل seed مباشر في `StockBalances`** — هتدخل كسندات استلام "رصيد افتتاحي" في خطوة 13 عشان المخزون والقيود يبقوا متطابقين.

## 7) الاختبارات

- CRUD + القواعد كلها.
- إنشاء مخزن افتراضي جديد ← القديم بطل افتراضي.
- lookup: الافتراضي أول عنصر، والموقوف مش موجود.
- `IStockLedger`: صرف متوازي لنفس الرصيد ← واحد بس ينجح.

## معايير القبول

- [ ] 6 endpoints + جدول `StockBalances` + `IStockLedger`.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (07 ✅).


---
---

# الخطوة 08 — أرصدة المخزون: `StockController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **StockController** (قراءة فقط) فوق جدول `StockBalances` من خطوة 07.

الـ Controller ده فيه 4 endpoints — واحد منهم route بتاعه تحت `items/` بس مكانه هنا لأنه بيرجع بيانات أرصدة.

| Endpoint | الصلاحية |
|---|---|
| `GET api/stock` | `Inventory.View` |
| `GET api/stock/summary` | `Inventory.View` |
| `GET api/stock/items/{itemId}` | `HasAnyPermission("Inventory.View","Items.View")` |
| `GET api/items/lookup` | `HasAnyPermission("Items.View","Inventory.View","Invoices.View","Pos.Access")` |

> `items/lookup` لازم يتطابق قبل `items/{id}` — ASP.NET بيفضّل الـ literal segment تلقائيًا، بس اكتب test يأكد إن `GET /api/items/lookup` مش بيروح لـ `ItemsController.Get`.

وكمان في الخطوة دي: **عدّل `ItemDto.Stock`** (خطوة 06) يبقى `SUM(StockBalances.Qty)` للصنف، وحدّث `IItemUsageChecker` إن الصنف عليه رصيد لو أي `qty ≠ 0 أو reserved ≠ 0`.

---

## 1) `GET /api/stock` — قائمة الأرصدة (paged)

كل صف = **صنف × مخزن**. الصفوف المتولدة: كل صنف × كل مخزن، **ما عدا** المخازن الموقوفة اللي الرصيد فيها 0 (بلاش ضوضاء). يعني: `CROSS JOIN` بين الأصناف والمخازن + `LEFT JOIN` على `StockBalances` (الرصيد المش موجود = 0).

```csharp
public sealed record StockRowDto(
    string Id,             // "{itemId}:{warehouseId}"
    string ItemId, string ItemCode, string ItemName,
    string GroupId, string GroupName, string GroupColor,
    string Unit,
    string WarehouseId, string WarehouseName,
    decimal Qty,
    decimal Reserved,
    decimal Available,     // qty − reserved
    int MinStock,          // حد المخزن: ceil(item.MinStock / عدد المخازن النشطة)
    decimal Cost,          // item.PurchasePrice
    decimal Value,         // round(qty × cost)
    string Level,          // out | low | ok — StockLevel.Of(qty, MinStock)
    DateTime? LastMovementAt);
```

- Search: `itemName`, `itemCode`, `groupName`.
- فلاتر:
  - `warehouseId` — مساواة.
  - `groupId` — مساواة.
  - `level` — `ok` | `low` | `out`.
  - `reserved` — لو موجود بأي قيمة (`reserved=1`) ← الصفوف اللي `reserved > 0` بس.
- sortBy: `itemCode`, `itemName`, `groupName`, `warehouseName`, `qty`, `reserved`, `available`, `minStock`, `cost`, `value`, `level`, `lastMovementAt`. الافتراضي `itemCode asc`.
- الأداء: الـ CROSS JOIN ممكن يكبر (2000 صنف × 10 مخازن = 20 ألف صف). اعمله في SQL (view أو LINQ يترجم صح) مع الفلترة والـ paging في الداتابيز — **ممنوع** تجيب كله في الذاكرة.

## 2) `GET /api/stock/summary`

نفس البحث والفلاتر بالظبط بتوع `GET /stock` (من غير paging):
```csharp
public sealed record StockSummaryDto(
    int SkuCount,          // عدد الأصناف المميزة اللي qty > 0 في الصفوف المفلترة
    decimal TotalQty,      // Σ qty
    decimal TotalValue,    // Σ value
    int LowCount,          // عدد الصفوف level = low
    int OutCount);         // عدد الصفوف level = out
```
اعمل الـ filtering في دالة مشتركة بين الـ list والـ summary عشان الأرقام تتطابق دايمًا.

## 3) `GET /api/stock/items/{itemId}` — الصنف في كل المخازن

```csharp
public sealed record ItemStockDetailsDto(
    string ItemId, string ItemCode, string ItemName, string Unit,
    int MinStock,                 // حد الصنف الكلي (item.MinStock)
    decimal Cost,                 // item.PurchasePrice
    decimal TotalQty,             // Σ qty في كل المخازن
    IReadOnlyList<ItemBalanceDto> Balances,
    IReadOnlyList<StockMovementDto> Movements);

public sealed record ItemBalanceDto(string WarehouseId, string WarehouseName, decimal Qty, decimal Reserved, decimal Available, string Level);

public sealed record StockMovementDto(
    string DocumentId, string DocumentNumber,
    string Kind,          // نوع المستند (sale, purchase, transfer...)
    string KindLabel,     // الاسم العربي المفرد (فاتورة بيع، تحويل مخزني...)
    DateOnly Date,
    string WarehouseId, string WarehouseName,
    decimal Qty,          // بإشارة: + دخول / − خروج
    string? PartyName);
```
- `404` لو الصنف مش موجود: `الصنف غير موجود`.
- `Balances`: المخازن النشطة كلها + الموقوفة اللي فيها رصيد ≠ 0. الـ `Level` بحد المخزن.
- `Movements`: **آخر 30 حركة**، الأحدث الأول. المصدر = جدول حركات المخزون اللي **هيتعمل في خطوة 13** (`StockMovements`). دلوقتي رجّع `[]` وسجّل TODO في `PROGRESS.md`.

## 4) `GET /api/items/lookup?warehouseId=` — أصناف للاختيار (فواتير / POS)

Array (مش paged) من الأصناف **النشطة** فقط:
```csharp
public sealed record ItemLookupDto(
    string Id, string Code, string Name, string Unit, string Barcode, string Brand,
    string GroupId, string GroupName, string GroupColor,
    decimal SalePrice, decimal PurchasePrice,
    decimal Stock,       // مع warehouseId: رصيد المخزن ده — من غيره: الإجمالي
    decimal Available,   // stock − reserved (للمخزن، أو مجموع المحجوز في الكل)
    int MinStock);       // item.MinStock
```
- مرتبة بالاسم. لو `warehouseId` مبعوت ومش موجود ← 404 `المخزن غير موجود`.
- ده endpoint تقيل الاستخدام في نقطة البيع — اعمله projection واحد سريع، واستخدم `AsNoTracking`.

## 5) الاختبارات

- استخدم `IStockLedger` في الـ arrange عشان تحط أرصدة، وبعدين:
  - `/stock` بيرجع صف لكل صنف × مخزن نشط، والمخزن الموقوف بيظهر بس لو فيه رصيد.
  - فلتر `level=low` و `reserved=1` و `warehouseId`.
  - `/stock/summary` بنفس الفلاتر = مجموع صفوف `/stock` (pageSize=100 ولف على كل الصفحات).
  - `/items/lookup?warehouseId=wh-alx` ← stock/available للمخزن ده بس.
  - `ItemDto.stock` = مجموع المخازن.
  - `/api/items/lookup` مش بيتعامل كـ id.

## معايير القبول

- [ ] 4 endpoints مطابقة للعقد، الـ list والـ summary متطابقين.
- [ ] `ItemDto.stock` بقى حقيقي.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (08 ✅) ومكتوب فيه TODO الـ movements لخطوة 13.


---
---

# الخطوة 09 — العملاء والموردين: `PartiesController` (الجزء 1 — CRUD)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **CRUD + lookup** بس. كشوف الحساب والأرصدة في خطوة 16 (بعد محرك القيود).

"Party" = عميل أو مورد أو الاتنين. **اصطلاح الرصيد في كل النظام:** `balance = مدين − دائن`
- `> 0` ← **مدين** (هو مديون لنا — الطبيعي للعميل)
- `< 0` ← **دائن** (إحنا مديونين له — الطبيعي للمورد)

Route: `api/parties`
- CRUD + list: `[HasPermission("Customers.View")]`
- `lookup`: `[HasAnyPermission("Customers.View","Invoices.View","Pos.Access","Vouchers.View")]`

---

## 1) الـ Entity

```csharp
Party {
  string Id;
  string Code;               // CU-00012 (customer/both) أو SU-00012 (supplier)
  string Kind;               // customer | supplier | both
  string Name;               // ≥ 2 حروف, max 150
  string Phone;              // موبايل مصري، unique لو مش فاضي (filtered index)
  string Phone2; string Email; string City; string Address;
  string TaxNumber; string CommercialRegister;
  decimal CreditLimit;       // 0 = بلا حد
  int PaymentTermDays;       // أيام السداد للآجل
  string PriceList;          // retail | wholesale
  decimal OpeningBalance;    // بإشارة (نفس اصطلاح balance)
  string Notes;
  bool IsActive;
  bool IsExternal;           // عميل سريع اتسجل من نقطة البيع
  DateTime CreatedAt;
  string SearchText;         // name + code + phone + phone2 + email + city + taxNumber
}
```

## 2) الـ DTOs

```csharp
public sealed record PartyDto(
    string Id, string Code, string Kind, string Name,
    string Phone, string Phone2, string Email, string City, string Address,
    string TaxNumber, string CommercialRegister,
    decimal CreditLimit, int PaymentTermDays, string PriceList,
    decimal OpeningBalance, string Notes, bool IsActive, bool IsExternal, DateTime CreatedAt,
    // ── محسوبة ──
    decimal Balance,             // opening + حركات مرحلة (خطوة 12/16) — دلوقتي = OpeningBalance
    DateOnly? LastMovementAt);   // تاريخ آخر حركة — دلوقتي null

public sealed record PartyPayload(
    string Kind, string Name, string Phone, string Phone2, string Email, string City, string Address,
    string TaxNumber, string CommercialRegister, decimal CreditLimit, int PaymentTermDays,
    string PriceList, decimal OpeningBalance, string Notes, bool IsActive, bool IsExternal);

public sealed record PartyOption(string Id, string Code, string Name, string Kind, string Phone, decimal Balance, decimal CreditLimit);
```

> `Balance` و `LastMovementAt` هيتحسبوا من جدول قيود العملاء اللي هيتعمل في خطوة 12. اكتب الـ query دلوقتي من خلال interface `IPartyBalanceQuery` (implementation مؤقت = opening balance) وخطوة 12 هتبدله.

## 3) قاعدة "الدور"

`partyFits(kind, role)` = `kind == "both" || kind == role`. حطها في الـ Domain — هتتستخدم في الفواتير والسندات.

## 4) الـ Endpoints

### 4.1 `GET /api/parties` — paged
- Search: `name`, `code`, `phone`, `phone2`, `email`, `city`, `taxNumber`.
- فلاتر:
  - `kind`: لو `customer` أو `supplier` ← بـ `partyFits` (يعني `both` يظهر في الاتنين). لو `both` ← مساواة.
  - `status`: `active` | `inactive`.
  - `external`: `1` ← `isExternal = true`، أي قيمة تانية ← `false`.
  - `balance`: `debit` (> 0) | `credit` (< 0) | `zero` (= 0).
- sortBy: `code`, `name`, `kind`, `city`, `balance`, `creditLimit`, `lastMovementAt`, `createdAt`. الافتراضي `createdAt desc`.

### 4.2 `GET /api/parties/lookup?role=customer|supplier`
- Array `PartyOption` للنشطين فقط، ولو `role` مبعوت ← `partyFits`. مرتبة بالاسم.

### 4.3 `GET /api/parties/{id}` ← `PartyDto` أو 404 `الحساب غير موجود`.

### 4.4 `POST /api/parties` ← 201
- الكود: لو `kind = supplier` ← sequence `supplier` (SU) غير كده `customer` (CU).

### 4.5 `PUT /api/parties/{id}`
- **الكود مايتغيرش** حتى لو النوع اتغير.

### 4.6 `DELETE /api/parties/{id}`

## 5) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي أو أقل من حرفين | 422 | `الاسم مطلوب` |
| `kind` مش من التلاتة | 422 | `النوع غير صحيح` |
| `phone` (بعد شيل المسافات) مش مطابق `^01[0125]\d{8}$` | 422 | `رقم الموبايل غير صحيح` |
| `phone` مستخدم لحساب تاني | 409 | `رقم الموبايل مسجل لحساب آخر` |
| update: عليه حركات والنوع اتغير لحاجة غير `both` | 409 | `لا يمكن تغيير النوع لحساب عليه حركات — يمكنك جعله «عميل ومورد»` |
| update: عليه حركات و `openingBalance` اتغير | 409 | `لا يمكن تعديل الرصيد الافتتاحي لحساب عليه حركات — استخدم سند قيد للتسوية` |
| delete: عليه حركات | 409 | `لا يمكن حذف حساب عليه حركات — أوقفه بدلًا من ذلك` |

"عليه حركات" = ظاهر في أي مستند أو سند (خطوات 13 و 15) — `IPartyUsageChecker` مؤقت بيرجع false.

التطبيع:
- `phone`/`phone2`: شيل كل المسافات.
- باقي النصوص trim.
- `creditLimit = max(0, x)`، `paymentTermDays = max(0, round(x))`، `openingBalance = round2(x)`.
- `priceList`: لو `wholesale` تفضل، أي حاجة تانية ← `retail`.
- `isExternal`: bool.

لما الاسم يتغير: المستندات والسندات اللي فيها `partyName` متخزن (خطوات 13/15) لازم تتحدث — **أو** ماتخزنش الاسم واعمل join. القرار: خزّن الاسم في المستند كـ snapshot **وحدّثه** عند تعديل الحساب (زي سلوك الفرونت الحالي). سجّل ده في `PROGRESS.md` عشان خطوة 13.

## 6) الـ Seed (Development)

- **16 عميل قطاعي** (retail، بدون حد ائتمان): محمد عبد الله، سارة محمود، أحمد سمير، منى إبراهيم، كريم حسن، هبة علي، يوسف طارق، دينا فؤاد، عمر خالد، نورهان مصطفى، إسلام رمضان، ريهام عادل، مصطفى شريف، آية حمدي (موقوف)، حسام الدين نبيل، شيماء أشرف. كل خامس واحد عنده رصيد افتتاحي مدين صغير.
- **12 ورشة/شركة جملة** (wholesale، `creditLimit` من [150000, 250000, 100000, 400000]، `paymentTermDays` من [15, 30, 45]، رقم ضريبي وسجل وإيميل `info{n}@workshop.eg`، رصيد افتتاحي مدين): مركز الأمل لصيانة السيارات، ورشة النصر للميكانيكا، مركز سبيد سيرفيس، ورشة الحرية للكهرباء، **توكيل الشروق للسيارات (kind = both)**، مركز كار كير، ورشة الأخوين، شركة النيل للنقل، مركز الفارس لصيانة السيارات، شركة المستقبل لتأجير السيارات، ورشة الدلتا للعفشة، مركز الصفوة أوتو.
- **12 مورد** (wholesale، `paymentTermDays` من [30, 60, 45]، رصيد افتتاحي **دائن** سالب): الشركة المصرية لقطع الغيار، مؤسسة الخليج للتجارة، بوش مصر — الوكيل المعتمد، دينسو الشرق الأوسط، المتحدة لاستيراد قطع الغيار، شركة الأهرام للزيوت، النجم للإطارات، مصنع العربي للبطاريات، الدولية لقطع غيار السيارات الكورية، مؤسسة طيبة التجارية، شركة فالكون للإكسسوارات، الوطنية للفلاتر (موقوف).
- **4 عملاء نقطة بيع** (`isExternal = true`): عميل نقدي — طارق، عميل نقدي — مروة، عميل نقدي — باسم، عميل نقدي — هالة.
- المدن: القاهرة، الجيزة، الإسكندرية، المنصورة، طنطا، الزقازيق، 6 أكتوبر، بورسعيد. موبايلات صحيحة وفريدة.

## 7) الاختبارات

- CRUD + كل فلتر (خصوصًا `kind=customer` بيرجع `both`).
- lookup بـ role.
- موبايل غلط ← 422، مكرر ← 409.
- إنشاء مورد ← كود يبدأ `SU-`، عميل ← `CU-`.

## معايير القبول

- [ ] 6 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (09 ✅).


---
---

# الخطوة 10 — دليل الحسابات: `AccountsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **AccountsController** + شجرة الحسابات. الأرصدة الفعلية هتتحسب من القيود في خطوة 12 — دلوقتي من الرصيد الافتتاحي بس.

Route: `api/accounts`
- كل الـ endpoints: `[HasPermission("Accounts.View")]`
- `lookup`: `[HasAnyPermission("Accounts.View","Vouchers.View","Settings.Manage","Pos.Access")]`

---

## 1) الـ Entity

```csharp
Account {
  string Id;                 // ⚠️ دايمًا "acc-{Code}" — الفرونت كاتب acc-1101... ثابتين
  string Code;               // هرمي: 1 → 11 → 1101 — كود الابن بيبدأ بكود الأب. unique
  string Name;               // max 150
  string? ParentId;          // self FK
  int Level;                 // 1 = جذر
  string Type;               // asset | liability | equity | revenue | expense
  string Nature;             // debit | credit
  bool IsGroup;              // تجميعي: مايترحلش عليه — بيجمع أولاده بس
  bool CostCenterRequired;   // أي قيد عليه لازم مركز تكلفة
  string Currency;           // ISO-4217 — افتراضي EGP
  decimal OpeningBalance;    // على الجانب الطبيعي للحساب (موجب = طبيعي)
  string Notes;
  bool IsActive;
  bool IsSystem;             // حسابات النظام — ماتتمسحش
  DateTime CreatedAt;
}
```

## 2) الـ DTOs

```csharp
public sealed record AccountDto(
    string Id, string Code, string Name, string? ParentId, string? ParentName, int Level,
    string Type, string Nature, bool IsGroup, bool CostCenterRequired, string Currency,
    decimal OpeningBalance, string Notes, bool IsActive, bool IsSystem, DateTime CreatedAt,
    // ── محسوبة ──
    decimal Balance,       // على الجانب الطبيعي، ومجمّع لأعلى في الحسابات التجميعية
    decimal TotalDebit,    // Σ مدين (مجمّع)
    decimal TotalCredit,   // Σ دائن (مجمّع)
    int ChildrenCount);

public sealed record AccountPayload(
    string Name, string? ParentId, string Type, string Nature, bool IsGroup,
    bool CostCenterRequired, string Currency, decimal OpeningBalance, string Notes, bool IsActive);

public sealed record AccountOption(string Id, string Code, string Name, string Type, bool IsGroup, int Level, bool CostCenterRequired);
```

### حساب الرصيد (الخوارزمية)
لكل حساب: `net = (nature == debit ? opening : −opening) + Σdebit − Σcredit`.
وبعدين جمّع من الأوراق للجذور (الأعمق الأول): الأب += الابن (debit, credit, net).
وفي الآخر: `balance = nature == debit ? net : −net` (مقرب لرقمين).

دلوقتي Σdebit و Σcredit = 0 (من interface `IAccountTotalsQuery.GetTotalsAsync(DateOnly? asOf)` — خطوة 12 هتكتب الـ implementation الحقيقي).

## 3) الـ Endpoints

### 3.1 `GET /api/accounts?asOf=YYYY-MM-DD`
- **Array كاملة (مش paged)** — الشجرة صغيرة. كل الحسابات مرتبة بالكود (ترتيب نصي ordinal).
- `asOf` اختياري: الأرصدة لحد التاريخ ده (شامل).

### 3.2 `GET /api/accounts/lookup?leaf=1&group=1&type=expense`
- الحسابات **النشطة** فقط مرتبة بالكود.
- `leaf=1` ← غير التجميعية بس. `group=1` ← التجميعية بس. `type` ← نوع معين.

### 3.3 `GET /api/accounts/{id}` ← `AccountDto` أو 404 `الحساب غير موجود`.

### 3.4 `POST /api/accounts` ← 201
توليد الكود:
- من غير أب: أكبر كود جذر + 1.
- بأب: `parent.Code + رقم` — العرض (width) = **2** لو `parent.Level ≥ 2` أو لو فيه ابن موجود بكود أطول من الأب بخانتين، غير كده **1**. الرقم = أكبر لاحقة موجودة + 1، مبطّن بأصفار.
  - مثال: تحت `52` (level 2) أولاده `5201..5207` ← الجديد `5208`. تحت `1` (level 1) أولاده `11, 12` ← الجديد `13`.
- `Id = "acc-" + code`، `Level = parent.Level + 1` أو 1، `IsSystem = false`.

### 3.5 `PUT /api/accounts/{id}`
### 3.6 `DELETE /api/accounts/{id}`

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي | 422 | `اسم الحساب مطلوب` |
| `parentId` مش موجود | 404 | `الحساب الرئيسي غير موجود` |
| الأب مش تجميعي | 422 | `الحساب الرئيسي يجب أن يكون حسابًا تجميعيًا` |
| `type` غلط (لو مفيش أب) | 422 | `نوع الحساب غير صحيح` |
| نفس الاسم تحت نفس الأب | 409 | `يوجد حساب بنفس الاسم تحت نفس الحساب الرئيسي` |
| update: `parentId` اتغير | 409 | `لا يمكن نقل الحساب إلى أب آخر بعد إنشائه` |
| update: حساب نظامي و (`isGroup` اتغير أو `isActive=false`) | 409 | `حساب نظامي — لا يمكن إيقافه أو تغيير نوعه` |
| update: فرعي → تجميعي وعليه قيود | 409 | `لا يمكن تحويل حساب عليه قيود إلى حساب تجميعي` |
| update: تجميعي → فرعي وله أولاد | 409 | `لا يمكن تحويل حساب له حسابات فرعية إلى حساب فرعي` |
| delete: نظامي | 409 | `حساب نظامي — لا يمكن حذفه` |
| delete: له أولاد | 409 | `احذف الحسابات الفرعية أولًا` |
| delete: عليه قيود أو رصيد افتتاحي ≠ 0 | 409 | `لا يمكن حذف حساب عليه قيود أو رصيد — أوقفه بدلًا من ذلك` |
| delete: مربوط بسلف موظف | 409 | `الحساب مرتبط بسلف موظفين — فك الربط أولًا` |

قواعد التطبيع:
- **النوع بيتورث من الأب** (لو فيه أب، تجاهل `type` اللي جاي).
- `nature`: لو `debit`/`credit` استخدمه، غير كده الافتراضي حسب النوع: asset/expense → debit، liability/equity/revenue → credit.
- `currency` الفاضي → `EGP`.
- الحساب التجميعي: `openingBalance = 0` و `costCenterRequired = false`.
- `notes` trim.

"عليه قيود" و "مربوط بموظف" بيعتمدوا على خطوات 12 و 17 — interfaces مؤقتة بترجع false.

## 5) الـ Seed — **إلزامي في كل البيئات (مش Development بس)** لأن النظام بيرحّل عليها

`[code, name, isGroup, openingBalance]` — الأب = أطول كود سابق بيبدأ بيه الكود. النوع من أول رقم: 1 أصول، 2 خصوم، 3 حقوق ملكية، 4 إيرادات، 5 مصروفات.

```
1    الأصول                         group
11   الأصول المتداولة               group
1101 الصندوق الرئيسي                185000      ★
1102 البنك الأهلي — حساب جاري       1240000     ★
1103 العملاء                         0           ★
1104 المخزون                         0           ★  (⚠️ الرصيد الافتتاحي هيدخل بسندات استلام في خطوة 13)
1105 خزينة نقطة البيع               25000       ★
1106 سلف الموظفين                   18000
12   الأصول الثابتة                 group
1201 السيارات                       920000
1202 الأثاث والتجهيزات              340000
1203 أجهزة الحاسب                   165000
2    الخصوم                         group
21   الخصوم المتداولة               group
2101 الموردون                       0           ★
2102 مصروفات مستحقة                 42000
22   الضرائب                        group
2201 ضريبة القيمة المضافة           36500       ★
3    حقوق الملكية                   group
3101 رأس المال                      5000000     ★
3102 الأرباح المحتجزة               (تُحسب — انظر تحت)
4    الإيرادات                      group
4101 المبيعات                       0           ★
4102 مردودات المبيعات               0           ★
4103 إيرادات أخرى                   0
5    المصروفات                      group
51   تكلفة المبيعات                 group
5101 تكلفة البضاعة المباعة          0           ★
52   المصروفات التشغيلية            group
5201 الرواتب والأجور                0   (يتطلب مركز تكلفة)
5202 الإيجارات                       0   (يتطلب مركز تكلفة)
5203 الكهرباء والمياه                0   (يتطلب مركز تكلفة)
5204 النقل والشحن                    0   (يتطلب مركز تكلفة)
5205 الدعاية والتسويق                0   (يتطلب مركز تكلفة)
5206 صيانة وإصلاحات                 0
5207 مصروفات بنكية                  0
```
- ★ = `IsSystem = true`. وكمان الجذور الخمسة (1..5) `IsSystem = true`.
- **الأرباح المحتجزة (3102)**: احسبها في الـ seed بحيث ميزان المراجعة الافتتاحي يتزن: `Σ أرصدة الأصول المدينة − Σ الخصوم − رأس المال`. (المخزون الافتتاحي هيتقابل مع 3102 في سندات الاستلام بسبب "رصيد افتتاحي" — خطوة 12/13.)
- في Production: الـ Seed بيعمل الشجرة بأرصدة افتتاحية **صفر** (الأرقام دي للـ Development).

ثوابت لازم تتعمل في `XTurbo.Domain/Accounting/SystemAccounts.cs`:
```csharp
Cash = "acc-1101", Bank = "acc-1102", Customers = "acc-1103", Inventory = "acc-1104",
PosCash = "acc-1105", Suppliers = "acc-2101", Vat = "acc-2201", Capital = "acc-3101",
RetainedEarnings = "acc-3102", Sales = "acc-4101", SalesReturns = "acc-4102",
OtherIncome = "acc-4103", Cogs = "acc-5101"
// الخزائن اللي الفلوس بتتحرك فيها (سندات القبض والصرف):
CashAccounts = [Cash, Bank, PosCash]
```

## 6) الاختبارات

- `GET /accounts` بيرجع الشجرة مرتبة، والـ `balance` للجذر `1` = مجموع أرصدة أولاده.
- توليد الكود تحت `52` و تحت `1` و جذر جديد (`6`).
- كل قاعدة في الجدول ليها test.
- lookup بـ `leaf=1&type=expense`.

## معايير القبول

- [ ] 6 endpoints مطابقة للعقد، والـ IDs بشكل `acc-{code}`.
- [ ] Seed الشجرة في كل البيئات + ثوابت `SystemAccounts`.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (10 ✅).


---
---

# الخطوة 11 — مراكز التكلفة: `CostCentersController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **CostCentersController بس**.

مركز التكلفة بيتعلّم على قيود المصروفات والإيرادات عشان التحليل والموازنة (فرع، قسم، نشاط…).

Route: `api/cost-centers`
- كل الـ endpoints: `[HasPermission("Accounts.View")]`
- `lookup`: `[HasAnyPermission("Accounts.View","Vouchers.View")]`

---

## 1) الـ Entity

```csharp
CostCenter {
  string Id;
  string Code;             // CC-01 — NumberSequences key "cost-center" (Prefix CC, Digits 2)
  string Name;             // unique, max 100
  string? ParentId;        // self FK (اختياري)
  string Manager;
  decimal AnnualBudget;    // الإنفاق السنوي المخطط، 0 = مفيش
  string Color;            // hex
  string Notes;
  bool IsActive;
  DateTime CreatedAt;
  string SearchText;       // name + code + manager
}
```

## 2) الـ DTOs

```csharp
public sealed record CostCenterDto(
    string Id, string Code, string Name, string? ParentId, string? ParentName,
    string Manager, decimal AnnualBudget, string Color, string Notes, bool IsActive, DateTime CreatedAt,
    // ── محسوبة (السنة الميلادية الحالية) ──
    decimal ActualSpend,     // Σ(debit − credit) لقيود حسابات نوعها expense متعلمة بالمركز ده
    decimal ActualRevenue,   // Σ(credit − debit) لقيود حسابات نوعها revenue متعلمة بالمركز ده
    int PostingsCount);      // عدد سطور القيود المتعلمة بالمركز في السنة

public sealed record CostCenterPayload(string Name, string? ParentId, string Manager, decimal AnnualBudget, string Color, string Notes, bool IsActive);

public sealed record CostCenterOption(string Id, string Code, string Name, string Color);
```
> الإحصائيات من جدول القيود (خطوة 12) — دلوقتي أصفار عن طريق `ICostCenterStatsQuery` مؤقت.

## 3) الـ Endpoints

### 3.1 `GET /api/cost-centers` — paged
- Search: `name`, `code`, `manager`.
- فلتر: `status` = `active` | `inactive`.
- sortBy: `code`, `name`, `manager`, `annualBudget`, `actualSpend`, `actualRevenue`, `postingsCount`, `createdAt`. الافتراضي `code asc`.

### 3.2 `GET /api/cost-centers/lookup` ← Array للنشطة فقط مرتبة بالكود.
### 3.3 `POST /api/cost-centers` ← 201
### 3.4 `PUT /api/cost-centers/{id}`
### 3.5 `DELETE /api/cost-centers/{id}`

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي | 422 | `اسم مركز التكلفة مطلوب` |
| اسم مكرر | 409 | `يوجد مركز تكلفة بنفس الاسم` |
| `parentId` مش موجود | 404 | `المركز الرئيسي غير موجود` |
| update: `parentId == id` | 422 | `لا يمكن أن يكون المركز أبًا لنفسه` |
| update: الأب واحد من أحفاده | 422 | `لا يمكن نقل المركز تحت أحد مراكزه الفرعية` |
| delete: عليه قيود | 409 | `لا يمكن حذف مركز عليه قيود — أوقفه بدلًا من ذلك` |
| delete: له مراكز فرعية | 409 | `احذف المراكز الفرعية أولًا` |
| delete: فيه موظفين تابعين | 409 | `يوجد موظفون تابعون لهذا المركز — انقلهم أولًا` |
| delete: مربوط بمخزن | 409 | `المركز مرتبط بمخزن — فك الربط أولًا` |
| مش موجود | 404 | `مركز التكلفة غير موجود` |

- التطبيع: `parentId` الفاضي → null، `manager`/`notes` trim، `annualBudget = max(0, x)`، اللون الفاضي/الغلط → `#64748b`.
- شروط "عليه قيود" و "موظفين" من خطوات 12 و 17 — interfaces مؤقتة.

## 5) ربط المخازن بمراكز التكلفة

القيود اللي بتطلع من مستندات مخزن معين بتتعلم بمركز التكلفة بتاع المخزن (`Warehouse.CostCenterId` — عمود داخلي من خطوة 07). في الـ seed اربط:

| المخزن | المركز |
|---|---|
| `wh-cai` | المخزن الرئيسي |
| `wh-alx` | فرع الإسكندرية |
| `wh-giz` | فرع الجيزة |
| `wh-oct` | فرع 6 أكتوبر |
| `wh-shw` | صالة عرض التجمع |

## 6) الـ Seed (Development)

| Id | الكود | الاسم | المدير | الموازنة السنوية |
|---|---|---|---|---|
| cc-1 | CC-01 | الإدارة العامة | أحمد حسن | 1,800,000 |
| cc-2 | CC-02 | المخزن الرئيسي | منى عادل | 950,000 |
| cc-3 | CC-03 | فرع الإسكندرية | كريم السيد | 620,000 |
| cc-4 | CC-04 | فرع الجيزة | هاني فؤاد | 540,000 |
| cc-5 | CC-05 | فرع 6 أكتوبر | سامح رأفت | 480,000 |
| cc-6 | CC-06 | صالة عرض التجمع | ياسمين فتحي | 410,000 |
| cc-7 | CC-07 | المتجر الإلكتروني | خالد عادل | 720,000 |
| cc-8 | CC-08 | التوصيل والشحن | رضا محمود | 360,000 |

ألوان مختلفة من: `#e31e24 #f97316 #eab308 #22c55e #14b8a6 #0ea5e9 #6366f1 #a855f7`.

## 7) الاختبارات

- CRUD + القواعد + lookup.

## معايير القبول

- [ ] 5 endpoints مطابقة للعقد + ربط المخازن بالمراكز.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (11 ✅).


---
---

# الخطوة 12 — محرك القيود المحاسبية (Posting Engine)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي **مفيهاش Controller جديد** — هنبني القلب المحاسبي اللي المستندات (13–14) والسندات (15) هتستخدمه، ونوصّل الأرصدة الحقيقية في الحسابات ومراكز التكلفة والعملاء.

المبدأ: **أي حاجة مالية بتتسجل كقيد وقت الترحيل** (مش بتتحسب كل مرة). القيد ليه مصدر (`SourceId`)، ولو المصدر اتلغى القيد بيتعلم `IsVoided` ويختفي من كل الحسابات (بس يفضل موجود للمراجعة).

---

## 1) الجداول

```csharp
// سطر قيد في دفتر الأستاذ العام
GlEntry {
  long Id;                    // identity
  string AccountId;           // حساب فرعي (leaf) دايمًا
  DateOnly Date;
  decimal Debit; decimal Credit;   // واحد منهم بس > 0
  string? CostCenterId;
  string SourceType;          // document | voucher | opening
  string SourceId;            // id المستند / السند / الحساب (party) للافتتاحي
  string SourceKind;          // sale, purchase... أو receipt/payment/journal أو party-opening
  string Number;              // رقم المستند/السند أو كود العميل
  string Description;
  bool IsVoided;  DateTime? VoidedAt;
  DateTime CreatedAt;
}
// Indexes: (AccountId, Date) WHERE IsVoided=0 ، (SourceId) ، (CostCenterId, Date)

// سطر في كشف حساب عميل/مورد
PartyLedgerEntry {
  long Id;
  string PartyId;
  DateOnly Date;
  DateTime At;                // للترتيب داخل نفس اليوم
  decimal Debit; decimal Credit;
  string SourceType;          // document | voucher
  string SourceId; string SourceKind; string Number;
  string Description;
  bool IsVoided;
}
// Index: (PartyId, Date, At) WHERE IsVoided=0
```

**قاعدة ذهبية:** كل مجموعة قيود لمصدر واحد لازم Σdebit = Σcredit (بعد التقريب لرقمين). لو مش متزنة ← exception (bug) ومفيش حفظ.

## 2) الواجهة

```csharp
public interface IPostingEngine {
    Task PostDocumentAsync(Document doc, CancellationToken ct);      // خطوة 14 هتناديه عند الترحيل/الإتمام
    Task PostVoucherAsync(Voucher v, CancellationToken ct);          // خطوة 15
    Task VoidSourceAsync(string sourceId, CancellationToken ct);     // عند الإلغاء — يعلّم GL و Party entries
    Task SyncPartyOpeningAsync(Party party, CancellationToken ct);   // عند إنشاء/تعديل عميل
}
```
كله يشتغل **جوه الـ transaction بتاعة العملية الأصلية** (نفس `DbContext`، من غير `SaveChanges` منفصل).

## 3) قواعد الترحيل (Posting Rules)

تعريفات:
- `net = subtotal − discount` (قبل الضريبة)
- `cash` = حساب التسوية حسب طريقة الدفع:
  - `cash` + قناة `pos` ← خزينة نقطة البيع (`acc-1105` — في خطوة 20 هتبقى `PosSettings.CashAccountId`)
  - `cash` + قناة `erp` ← `acc-1101` الصندوق الرئيسي
  - `card` / `wallet` / `bank` ← `acc-1102` البنك
  - `credit` ← مفيش فلوس اتدفعت (paid = 0 غالبًا)
- `receivable(party)` = `acc-1103` العملاء، `payable(party)` = `acc-2101` الموردين. **لو** الحساب نوعه مايناسبش (مثلًا مورد في فاتورة بيع) استخدم الحساب التاني حسب `partyFits`.
- `cost` = Σ(qty × **تكلفة الصنف وقت الترحيل**). خزّن `UnitCost` على سطر المستند عند الترحيل (snapshot) عشان الإلغاء والتقارير يبقوا ثابتين.
- `cc` = مركز تكلفة المخزن (`Warehouse.CostCenterId`) — بيتحط على كل سطور قيود المستند.
- أي سطر قيمته 0 مايتكتبش.

| المستند | مدين | دائن |
|---|---|---|
| **sale** فاتورة بيع | cash ← `paid` · receivable ← `remaining` · COGS `5101` ← `cost` | Sales `4101` ← `net` · VAT `2201` ← `tax` · Inventory `1104` ← `cost` |
| **sale-return** مرتجع بيع | Sales Returns `4102` ← `net` · VAT ← `tax` · Inventory ← `cost` | cash ← `paid` · receivable ← `remaining` · COGS ← `cost` |
| **purchase** فاتورة شراء | Inventory ← `net` · VAT ← `tax` | cash ← `paid` · payable ← `remaining` |
| **purchase-return** مرتجع شراء | cash ← `paid` · payable ← `remaining` | Inventory ← `net` · VAT ← `tax` |
| **goods-issue** سند صرف | COGS ← `value` | Inventory ← `value` |
| **goods-receipt** سند استلام | Inventory ← `value` | لو السبب `opening` ← Retained Earnings `3102`، غير كده ← Other Income `4103` |
| transfer / voucher-transfer / reservation / quotation | — (مفيش قيد مالي) | — |

`value` لسندات الصرف/الاستلام = Σ(qty × price) — السعر هنا هو التكلفة.

### السندات (Vouchers)
| السند | مدين | دائن |
|---|---|---|
| **receipt** سند قبض | `cashAccountId` ← amount (بدون مركز تكلفة) | المقابل ← amount (بمركز تكلفة السند) |
| **payment** سند صرف | المقابل ← amount (بمركز تكلفة السند) | `cashAccountId` ← amount |
| **journal** سند قيد | كل سطر كما هو (account, debit, credit, costCenterId, note أو بيان السند) | |

المقابل: لو `counterpartyType = party` ← receivable (للقبض) / payable (للصرف) حسب `partyFits`. لو `account` ← `accountId`.

### الرصيد الافتتاحي للعميل/المورد
- `SyncPartyOpeningAsync`: علّم القيود القديمة (`SourceType=opening, SourceId=party.Id`) `IsVoided` واكتب جديدة لو `openingBalance ≠ 0`:
  - موجب (مدين) ← مدين `1103` / دائن `3102`
  - سالب (دائن) ← مدين `3102` / دائن `2101`
  - التاريخ = `0001-01-01` (ثابت `LedgerDates.Opening`)، الوصف `رصيد افتتاحي — {الاسم}`، الرقم = كود العميل.
- **مش** بيتكتب في `PartyLedgerEntry` (الرصيد الافتتاحي متخزن على الـ party نفسه، والكشف بيبدأ منه).
- اربطه في `PartiesService` (خطوة 09) عند الإنشاء والتعديل، ولكل العملاء في الـ seed.

## 4) قيود العملاء (PartyLedgerEntry)

بتتكتب لمستندات `sale`, `purchase`, `sale-return`, `purchase-return` اللي ليها `partyId`، وللسندات `receipt`/`payment` اللي `counterpartyType = party`:

| المصدر | الوصف | مدين | دائن |
|---|---|---|---|
| sale / purchase-return | `{الاسم المفرد}` + (` — {reference}` لو موجود) | total | 0 |
| purchase / sale-return | نفس الشكل | 0 | total |
| لو `paid > 0` — سطر تاني بعده (`At` = نفس الوقت + 1 tick) | sale/purchase-return: `تحصيل مع {المفرد}` · purchase/sale-return: `سداد مع {المفرد}` | purchase/sale-return: paid | sale/purchase-return: paid |
| receipt | `سند قبض` + (` — {description}`) | 0 | amount |
| payment | `سند صرف` + (` — {description}`) | amount | 0 |

الأسماء المفردة: sale=`فاتورة بيع`، purchase=`فاتورة شراء`، sale-return=`مرتجع بيع`، purchase-return=`مرتجع شراء`.

## 5) استبدال الـ Implementations المؤقتة

- `IAccountTotalsQuery` (خطوة 10): Σdebit/Σcredit لكل حساب من `GlEntry` (غير ملغية، و `Date ≤ asOf` لو مبعوت) — query واحد `GROUP BY AccountId`.
- `IAccountUsageChecker` (خطوة 10): الحساب عليه قيود = فيه `GlEntry` (حتى لو ملغي) **أو** مستخدم في سند (خطوة 15).
- `ICostCenterStatsQuery` (خطوة 11): للسنة الحالية — join مع نوع الحساب.
- `ICostCenterUsageChecker` (خطوة 11): فيه `GlEntry` بالمركز.
- `IPartyBalanceQuery` (خطوة 09): `balance = opening + Σ(debit − credit)`، `lastMovementAt = max(Date)` — query واحد مجمّع لكل القائمة (مش N+1).

## 6) أدوات تشخيص

- `ITrialBalanceService.GetAsync(DateOnly? asOf)` ← Σ مدين و Σ دائن لكل الحسابات + `IsBalanced`.
- Endpoint داخلي اختياري `GET /api/accounts/trial-balance` بصلاحية `Accounts.View` (الفرونت مش بيستخدمه، بس مفيد للمراجعة).

## 7) الاختبارات (unit + integration)

لكل نوع مستند وسند: ابني object، نادي المحرك، وتأكد من السطور والمبالغ بالظبط وإن القيد متزن. ومنها:
- فاتورة بيع آجلة جزئيًا (paid 300 من 1140 شامل 14% ضريبة).
- مرتجع بيع نقدي.
- سند استلام بسبب `opening` ← 3102، وبسبب `surplus` ← 4103.
- سند قبض من عميل ← party entry دائن.
- Void ← الرصيد يرجع زي ما كان.
- عميل برصيد افتتاحي −5000 ← قيد 3102/2101 وميزان المراجعة متزن.
- بعد الـ seed كله: `TrialBalance.IsBalanced == true`.

## معايير القبول

- [ ] الجدولين + `IPostingEngine` + كل الـ implementations الحقيقية.
- [ ] `GET /api/accounts` بقى بيرجع أرصدة من القيود، و `GET /api/parties` بقى بيرجع `balance` حقيقي.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (12 ✅).


---
---

# الخطوة 13 — المستندات التجارية والمخزنية: `DocumentsController` (الجزء 1 — CRUD)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **list / stats / get / create / update / delete** للمستندات. الترحيل والإلغاء والتحويل (post/complete/cancel/convert) في خطوة 14.

كل المستندات (فواتير بيع وشراء، مرتجعات، عروض أسعار، تحويلات، سندات صرف واستلام بضاعة، حجوزات) **ليها شكل واحد**: رأس + سطور أصناف + إجماليات، والفرق في `kind` بس.

Route: `api/documents` — `[HasAnyPermission("Invoices.View","Pos.Access")]`.

---

## 1) الأنواع وإعداداتها (حطها في الـ Domain كـ `DocKindConfig` — هي اللي بتتحكم في التحقق والتأثير)

| kind | الاسم المفرد | Prefix | الطرف | الطرف إلزامي | تحويل لمخزن تاني | مالي (خصم/ضريبة/دفع) | تأثير المخزون | `dueDate` مستخدم | الأسباب | يتحول إلى |
|---|---|---|---|---|---|---|---|---|---|---|
| `quotation` | عرض سعر | QT | customer | ✅ | ❌ | ✅ | none | ✅ (صالح حتى) | — | sale |
| `sale` | فاتورة بيع | SI | customer | ❌ | ❌ | ✅ | out | ✅ | — | sale-return |
| `purchase` | فاتورة شراء | PI | supplier | ✅ | ❌ | ✅ | in | ✅ | — | purchase-return |
| `sale-return` | مرتجع بيع | SR | customer | ❌ | ❌ | ✅ | in | ❌ | — | — |
| `purchase-return` | مرتجع شراء | PR | supplier | ✅ | ❌ | ✅ | out | ❌ | — | — |
| `transfer` | تحويل مخزني | TR | — | ❌ | ✅ | ❌ | move | ❌ | — | — |
| `voucher-transfer` | تحويل بسند | VT | — | ❌ | ✅ | ❌ | ship | ❌ | — | — |
| `goods-issue` | سند صرف | GI | — | ❌ | ❌ | ❌ | out | ❌ | consumption, damage, sample, shortage, other | — |
| `goods-receipt` | سند استلام | GRN | — | ❌ | ❌ | ❌ | in | ❌ | opening, surplus, production, other | — |
| `reservation` | حجز طلبية | RS | customer | ✅ | ❌ | ✅ | reserve | ✅ (موعد الاستلام) | — | — |

- "يحتاج إتمام (complete)": `voucher-transfer` و `reservation` بس.
- الحالات: `draft` (مسودة — مفيش تأثير) → `posted` (مُرحّل — التأثير اتطبق) → `completed` (مكتمل) أو `cancelled` (ملغي — التأثير اتعكس).
- طرق الدفع: `cash | card | wallet | bank | credit`.
- القنوات: `erp | pos`.

## 2) الـ Entities

```csharp
Document {
  string Id; string Kind; string Number;     // unique (Kind, Number)
  DateOnly Date; DateOnly? DueDate;
  string? PartyId; string? PartyName;        // snapshot للاسم — يتحدث لما الحساب يتغير اسمه
  string WarehouseId; string WarehouseName;  // snapshot
  string? ToWarehouseId; string? ToWarehouseName;
  string Reference;                          // رقم فاتورة المورد / مرجع
  string? Reason;                            // لسندات الصرف/الاستلام
  string? PaymentMethod;
  decimal Subtotal, Discount, TaxPct, Tax, Total, Paid, Remaining;
  string Status;                             // draft | posted | completed | cancelled
  string Channel;                            // erp | pos
  string? SourceId; string? SourceNumber;    // المستند اللي اتعمل منه
  string? TargetId; string? TargetNumber;    // المستند اللي اتعمل منه (للأمام)
  string Notes;
  string CreatedBy; DateTime CreatedAt; DateTime? PostedAt;
  byte[] RowVersion;
  List<DocumentLine> Lines;
  string SearchText;   // number + partyName + reference + warehouseName + toWarehouseName + notes + createdBy
}
DocumentLine {
  long Id; string DocumentId; int LineNo;
  string ItemId; string Code; string Name; string Unit;   // snapshot من الصنف
  decimal Qty; decimal Price; decimal DiscountPct; decimal Total;
  decimal? UnitCost;   // يتملى وقت الترحيل (خطوة 12/14)
}
```
- حدّث `PartiesService` (خطوة 09) إنه يحدّث `PartyName` في المستندات لما الاسم يتغير، و `WarehousesService` (خطوة 07) يحدّث `WarehouseName`/`ToWarehouseName`.
- حدّث الـ usage checkers: `IItemUsageChecker`، `IWarehouseUsageChecker`، `IPartyUsageChecker` إنهم يشوفوا جدول المستندات.
- `INumberCollisionChecker` (خطوة 04) يشوف `(Kind, Number)`.

## 3) الحسابات (لازم تتطابق مع الفرونت بالظبط)

```
round2(x)          = Math.Round(x, 2, AwayFromZero)
lineTotal          = round2(qty × price × (1 − clamp(discountPct,0,100)/100))
subtotal           = round2(Σ lineTotal)
discount           = round2(clamp(discount, 0, subtotal))
tax                = round2((subtotal − discount) × max(taxPct,0) / 100)     ← الضريبة بعد الخصم
total              = round2(subtotal − discount + tax)
remaining          = round2(max(total − max(paid,0), 0))
```
حطها في `DocumentMath` + unit tests بأرقام معروفة.

## 4) بناء المستند من الـ Payload (التحقق) — نفس الدالة للإنشاء والتعديل

Payload:
```json
{
  "kind": "sale", "date": "2026-11-09", "dueDate": null,
  "partyId": "…", "warehouseId": "wh-cai", "toWarehouseId": null,
  "reference": "", "reason": null, "paymentMethod": "cash",
  "lines": [ { "itemId": "…", "qty": 2, "price": 1450, "discountPct": 0 } ],
  "discount": 0, "taxPct": 14, "paid": 3306, "notes": "",
  "channel": "erp",
  "post": false
}
```

بالترتيب:
1. `kind` مش معروف ← 422 `نوع المستند غير معروف`.
2. المخزن مش موجود ← 404 `المخزن غير موجود`؛ موقوف ← 422 `المخزن «{name}» موقوف`.
3. لو النوع تحويل: المخزن المستلم مش موجود ← 404 `المخزن المستلم غير موجود`؛ هو نفس المخزن ← 422 `المخزن المستلم يجب أن يختلف عن المخزن المحوِّل`.
4. لو النوع ليه طرف و `partyId` مبعوت: مش موجود ← 404 `الحساب غير موجود`؛ مش مناسب (`partyFits`) ← 422 `«{name}» ليس عميلًا` أو `«{name}» ليس موردًا`.
5. الطرف إلزامي ومش موجود ← 422 `اختر العميل` (أو `اختر المورد` للمورد).
6. النوع ليه أسباب و `reason` فاضي أو مش من القائمة ← 422 `اختر سبب الحركة`.
7. `lines` فاضية ← 422 `أضف صنفًا واحدًا على الأقل`.
8. لكل سطر `i` (من 1): الصنف مش موجود ← 422 `الصنف في السطر {i} غير موجود`؛ `qty ≤ 0` ← 422 `الكمية في السطر {i} يجب أن تكون أكبر من صفر`. `price = max(0, price)`، `discountPct = clamp(0..100)`. الكود/الاسم/الوحدة من الصنف.
9. لو مش مالي: `taxPct = 0`, `discount = 0`.
10. `paid`: لو مالي و تأثيره مش `none` ← `clamp(paid, 0, total)`، غير كده 0 (عرض السعر مفيهوش دفع؛ الحجز بياخد عربون).
11. لو مالي و تأثيره ≠ none و النوع ≠ reservation و `remaining > 0` ومفيش طرف ← 422 `البيع / الشراء الآجل يتطلب تحديد الحساب`.
12. `date` الفاضي ← النهارده. `dueDate` يتحفظ بس لو النوع بيستخدمه، غير كده null.
13. `reason` يتحفظ بس لو النوع ليه أسباب.
14. `paymentMethod`: لو مالي و تأثير ≠ none: لو `remaining > 0 && paid == 0` ← `credit`، غير كده اللي جاي أو `cash`. غير كده null.
15. `channel`: من الـ payload، أو القديم (في التعديل)، أو `erp`.
16. `reference` و `notes` trim.

### المرتجعات المربوطة بفاتورة
لو المستند مرتجع وليه `SourceId` (اتعمل بالتحويل في خطوة 14): لكل صنف، الكمية ≤ (كمية الفاتورة الأصلية − مرتجعات تانية غير ملغية من نفس الفاتورة، من غير المستند ده نفسه) ← غير كده 422 `لا يمكن إرجاع {qty} من «{name}» — المتاح للإرجاع {max}`.

## 5) الـ DTOs

```csharp
// صف القائمة = الرأس كله + عدّادات (من غير السطور)
DocumentSummaryDto : (كل حقول الرأس) + int LinesCount + decimal TotalQty
// GET by id = الرأس + السطور
DocumentDto : (كل حقول الرأس) + IReadOnlyList<DocLineDto> Lines
DocLineDto(string ItemId, string Code, string Name, string Unit, decimal Qty, decimal Price, decimal DiscountPct, decimal Total)

DocumentStatsDto(int Count, int Draft, int Posted, int Completed, int Cancelled,
                 decimal Total, decimal Paid, decimal Remaining, decimal TotalQty)
```
حقول الرأس بالترتيب: `id, kind, number, date, dueDate, partyId, partyName, warehouseId, warehouseName, toWarehouseId, toWarehouseName, reference, reason, paymentMethod, subtotal, discount, taxPct, tax, total, paid, remaining, status, channel, sourceId, sourceNumber, targetId, targetNumber, notes, createdBy, createdAt, postedAt`. (`UnitCost` **مايطلعش** في الـ API.)

## 6) الـ Endpoints

### 6.1 `GET /api/documents?kind=sale&...` — paged
- Search: `number`, `partyName`, `reference`, `warehouseName`, `toWarehouseName`, `notes`, `createdBy`.
- فلاتر:
  - `kind` — مساواة (الشاشات دايمًا بتبعته).
  - `status`.
  - `partyId`.
  - `warehouseId` — المخزن **أو** المخزن المستلم.
  - `channel` — `erp` | `pos`.
  - `payment` — `paid` (`remaining ≤ 0`) | `unpaid` (`paid ≤ 0 && remaining > 0`) | `partial` (`paid > 0 && remaining > 0`).
  - `overdue` — أي قيمة: `dueDate != null && remaining > 0 && status == posted && dueDate < النهارده`.
  - `from` / `to` — على `date` شاملين.
- sortBy: `number`, `date`, `dueDate`, `partyName`, `warehouseName`, `total`, `paid`, `remaining`, `status`, `createdAt`. **الافتراضي `createdAt desc`**.

### 6.2 `GET /api/documents/stats?kind=…` — نفس الفلاتر **ما عدا `status` بيتجاهل** (عشان عدّادات التابات)
- `count/draft/posted/completed/cancelled` على كل الصفوف.
- `total/paid/remaining/totalQty` على الصفوف **غير الملغية** بس.

### 6.3 `GET /api/documents/{id}` ← `DocumentDto` أو 404 `المستند غير موجود`.

### 6.4 `POST /api/documents` ← 201 + `DocumentDto`
- يبني ويتحقق (بند 4)، الرقم من `NumberSequences` key `doc:{kind}`، الحالة `draft`، `CreatedBy` = اسم المستخدم.
- `post: true` ← يرحّل فورًا في **نفس الـ transaction** (المنطق في خطوة 14). لو الترحيل فشل ← **مايتحفظش أي حاجة** (ولا حتى المسودة، ولا الرقم يتحرق — رجّع الـ sequence في نفس الـ transaction). في الخطوة دي اعمل الـ hook `IDocumentWorkflow.PostAsync` واتركه `NotImplemented` لحد خطوة 14 (والـ test بتاعه skipped).

### 6.5 `PUT /api/documents/{id}` — **مسودات بس**
- مش مسودة ← 409 `لا يمكن تعديل مستند مُرحّل — ألغِه وأنشئ غيره`.
- `kind` مختلف ← 422 `لا يمكن تغيير نوع المستند`.
- يعيد بناء الرأس والسطور (استبدال كامل للسطور)، ويعيد فحص المرتجع لو مربوط.
- `post: true` ← يرحّل بعد الحفظ.

### 6.6 `DELETE /api/documents/{id}` — **مسودات بس**
- مش مسودة ← 409 `يمكن حذف المسودات فقط — ألغِ المستند بدلًا من ذلك`.
- لو مستند تاني بيشاور عليه بـ `TargetId` (مثلًا عرض سعر اتحول للمسودة دي) ← رجّع الأصل لحالته (`status = posted`، `TargetId/Number = null`).

## 7) الاختبارات

- `DocumentMath` بأرقام فيها خصم سطر + خصم رأس + ضريبة.
- كل قاعدة تحقق في بند 4 ليها test.
- فلاتر `payment` و `overdue` و `warehouseId` (للمستلم).
- stats بتتجاهل `status` وبتستبعد الملغي من المبالغ.
- تعديل/حذف مستند مش مسودة ← 409.

## معايير القبول

- [ ] 6 endpoints مطابقة للعقد + `DocKindConfig` في الـ Domain.
- [ ] الـ snapshots (اسم الطرف/المخزن) بتتحدث.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (13 ✅).


---
---

# الخطوة 14 — دورة حياة المستندات: `DocumentsController` (الجزء 2 — Workflow)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **post / complete / cancel / convert** + تأثير المخزون + القيود + سجل حركات المخزون. هتستخدم `IStockLedger` (خطوة 07) و `IPostingEngine` (خطوة 12).

نفس الـ Controller ونفس الصلاحية: `[HasAnyPermission("Invoices.View","Pos.Access")]`.

**كل عملية هنا = transaction واحدة.** لو أي جزء فشل، مفيش أي أثر (مخزون، قيود، حالة).

---

## 1) جدول حركات المخزون (جديد)

```csharp
StockMovement {
  long Id;
  string ItemId; string WarehouseId;
  decimal Qty;                 // بإشارة: + دخول / − خروج
  DateOnly Date; DateTime At;
  string DocumentId; string DocumentNumber; string DocumentKind;
  string? PartyName;
  bool IsVoided;
}
// Index: (ItemId, At DESC) WHERE IsVoided = 0
```
- كل `AdjustQtyAsync` في `IStockLedger` لازم يكتب حركة (عدّل `IStockLedger` ياخد بيانات المستند).
- الحجز (`reserve`) **مش** حركة.
- كمّل `GET /api/stock/items/{itemId}` (خطوة 08): `movements` = آخر 30 حركة غير ملغية، الأحدث الأول، و `kindLabel` = الاسم المفرد من `DocKindConfig`.

## 2) تأثير الترحيل على المخزون (`applyEffects(sign)`)

لكل سطر (`q = qty × sign`):
| التأثير | العملية |
|---|---|
| `out` | المخزن: −q |
| `in` | المخزن: +q |
| `move` | المخزن: −q ، المخزن المستلم: +q |
| `ship` | المخزن: −q (الاستلام عند الإتمام) |
| `reserve` | المحجوز في المخزن: +q |
| `none` | مفيش |

`sign = +1` عند الترحيل، `−1` عند الإلغاء (والحركات المرتبطة تتعلم `IsVoided`).

## 3) الـ Endpoints

### 3.1 `POST /api/documents/{id}/post` — مسودة ← مُرحّل
Body: `{}` ← يرجع `DocumentDto`.
1. مش مسودة ← 409 `المستند مُرحّل بالفعل`.
2. لو التأثير `out` / `move` / `ship` / `reserve`: `IStockLedger.AssertAvailableAsync(warehouseId, lines)` — الكمية المطلوبة لكل صنف (مجمّعة) ≤ `qty − reserved`، إلا لو المخزن `AllowNegative` أو الإعداد العام `allowNegativeStock`. الرسالة: 409 `الكمية غير متاحة: «{اسم الصنف}» — المتاح في {اسم المخزن} {max(available,0)} {الوحدة}`.
3. **حد الائتمان**: لو `kind == sale` وليه طرف و `remaining > 0` والطرف `creditLimit > 0`: `exposure = رصيد الطرف الحالي + remaining`. لو `exposure > creditLimit` ← 409 `تجاوز حد الائتمان لـ«{name}»: الحد {creditLimit بفواصل آلاف} والمديونية بعد الفاتورة {round(exposure) بفواصل آلاف}` (الأرقام بأرقام إنجليزي `N0`).
4. خزّن `UnitCost` لكل سطر = سعر شراء الصنف الحالي.
5. `applyEffects(+1)`.
6. `IPostingEngine.PostDocumentAsync(doc)` (الأنواع المالية فقط حسب جدول خطوة 12).
7. `status = posted`، `postedAt = now`.

### 3.2 `POST /api/documents/{id}/complete` — مُرحّل ← مكتمل
Body: `{}` ← يرجع `DocumentDto` (المستند نفسه بعد التحديث).
- النوع مالوش إتمام ← 422 `هذا المستند لا يحتاج إلى إتمام`.
- مش `posted` ← 409 `يجب ترحيل المستند أولًا`.
- **voucher-transfer**: لكل سطر ← المخزن المستلم +qty (حركات دخول).
- **reservation** (تسليم وإصدار فاتورة):
  1. فك الحجز: المحجوز −qty لكل سطر.
  2. أنشئ **فاتورة بيع** بنفس الطرف والمخزن والسطور والخصم والضريبة، `date = النهارده`، `dueDate = null`، `paid = عربون الحجز`، `paymentMethod = طريقة الحجز أو cash`، `notes = "تسليم {رقم الحجز}"` (+ ` — {ملاحظات الحجز}` لو موجودة)، و **رحّلها** (يعني فحص الكمية وحد الائتمان والقيود).
  3. الفاتورة: `sourceId/sourceNumber` = الحجز. الحجز: `targetId/targetNumber` = الفاتورة.
  4. لو أي حاجة فشلت ← rollback كامل (الحجز يفضل محجوز).
- `status = completed`.

> ملحوظة: عربون الحجز **مش** بيتقيد عند ترحيل الحجز (الحجز مش بيعمل قيود). الفلوس بتتقيد مرة واحدة في فاتورة البيع عند التسليم.

### 3.3 `POST /api/documents/{id}/cancel`
Body: `{ "reason": "…" }` ← يرجع `DocumentDto`.
- ملغي بالفعل ← 409 `المستند ملغي بالفعل`.
- مكتمل ← 409 `لا يمكن إلغاء مستند مكتمل`.
- فيه مرتجع غير ملغي معمول من المستند ده (`sourceId = id` ونوعه sale-return/purchase-return) ← 409 `ألغِ المرتجع المرتبط {رقم المرتجع} أولًا`.
- لو `posted`:
  - التأثير `in`: لازم الكمية اللي دخلت لسه متاحة في المخزن ← غير كده 409 `لا يمكن الإلغاء: الكمية المستلمة لم تعد متاحة`.
  - التأثير `move`: لازم متاحة في المخزن المستلم ← غير كده 409 `لا يمكن الإلغاء: الكمية المحوّلة لم تعد متاحة في المخزن المستلم`.
  - `applyEffects(−1)` + `IPostingEngine.VoidSourceAsync(id)` + الحركات `IsVoided`.
- لو المستند اتعمل من عرض سعر (المصدر quotation وحالته completed و target = المستند ده) ← رجّع عرض السعر `posted` وشيل الـ target.
- `status = cancelled`. لو فيه سبب: يتضاف للملاحظات — لو فيه ملاحظات: `"{notes}\nسبب الإلغاء: {reason}"` غير كده `"سبب الإلغاء: {reason}"`.

### 3.4 `POST /api/documents/{id}/convert`
Body: `{ "to": "sale" }` ← **201** + `DocumentDto` للمسودة الجديدة.
- `to` مش في `convertTo` بتاع النوع ← 422 `لا يمكن التحويل إلى هذا النوع`.
- المصدر مسودة أو ملغي ← 409 `رحّل المستند أولًا`.
- عرض سعر مكتمل ← 409 `عرض السعر تحوّل بالفعل إلى {targetNumber}`.
- عرض سعر `dueDate < النهارده` ← 409 `انتهت صلاحية عرض السعر`.
- لو التحويل لمرتجع: السطور = **المتاح للإرجاع** (الكمية − المرتجع قبل كده من مرتجعات غير ملغية). لو مفيش ← 409 `تم إرجاع كل أصناف هذه الفاتورة`.
- أنشئ **مسودة** (مش مرحّلة) بنفس الطرف والمخازن والسعر والخصم للسطور، و: `date = النهارده`، `dueDate = null`، `paid = 0`، `discount = 0` للمرتجع (وللباقي نفس خصم المصدر)، `reference = رقم المصدر`، `notes = ""`، `channel` = بتاع المصدر.
- `sourceId/sourceNumber` = المصدر.
- لو المصدر عرض سعر: المصدر يبقى `completed` و `targetId/targetNumber` = المسودة.

## 4) تحديثات على أجزاء سابقة

- `IItemUsageChecker` / `IWarehouseUsageChecker` / `IPartyUsageChecker` يشوفوا المستندات والحركات.
- `ItemDto.stock` و `StockRowDto.lastMovementAt` بيتحدثوا تلقائيًا عن طريق `IStockLedger`.

## 5) الـ Seed التاريخي (Development) — مهم عشان الشاشات والتقارير يبقى فيها داتا

اعمل `DevelopmentDataSeeder` بيستخدم **نفس الـ services** (مش insert مباشر) عشان المخزون والقيود يبقوا متطابقين:
1. **أرصدة افتتاحية**: لكل مخزن سند استلام (`goods-receipt`, reason `opening`, تاريخ قبل 150 يوم) بأرصدة لكل الأصناف: الرصيد الكلي للصنف 0..6×minStock (8% صفر)، موزعة على المخازن تقريبًا 46% / 18% / 15% / 13% / 8%. السعر = سعر الشراء. رحّلها.
2. **150 يوم من الحركة** (Random بـ seed ثابت)، لكل يوم:
   - 1–2 فاتورة بيع قطاعي (45% منها قناة `pos` من `wh-shw` أو `wh-cai`، مدفوعة بالكامل cash/card/wallet).
   - 45% احتمال فاتورة بيع جملة آجلة لعميل wholesale بضريبة 14%، أحيانًا دفعة 30–50%، `dueDate = date + paymentTermDays`.
   - كل 3 أيام فاتورة شراء من مورد للمخزن الرئيسي بضريبة 14%، `reference = "INV-#####"`، 30% مدفوعة بنكي.
   - 18% عرض سعر، 8% مرتجع بيع، 4% مرتجع شراء، 10% تحويل، 6% تحويل بسند (القديم أكتر من 4 أيام مكتمل)، 7% سند صرف، 5% سند استلام، 8% حجز بعربون 25%.
   - المستندات في آخر يومين: 35% منها مسودات. 3% ملغي.
   - لو مستند فشل بسبب الكمية — تجاهله وكمّل.
3. في الآخر: `TrialBalance.IsBalanced == true` (لو لأ، الـ seeder يرمي exception).

## 6) الاختبارات

- **sale**: post ← الرصيد نقص، القيد اتعمل، العميل اتمدّن بالباقي. cancel ← كل حاجة رجعت.
- **purchase**: post ← الرصيد زاد. اصرف الكمية في فاتورة بيع، وبعدين جرّب cancel للشراء ← 409 `الكمية المستلمة لم تعد متاحة`.
- **transfer**: post ← نقص من A وزاد في B.
- **voucher-transfer**: post ← نقص من A بس. complete ← زاد في B.
- **reservation**: post ← `reserved` زاد و `available` قل. complete ← فاتورة بيع مرحّلة اتعملت، الحجز اتفك، الربط في الاتجاهين.
- كمية مش متاحة ← 409 بالرسالة بالظبط. مخزن `allowNegative` ← ينجح.
- حد الائتمان ← 409.
- quotation → convert(sale) ← مسودة + العرض completed. convert تاني ← 409. حذف المسودة ← العرض رجع posted.
- sale → convert(sale-return) مرتين بكميات تتخطى المباع ← 422.
- cancel فاتورة عليها مرتجع ← 409.
- create بـ `post: true` وكمية مش متاحة ← 409 ومفيش مسودة اتحفظت والرقم ماتحرقش.
- تزامن: طلبين post متوازيين على نفس الرصيد الأخير ← واحد بس ينجح.

## معايير القبول

- [ ] 4 أكشنز مطابقة للعقد + `StockMovement` + seed تاريخي متزن.
- [ ] `GET /api/stock/items/{id}` بيرجع movements حقيقية.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (14 ✅).


---
---

# الخطوة 15 — السندات المالية: `VouchersController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **VouchersController** (قبض / صرف / قيد) مع الترحيل عن طريق `IPostingEngine` (خطوة 12).

- **receipt — سند قبض**: فلوس داخلة لخزينة/بنك، من عميل/مورد أو من حساب (إيراد…).
- **payment — سند صرف**: فلوس خارجة من خزينة/بنك، لعميل/مورد أو لحساب (مصروف…).
- **journal — سند قيد**: سطور مدين/دائن حرة؛ لازم Σمدين = Σدائن.

Route: `api/vouchers` — `[HasPermission("Vouchers.View")]`.

---

## 1) الـ Entities

```csharp
Voucher {
  string Id; string Kind;          // receipt | payment | journal
  string Number;                   // RV-000123 / PV-… / JV-… — NumberSequences "voucher:{kind}"
  DateOnly Date;
  string Status;                   // draft | posted | cancelled
  string Description; string Reference;
  // receipt / payment
  string? CounterpartyType;        // party | account
  string? PartyId; string? PartyName;
  string? AccountId; string? AccountName;
  string? CashAccountId; string? CashAccountName;
  string? Method;                  // cash | bank | card | cheque | wallet
  decimal Amount;
  string? CostCenterId; string? CostCenterName;
  // journal
  List<VoucherLine> Lines;
  decimal TotalDebit; decimal TotalCredit;
  string CreatedBy; DateTime CreatedAt; DateTime? PostedAt;
  string SearchText;   // number + description + reference + partyName + accountName + cashAccountName + createdBy
}
VoucherLine { long Id; string VoucherId; int LineNo; string AccountId; string AccountCode; string AccountName;
              decimal Debit; decimal Credit; string? CostCenterId; string? CostCenterName; string Note; }
```

## 2) الـ DTOs

```csharp
VoucherDto: id, kind, number, date, status, description, reference,
            counterpartyType, partyId, partyName, accountId, accountName,
            cashAccountId, cashAccountName, method, amount, costCenterId, costCenterName,
            lines: JournalLineDto[], totalDebit, totalCredit, createdBy, createdAt, postedAt
JournalLineDto(accountId, accountCode, accountName, debit, credit, costCenterId, costCenterName, note)
VoucherSummaryDto = VoucherDto من غير lines + int linesCount
VoucherStatsDto(int Count, int Draft, int Posted, int Cancelled, decimal Total, decimal ThisMonth)
```

Payload:
```json
{
  "kind": "payment", "date": "2026-11-09", "description": "إيجار شهر نوفمبر", "reference": "",
  "counterpartyType": "account", "partyId": null, "accountId": "acc-5202",
  "cashAccountId": "acc-1102", "method": "bank", "amount": 42000, "costCenterId": "cc-2",
  "lines": [],
  "post": true
}
```

## 3) بناء السند (التحقق) — مشترك للإنشاء والتعديل

مساعد `leafAccount(id, what)`: مش موجود ← 404 `{what} غير موجود`؛ تجميعي ← 422 `«{name}» حساب تجميعي — اختر حسابًا فرعيًا`؛ موقوف ← 422 `الحساب «{name}» موقوف`.
مساعد `centerOf(id)`: لو مبعوت ومش موجود ← 404 `مركز التكلفة غير موجود`.

### journal
1. السطور اللي ليها `accountId` و (debit > 0 أو credit > 0) بس هي اللي تتحسب (الفاضية تتشال).
2. لكل سطر (i من 1): `leafAccount(accountId, "الحساب")`؛ debit و credit الاتنين > 0 ← 422 `السطر {i}: أدخل مدينًا أو دائنًا وليس الاثنين`؛ الحساب `costCenterRequired` ومفيش مركز ← 422 `الحساب «{name}» يتطلب مركز تكلفة`. (المبالغ `round2(max(0,x))`، `note` trim.)
3. أقل من سطرين ← 422 `القيد يحتاج إلى سطرين على الأقل`.
4. `totalDebit ≠ totalCredit` ← 422 `القيد غير متزن: المدين {totalDebit} والدائن {totalCredit}`.
5. `description` فاضي ← 422 `اكتب بيان القيد`.
6. `amount = totalDebit`، وكل حقول القبض/الصرف = null.

### receipt / payment
1. `amount = round2(amount)`، ≤ 0 ← 422 `المبلغ يجب أن يكون أكبر من صفر`.
2. `cashAccountId` مش واحد من `SystemAccounts.CashAccounts` (`acc-1101`, `acc-1102`, `acc-1105`) ← 422 `اختر الخزينة أو البنك`، وبعدين `leafAccount(cashAccountId, "الخزينة")`.
3. `counterpartyType`:
   - `party` ← الطرف لازم يكون موجود: 404 `الحساب غير موجود`.
   - `account` ← `leafAccount(accountId, "الحساب")`؛ لو هو نفس الخزينة ← 422 `لا يمكن أن يكون الحساب المقابل هو نفس الخزينة`.
   - غير كده ← 422 `حدد الجهة المقبوض منها` (قبض) / `حدد الجهة المصروف إليها` (صرف).
4. `centerOf(costCenterId)`. لو الحساب المقابل `costCenterRequired` ومفيش مركز ← 422 `الحساب «{name}» يتطلب مركز تكلفة`.
5. `method` الافتراضي `cash`. `totalDebit = totalCredit = amount`، `lines = []`.

عام: `date` الفاضي ← النهارده، `description`/`reference` trim، الأسماء (party/account/cash/costCenter) snapshot.

## 4) الـ Endpoints

### 4.1 `GET /api/vouchers?kind=receipt&...` — paged
- Search: `number`, `description`, `reference`, `partyName`, `accountName`, `cashAccountName`, `createdBy`.
- فلاتر: `kind`, `status`, `partyId`, `cashAccountId`, `method`, `costCenterId`, `from`/`to` (على `date` شاملين).
- sortBy: `number`, `date`, `amount`, `partyName`, `accountName`, `status`, `createdAt`. **الافتراضي `date desc`** ثم `createdAt desc`.

### 4.2 `GET /api/vouchers/stats?kind=…` — نفس الفلاتر **ما عدا `status`**
- `count/draft/posted/cancelled` على الكل.
- `total` = Σ amount للسندات غير الملغية. `thisMonth` = نفس الحاجة للشهر الحالي (`date` في نفس السنة والشهر).

### 4.3 `GET /api/vouchers/{id}` ← `VoucherDto` أو 404 `السند غير موجود`.

### 4.4 `POST /api/vouchers` ← 201
- `kind` مش معروف ← 422 `نوع السند غير معروف`.
- يبني ويتحقق، رقم من `voucher:{kind}`، الحالة `draft`، أو لو `post: true` ← `posted` + `postedAt` + `IPostingEngine.PostVoucherAsync` في نفس الـ transaction.

### 4.5 `PUT /api/vouchers/{id}` — مسودات بس
- مش مسودة ← 409 `لا يمكن تعديل سند مُرحّل`.
- `kind` مختلف ← 422 `لا يمكن تغيير نوع السند`.
- `post: true` ← يرحّل بعد الحفظ.

### 4.6 `DELETE /api/vouchers/{id}` — مسودات بس
- مش مسودة ← 409 `يمكن حذف المسودات فقط — ألغِ السند بدلًا من ذلك`.

### 4.7 `POST /api/vouchers/{id}/post` — Body `{}`
- مش مسودة ← 409 `السند مُرحّل بالفعل`. ← `posted`، `postedAt`، القيود.

### 4.8 `POST /api/vouchers/{id}/cancel` — Body `{ "reason": "…" }`
- ملغي بالفعل ← 409 `السند ملغي بالفعل`.
- لو كان مرحّل ← `VoidSourceAsync(id)`.
- `status = cancelled`. لو فيه سبب: `description = "{description} — سبب الإلغاء: {reason}"` (أو من غير الشرطة لو الوصف فاضي).

## 5) تحديثات على أجزاء سابقة
- `IPartyUsageChecker` يشوف السندات. `IAccountUsageChecker` يشوف `AccountId` و سطور القيد. `INumberCollisionChecker` يشوف أرقام السندات.
- `PartiesService` يحدّث `PartyName` في السندات عند تغيير الاسم.

## 6) الـ Seed التاريخي (Development) — بعد seed المستندات
- **تحصيلات**: لكل فاتورة بيع آجلة مرحّلة فيها باقي، 85% احتمال سند قبض من العميل بعد (`paymentTermDays − 5 + 0..15`، أقل حاجة 5 أيام) بالباقي كله (70%) أو نصه، بنكي (45%، `reference = "TRX-######"`) أو نقدي. الوصف `سداد {رقم}` أو `دفعة من {رقم}`. (التاريخ لو في المستقبل — تجاهل.)
- **سداد موردين**: لكل فاتورة شراء فيها باقي، 75% سند صرف للمورد بعد 25–50 يوم من البنك (30% شيك `CHQ-#####`). الوصف `سداد فاتورة {reference أو الرقم}`.
- **مصروفات شهرية لآخر 5 شهور**: إيجار (`acc-5202`) يوم 3 للمراكز cc-2..cc-6 بمبالغ 42000/26000/22000/18000/35000؛ رواتب (`acc-5201`) يوم 26 لكل المراكز cc-1..cc-6 (18000–44000)؛ دعاية (`acc-5205`) يوم 12 لـ cc-7 (15000–40000، بطاقة)؛ شحن (`acc-5204`) أيام 7/14/21/28 لـ cc-8 (2500–6500، نقدي).
- **قيود شهرية**: استحقاق كهرباء (مدين 5203 cc-2 / دائن 2102)، مصروفات بنكية (مدين 5207 / دائن 1102)، توريد نقدية الصندوق للبنك (مدين 1102 / دائن 1101)، توريد نقدية نقطة البيع للبنك (مدين 1102 / دائن 1105).
- مسودة واحدة النهارده: سند قبض من حساب `acc-4103` بـ 1500 نقدي «بيع كراتين وخردة».
- في الآخر الميزان متزن.

## 7) الاختبارات
- كل قاعدة تحقق.
- قيد غير متزن ← 422 بالأرقام.
- سند قبض من عميل مرحّل ← رصيد العميل قل، و `GET /accounts` الخزينة زادت.
- cancel سند مرحّل ← الأرصدة رجعت.
- stats بتتجاهل `status`.

## معايير القبول
- [ ] 8 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (15 ✅).


---
---

# الخطوة 16 — كشوف الحساب والأرصدة: `PartiesController` (الجزء 2)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **4 endpoints تقارير** تتضاف لنفس `PartiesController` (خطوة 09)، مبنية على `PartyLedgerEntry` (خطوة 12).

الصلاحية: `[HasPermission("Customers.View")]`.

> ⚠️ ترتيب الـ routes: `parties/balances` و `parties/balances/summary` لازم مايتفهموش كـ `parties/{id}` — ASP.NET بيفضّل الـ literal، بس اكتب test.

---

## 1) الـ DTOs

```csharp
public sealed record StatementEntryDto(
    string SourceId,
    string SourceType,      // document | voucher | opening
    string SourceKind,      // نوع المستند أو السند
    string Number,
    DateOnly Date,
    string Description,
    decimal Debit, decimal Credit,
    decimal Balance);       // الرصيد الجاري بعد السطر ده

public sealed record StatementLineDto(string Code, string Name, string Unit, decimal Qty, decimal Price, decimal Total);

public sealed record DetailedStatementEntryDto(... نفس حقول StatementEntryDto ..., IReadOnlyList<StatementLineDto> Lines);

public sealed record PartyStatementDto<TEntry>(
    PartyOption Party,       // من خطوة 09 (فيه balance الحالي)
    string From,             // "" لو من البداية
    string To,               // "YYYY-MM-DD"
    decimal OpeningBalance,  // الرصيد قبل From
    decimal TotalDebit, decimal TotalCredit,
    decimal ClosingBalance,  // opening + debit − credit
    IReadOnlyList<TEntry> Entries);

public sealed record PartyBalanceRowDto(
    string Id, string Code, string Name, string Kind, string Phone,
    decimal CreditLimit,
    decimal TotalDebit,      // يشمل الجزء المدين من الرصيد الافتتاحي
    decimal TotalCredit,     // يشمل الجزء الدائن من الرصيد الافتتاحي
    decimal Balance,
    bool OverLimit,          // creditLimit > 0 && balance > creditLimit
    DateOnly? LastMovementAt);

public sealed record PartyBalancesSummaryDto(int Count, decimal Receivable, decimal Payable, decimal Net, int OverLimitCount);
```

## 2) الـ Endpoints

### 2.1 `GET /api/parties/{id}/statement?from=&to=`
- الطرف مش موجود ← 404 `الحساب غير موجود`.
- `from` الفاضي = من البداية. `to` الفاضي = النهارده. `from > to` ← 422 `تاريخ البداية بعد تاريخ النهاية`.
- المصدر: `PartyLedgerEntry` غير الملغية للطرف، مرتبة بـ `Date` ثم `At`.
- `openingBalance = party.OpeningBalance + Σ(debit − credit)` للسطور اللي `Date < from` (لو from موجود)، مقرّب لرقمين.
- `entries` = السطور اللي `from ≤ Date ≤ to`، ولكل سطر `balance` جاري يبدأ من `openingBalance`.
- `totalDebit/totalCredit` = مجموع سطور الفترة. `closingBalance = round2(opening + debit − credit)`.
- `entries[]` من غير `lines`.

### 2.2 `GET /api/parties/{id}/statement/detailed?from=&to=`
- نفس الحسبة بالظبط، بس كل سطر مصدره مستند بيرجع معاه `lines` = سطور المستند (`code, name, unit, qty, price, total`). سطور التحصيل/السداد مع الفاتورة والسندات ← `lines = []`.
- اعمل الـ query بحيث السطور تتجاب في استعلام واحد (مش N+1).

### 2.3 `GET /api/parties/balances?asOf=` — paged
- `asOf` الفاضي = النهارده. الأرصدة محسوبة لحد التاريخ ده (شامل).
- الصفوف: كل الأطراف اللي `CreatedAt.Date ≤ asOf` **أو** ليها حركة لحد `asOf`.
- لكل طرف: `debit = max(opening,0) + Σdebit`، `credit = max(−opening,0) + Σcredit`، `balance = opening + Σdebit − Σcredit`، `lastMovementAt = آخر Date`.
- Search: `name`, `code`, `phone`.
- فلاتر:
  - `kind` (زي القائمة: `customer`/`supplier` بـ `partyFits`، `both` مساواة).
  - `side`: `debit` | `credit` | `zero`.
  - `overLimit`: أي قيمة ← `overLimit = true` بس.
  - `hideZero`: أي قيمة ← `balance ≠ 0` بس.
- sortBy: `code`, `name`, `kind`, `totalDebit`, `totalCredit`, `balance`, `creditLimit`, `lastMovementAt`. **الافتراضي `balance desc`**.
- الأداء: aggregate واحد `GROUP BY PartyId` على `PartyLedgerEntry WHERE Date ≤ asOf AND IsVoided = 0`، و join مع الأطراف، وبعدين الفلترة والـ paging في SQL.

### 2.4 `GET /api/parties/balances/summary?asOf=`
نفس البحث والفلاتر (من غير paging):
- `count` = عدد الصفوف.
- `receivable` = Σ الأرصدة الموجبة. `payable` = Σ |الأرصدة السالبة|. `net = receivable − payable`.
- `overLimitCount`.

## 3) الاختبارات

- عميل برصيد افتتاحي 1000 + فاتورة بيع 5000 (دفع 2000) + سند قبض 1000:
  - الكشف من البداية: 3 سطور (فاتورة مدين 5000، تحصيل دائن 2000، سند دائن 1000)، `opening = 1000`، `closing = 3000`.
  - الكشف من تاريخ بعد الفاتورة: `opening = 4000`، سطر واحد.
- الكشف التفصيلي فيه سطور الفاتورة.
- مستند ملغي مايظهرش في الكشف.
- `balances?asOf=` تاريخ قديم ← الرصيد وقتها.
- `summary` = مجموع صفوف `balances` بنفس الفلاتر.
- `from > to` ← 422.

## معايير القبول

- [ ] 4 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (16 ✅).


---
---

# الخطوة 17 — الموظفين: `EmployeesController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **EmployeesController بس**.

بطاقة موظف مربوطة بقسم (= مركز تكلفة) وبحساب سلف.

Route: `api/employees` — `[HasPermission("Accounts.View")]`.

---

## 1) الـ Entity

```csharp
Employee {
  string Id;
  string Code;               // EMP-0012 — NumberSequences "employee" (Prefix EMP, Digits 4)
  string Name;               // ≥ 3 حروف, max 120
  string JobTitle;
  string? CostCenterId;      // القسم
  string Phone;
  string NationalId;         // "" أو 14 رقم، unique لو مش فاضي
  DateOnly HireDate;
  decimal Salary;            // المرتب الشهري الإجمالي — عدد صحيح ≥ 0
  string? AdvancesAccountId; // حساب فرعي لتتبع سلف الموظف
  string Status;             // active | leave | terminated
  string Notes;
  DateTime CreatedAt;
  string SearchText;         // name + code + jobTitle + phone + costCenterName + nationalId
}
```

## 2) الـ DTOs

```csharp
public sealed record EmployeeDto(
    string Id, string Code, string Name, string JobTitle,
    string? CostCenterId, string? CostCenterName, string? CostCenterColor,   // join
    string Phone, string NationalId, DateOnly HireDate, decimal Salary,
    string? AdvancesAccountId, string? AdvancesAccountName,                    // join
    string Status, string Notes, DateTime CreatedAt);

public sealed record EmployeePayload(
    string Name, string JobTitle, string? CostCenterId, string Phone, string NationalId,
    DateOnly? HireDate, decimal Salary, string? AdvancesAccountId, string Status, string Notes);

public sealed record EmployeeDepartmentStatDto(string? CostCenterId, string Name, string Color, int Count, decimal Salaries);

public sealed record EmployeeStatsDto(
    int Headcount,        // غير المنتهية خدمتهم (active + leave)
    int Active, int OnLeave,
    decimal TotalSalaries,   // Σ مرتبات active + leave
    decimal AverageSalary,   // round(TotalSalaries / Headcount) أو 0
    IReadOnlyList<EmployeeDepartmentStatDto> ByDepartment);  // مرتبة بالمرتبات تنازلي
```
- في `ByDepartment`: الموظفين من غير قسم يتجمعوا في صف `costCenterId = null`، `name = "بدون قسم"`، `color = "var(--txt3)"`.

## 3) الـ Endpoints

### 3.1 `GET /api/employees` — paged
- Search: `name`, `code`, `jobTitle`, `phone`, `costCenterName`, `nationalId`.
- فلاتر: `costCenterId`، `status`.
- sortBy: `code`, `name`, `jobTitle`, `costCenterName`, `hireDate`, `salary`, `status`, `createdAt`. الافتراضي `code asc`.

### 3.2 `GET /api/employees/stats` — نفس البحث والفلاتر **ما عدا `status`**.
### 3.3 `POST /api/employees` ← 201
### 3.4 `PUT /api/employees/{id}`
### 3.5 `DELETE /api/employees/{id}`

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي أو أقل من 3 حروف | 422 | `اسم الموظف مطلوب` |
| `status` مش من التلاتة | 422 | `حالة الموظف غير صحيحة` |
| `phone` (بعد شيل المسافات) مش `^01[0125]\d{8}$` | 422 | `رقم الموبايل غير صحيح` |
| `nationalId` مش 14 رقم | 422 | `الرقم القومي يجب أن يكون 14 رقمًا` |
| `nationalId` مكرر | 409 | `الرقم القومي مسجل لموظف آخر` |
| `costCenterId` مش موجود | 404 | `القسم غير موجود` |
| `advancesAccountId` مش موجود | 404 | `حساب السلف غير موجود` |
| `advancesAccountId` تجميعي | 422 | `اختر حسابًا فرعيًا للسلف` |
| `hireDate` فاضي | 422 | `تاريخ التعيين مطلوب` |
| delete وحالته مش `terminated` | 409 | `أنهِ خدمة الموظف أولًا — لا يُحذف موظف على رأس العمل` |
| مش موجود | 404 | `الموظف غير موجود` |

- التطبيع: `salary = max(0, round(x))`، النصوص trim، الـ ids الفاضية → null.
- حدّث `ICostCenterUsageChecker` (خطوة 11) — فيه موظفين على المركز، و `IAccountUsageChecker`/قاعدة حذف الحساب (خطوة 10) — مربوط بسلف موظف.

## 5) الـ Seed (Development)
- ~25 موظف موزعين على cc-1..cc-8 بمسميات واقعية (مدير فرع، أمين مخزن، كاشير، محاسب، مندوب مبيعات، سائق، فني…)، مرتبات 6000–35000، 3 في إجازة، 2 منتهية خدمتهم، أرقام قومية 14 رقم فريدة، بعضهم مربوط بحساب `acc-1106` سلف الموظفين.

## 6) الاختبارات
- CRUD + القواعد + stats (بتتجاهل `status`، والمنتهية خدمتهم مش في المرتبات).
- حذف مركز تكلفة عليه موظفين ← 409 (خطوة 11).

## معايير القبول
- [ ] 5 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (17 ✅).


---
---

# الخطوة 18 — الموازنة التقديرية: `BudgetController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **BudgetController بس**.

الموازنة = مبالغ مخططة لكل حساب إيراد/مصروف فرعي لكل شهر، ومقارنتها بالفعلي من القيود. ممكن تكون للشركة كلها أو لمركز تكلفة معين.

Route: `api/budget` — `[HasPermission("Accounts.View")]`.

---

## 1) الـ Entity

```csharp
BudgetPlan {
  string Id;
  int Year;
  string? CostCenterId;          // null = الشركة كلها — unique (Year, CostCenterId)
  DateTime? UpdatedAt; string? UpdatedBy;
  List<BudgetPlanLine> Lines;
}
BudgetPlanLine { long Id; string BudgetPlanId; string AccountId; decimal M1..M12; }   // أو عمود JSON لـ 12 رقم
```

## 2) الـ DTOs

```csharp
public sealed record BudgetLineDto(
    string AccountId, string AccountCode, string AccountName,
    string Type,                      // revenue | expense
    IReadOnlyList<decimal> Planned,   // 12 قيمة يناير → ديسمبر
    IReadOnlyList<decimal> Actual);   // 12 قيمة (0 للشهور الجاية)

public sealed record BudgetDto(int Year, string? CostCenterId, IReadOnlyList<BudgetLineDto> Lines, DateTime? UpdatedAt, string? UpdatedBy);

public sealed record BudgetPayload(string? CostCenterId, IReadOnlyList<BudgetPayloadLine> Lines);
public sealed record BudgetPayloadLine(string AccountId, IReadOnlyList<decimal> Planned);
```

## 3) الـ Endpoints

### 3.1 `GET /api/budget?year=2026&costCenterId=`
- `year` الفاضي = السنة الحالية. سنة مش رقم صحيح أو خارج 2000..2100 ← 422 `السنة غير صحيحة`.
- `costCenterId` مبعوت ومش موجود ← 404 `مركز التكلفة غير موجود`.
- **السطور** = كل الحسابات **الفرعية** اللي نوعها `revenue` أو `expense` و (نشطة **أو** ليها سطر في الخطة)، مرتبة بالكود.
- `planned` = من الخطة المحفوظة، أو 12 صفر.
- `actual[m]` = من `GlEntry` غير الملغية في السنة دي (ولو فيه `costCenterId` ← القيود المتعلمة بيه بس):
  - إيراد: `Σ(credit − debit)` للشهر.
  - مصروف: `Σ(debit − credit)` للشهر.
  - مقرّب لرقمين. (query واحد `GROUP BY AccountId, MONTH(Date)`.)
- `updatedAt`/`updatedBy` من الخطة أو null.
- لو مفيش خطة محفوظة — برضه يرجع 200 بالأصفار (مش 404).

### 3.2 `PUT /api/budget/{year}` ← يرجع `BudgetDto` بعد الحفظ (نفس شكل الـ GET)
- `year` غلط ← 422 `السنة غير صحيحة`.
- `costCenterId` الفاضي = null؛ مبعوت ومش موجود ← 404 `مركز التكلفة غير موجود`.
- لكل سطر: الحساب مش موجود ← 404 `الحساب غير موجود`؛ تجميعي أو نوعه مش إيراد/مصروف ← 422 `«{name}» لا يُضاف إلى الموازنة`؛ `planned` مش 12 قيمة ← 422 `يجب إدخال 12 شهرًا لكل حساب`.
- القيم `round2(x)` (الغلط = 0).
- **استبدال كامل** لسطور الخطة دي (upsert للـ plan). `UpdatedAt = now`، `UpdatedBy = اسم المستخدم`.

## 4) الـ Seed (Development)
- خطة للسنة الحالية للشركة كلها: المبيعات 4101 ≈ 900k–1.4M شهريًا بنمو بسيط، والمصروفات التشغيلية قريبة من الفعلي ±15%.
- خطة لكل مركز من cc-2..cc-6 للإيجار والرواتب.

## 5) الاختبارات
- GET لسنة مفيهاش خطة ← أصفار والسطور كلها موجودة.
- PUT وبعدين GET ← نفس القيم + `updatedBy`.
- `actual` بيطابق مجموع قيود الشهر (رحّل سند صرف مصروف في مارس وتأكد).
- فلتر المركز بيقصر الفعلي على قيوده.
- كل قاعدة تحقق.

## معايير القبول
- [ ] 2 endpoints مطابقين للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (18 ✅).


---
---

# الخطوة 19 — العملات وأسعار الصرف: `CurrenciesController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **CurrenciesController بس**.

العملة الأساسية **EGP** وسعرها دايمًا 1. باقي العملات: سعر الجنيه مقابل وحدة واحدة.

Route: `api/currencies` — `[HasPermission("Accounts.View")]`.

---

## 1) الـ Entities

```csharp
Currency {
  string Id;           // "cur-{code lowercase}" مثال cur-usd
  string Code;         // ISO-4217، 3 حروف كبيرة، unique
  string Name; string Symbol;
  bool IsBase; bool IsActive;
  DateTime UpdatedAt; string UpdatedBy;
}
CurrencyRate { long Id; string CurrencyId; decimal Rate /*18,4*/; DateTime At; string By; }   // التاريخ — آخر 12 تكفي للعرض
```

## 2) الـ DTOs

```csharp
public sealed record CurrencyDto(
    string Id, string Code, string Name, string Symbol,
    decimal Rate,           // آخر سعر
    decimal PreviousRate,   // السعر اللي قبله (أو نفس السعر لو مفيش)
    decimal ChangePct,      // round((rate − prev) / prev × 100, 2)، أو 0
    IReadOnlyList<decimal> History,   // آخر 12 سعر، الأقدم الأول والأخير = الحالي
    bool IsBase, bool IsActive, DateTime UpdatedAt, string UpdatedBy);

public sealed record CurrencyPayload(string Code, string Name, string Symbol, decimal Rate, bool IsActive);
```

## 3) الـ Endpoints

### 3.1 `GET /api/currencies` ← **Array** (مش paged)، الأساسية الأول وبعدين بالكود.
### 3.2 `POST /api/currencies` ← 201
- `Id = "cur-" + code.ToLower()`، `IsBase = false`، أول سعر في التاريخ = `rate`، `UpdatedAt/By`.
### 3.3 `PUT /api/currencies/{id}`
- الأساسية: لو `rate ≠ 1` أو الكود اتغير أو `isActive = false` ← 409 `العملة الأساسية ثابتة — سعرها 1 ولا يمكن إيقافها`.
- غير الأساسية: لو `rate` مختلف عن آخر سعر ← أضف سعر جديد للتاريخ و `UpdatedAt/By = now/اسم المستخدم`. (تغيير الاسم أو الرمز بس مايضيفش سعر.)
### 3.4 `DELETE /api/currencies/{id}`
- الأساسية ← 409 `لا يمكن حذف العملة الأساسية`.
- مستخدمة في أي حساب (`Account.Currency == code`) ← 409 `العملة مستخدمة في حسابات — أوقفها بدلًا من ذلك`.

## 4) التحقق (create + update)

| الحالة | الكود | الرسالة |
|---|---|---|
| الكود بعد trim+uppercase مش `^[A-Z]{3}$` | 422 | `رمز العملة 3 حروف لاتينية (مثل USD)` |
| الكود موجود لعملة تانية | 409 | `العملة مضافة بالفعل` |
| `name` فاضي | 422 | `اسم العملة مطلوب` |
| `rate` (مقرّب 4 أرقام) ≤ 0 | 422 | `سعر الصرف يجب أن يكون أكبر من صفر` |
| مش موجودة | 404 | `العملة غير موجود` ← `NotFoundException("العملة")` |

- `symbol` الفاضي ← نفس الكود.

## 5) الـ Seed — **كل البيئات** (EGP بس في Production، والباقي Development)

| Code | الاسم | الرمز | السعر |
|---|---|---|---|
| EGP | جنيه مصري | ج.م | 1 (أساسية) |
| USD | دولار أمريكي | $ | 48.62 |
| EUR | يورو | € | 52.94 |
| SAR | ريال سعودي | ر.س | 12.95 |
| AED | درهم إماراتي | د.إ | 13.24 |
| KWD | دينار كويتي | د.ك | 158.4 |
| GBP | جنيه إسترليني | £ | 61.73 |
| CNY | يوان صيني | ¥ | 6.72 |
| JPY | ين ياباني | ¥ | 0.322 |

في Development اعمل لكل عملة غير أساسية تاريخ 12 سعر بتذبذب ±2% ينتهي بالسعر ده.

## 6) الاختبارات
- الترتيب، `changePct`، إضافة سعر للتاريخ بس لما السعر يتغير، و `history` أقصاه 12.
- قواعد العملة الأساسية والحذف.

## معايير القبول
- [ ] 4 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (19 ✅).


---
---

# الخطوة 20 — إعدادات نقطة البيع: `PosSettingsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **PosSettingsController** + ربط الخزينة بقيود مبيعات نقطة البيع.

شاشة الكاشير نفسها **مش محتاجة endpoints جديدة** — بتستخدم:
- `GET items/lookup?warehouseId=` (خطوة 08) للأصناف.
- `GET parties/lookup?role=customer` و `POST parties` بـ `isExternal: true` للعميل السريع (خطوة 09).
- `POST documents` بـ `kind: "sale"`, `channel: "pos"`, `post: true` (خطوات 13/14).
- الحجوزات: `documents` بـ `kind: "reservation"`.
- السلات المعلقة متخزنة في المتصفح (مش في الـ API).

Route: `api/pos/settings` — `[HasPermission("Pos.Access")]` للـ GET والـ PUT.

---

## 1) الـ DTO

```json
{
  "warehouseId": "wh-shw",
  "cashAccountId": "acc-1105",
  "paymentMethods": ["cash", "card", "wallet", "credit"],
  "defaultTaxPct": 0,
  "allowDiscount": true,
  "maxDiscountPct": 15,
  "receiptHeader": "X-TURBO لقطع غيار السيارات\nالتجمع الخامس — شارع التسعين الجنوبي",
  "receiptFooter": "شكرًا لزيارتكم — الاستبدال خلال 14 يومًا بالفاتورة",
  "paperWidth": 80,
  "autoPrint": false,
  "updatedAt": "2026-10-28T09:00:00Z",
  "updatedBy": "أحمد حسن"
}
```
- `warehouseId: null` = المخزن الافتراضي للنظام.
- الـ PUT payload = نفس الشكل من غير `updatedAt`/`updatedBy`.
- التخزين: جدول `PosSettings` صف واحد (Id = 1). `paymentMethods` كـ string مفصول بفاصلة أو JSON.

## 2) `GET /api/pos/settings` ← الـ DTO (لو مفيش صف ← يرجع القيم الافتراضية فوق).

## 3) `PUT /api/pos/settings` ← الـ DTO بعد الحفظ

| الحالة | الكود | الرسالة |
|---|---|---|
| `warehouseId` مبعوت ومش موجود | 404 | `المخزن غير موجود` |
| `warehouseId` موقوف | 422 | `المخزن «{name}» موقوف` |
| `cashAccountId` مش واحد من `acc-1105`, `acc-1101`, `acc-1102` | 422 | `اختر الخزينة` |
| `paymentMethods` بعد الفلترة (من `cash, card, wallet, credit` بالترتيب ده) فاضية | 422 | `فعّل طريقة دفع واحدة على الأقل` |
| `defaultTaxPct` مش بين 0 و 100 | 422 | `نسبة الضريبة يجب أن تكون بين 0 و 100` |
| `maxDiscountPct` مش بين 0 و 100 | 422 | `أقصى خصم يجب أن يكون بين 0 و 100` |

التطبيع:
- `warehouseId` الفاضي → null.
- `maxDiscountPct` = 0 لو `allowDiscount = false`.
- `receiptHeader`/`receiptFooter` trim و max 300 حرف.
- `paperWidth`: 58 لو 58، غير كده 80.
- `autoPrint` bool. `updatedAt = now`، `updatedBy = اسم المستخدم`.

## 4) قواعد على مبيعات نقطة البيع (عدّل خطوات 12/14)

لما مستند `sale` بـ `channel = "pos"` يترحّل:
1. **الخزينة**: طريقة الدفع `cash` ← حساب التسوية = `PosSettings.CashAccountId` (بدل `acc-1105` الثابت في خطوة 12).
2. **طريقة الدفع** لازم تكون من `PosSettings.PaymentMethods` ← غير كده 422 `طريقة الدفع غير مفعلة في نقطة البيع`.
3. **الخصم**: لو `allowDiscount = false` وفيه أي خصم (سطر أو رأس) ← 422 `الخصم غير مسموح في نقطة البيع`. لو مسموح: `discountPct` لأي سطر ≤ `maxDiscountPct`، والخصم الكلي ≤ `subtotal × maxDiscountPct / 100` ← غير كده 422 `الخصم يتجاوز الحد المسموح ({max}%)`.
4. المخزن: الفرونت بيبعت المخزن، والـ API مايفرضش إنه نفس مخزن الإعدادات (المدير ممكن يبيع من مخزن تاني).

## 5) الاختبارات
- GET قبل أي حفظ ← القيم الافتراضية.
- كل قاعدة تحقق.
- بيع POS نقدي بعد تغيير الخزينة لـ `acc-1101` ← القيد على 1101.
- خصم أكبر من الحد في بيع POS ← 422، ونفس الخصم في بيع `erp` ← ينجح.

## معايير القبول
- [ ] 2 endpoints مطابقين للعقد + قواعد البيع من نقطة البيع.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (20 ✅).


---
---

# الخطوة 21 — طلبات المتجر الإلكتروني: `OrdersController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **OrdersController بس**.

الطلبات جاية من المتجر الإلكتروني / الجملة / نقاط البيع. الداشبورد ولوحة التقارير بيعتمدوا عليها.

Route: `api/orders` — `[HasPermission("Orders.View")]`.

---

## 1) الـ Entities

```csharp
Order {
  string Id; string Number;            // ORD-10482 — NumberSequences "order" (Prefix ORD, Digits 5)
  string CustomerName; string CustomerPhone; string City; string Address;
  string Channel;                      // online | pos | wholesale
  string PaymentMethod;                // cash | card | wallet | credit
  string PaymentStatus;                // paid | unpaid | refunded
  string Status;                       // pending | processing | shipped | delivered | cancelled
  int ItemCount;                       // Σ qty
  decimal Subtotal, Discount, Shipping, Total;   // total = subtotal − discount + shipping
  string Note;
  DateTime CreatedAt;
  List<OrderLine> Lines; List<OrderEvent> Timeline;
  string SearchText;                   // number + customerName + customerPhone + city
}
OrderLine  { long Id; string OrderId; string ItemId; string Code; string Name; decimal Qty; decimal UnitPrice; decimal Total; decimal UnitCost; }
// UnitCost = سعر شراء الصنف وقت الطلب — داخلي (للربح في التقارير)، مايطلعش في الـ API
OrderEvent { long Id; string OrderId; string Status; DateTime At; string By; string? Note; }
```

## 2) الـ DTOs

```csharp
OrderSummaryDto(id, number, customerName, customerPhone, city, channel, paymentMethod, paymentStatus, status, itemCount, total, createdAt)
OrderDto = OrderSummaryDto + address, subtotal, discount, shipping, note,
           lines: [{ itemId, code, name, qty, unitPrice, total }],
           timeline: [{ status, at, by, note }]          // note تتحذف/null لو مفيش
OrderStatsDto(int Count, decimal Revenue, decimal AvgValue, Dictionary<string,int> ByStatus)  // ByStatus فيه الخمس حالات دايمًا
```

## 3) الفلاتر المشتركة
- `channel`, `payment` (= paymentStatus), `period`:
  - `today` ← من أول النهارده (توقيت مصر `Africa/Cairo`).
  - `7d` / `30d` / `90d` ← من أول يوم (N−1) أيام فاتت.
- `status` (في الـ list بس).

## 4) الـ Endpoints

### 4.1 `GET /api/orders` — paged
- Search: `number`, `customerName`, `customerPhone`, `city`.
- الفلاتر فوق. sortBy: `number`, `customerName`, `city`, `total`, `itemCount`, `status`, `createdAt`. الافتراضي `createdAt desc`.

### 4.2 `GET /api/orders/stats?search=&channel=&payment=&period=`
- نفس البحث والفلاتر **من غير `status`**.
- `count` = الكل. `revenue` = Σ total لغير الملغي. `avgValue = round(revenue / عدد غير الملغي)` أو 0. `byStatus` عدّاد لكل حالة.

### 4.3 `GET /api/orders/{id}` ← `OrderDto` أو 404 `الطلب غير موجود`.

### 4.4 `PATCH /api/orders/{id}/status`
Body: `{ "status": "processing", "note": "…" }` ← `OrderDto`.
- المسار الطبيعي: `pending → processing → shipped → delivered`. المسموح: **الخطوة اللي بعدها بس**، أو `cancelled` لو الحالة `pending` أو `processing`.
- غير كده ← 409 `لا يمكن نقل الطلب إلى هذه الحالة`.
- أضف event (`by` = اسم المستخدم، `note` trim أو null).
- `delivered` و الدفع `cash` ← `paymentStatus = paid`.
- `cancelled` ← `paymentStatus = paid ? refunded : unpaid`.
- **ربط بالمدفوعات (خطوة 22)**: انشر domain event `OrderStatusChanged` — خطوة 22 هتسمعه.

### 4.5 (اختياري — مش مستخدم من الفرونت) `POST /api/orders`
لاستقبال الطلبات من المتجر/تكامل خارجي (بصلاحية `Orders.View` أو API key منفصل). بيحسب الإجماليات من أسعار الأصناف، `status = pending`، event أول `by = "العميل"`، `paymentStatus = paid` لو card/wallet غير كده `unpaid`، و `shipping = 60` للـ online. (هيعمل payment في خطوة 22.)

## 5) الـ Seed (Development)
~400 يوم تاريخ: 2–6 طلبات يوميًا بنمو تدريجي (0.55 → 1.3) وأقل يوم الجمعة (×0.6). القنوات: 50% online، 35% pos، 15% wholesale. الدفع: pos → cash 60%/card؛ wholesale → credit 60%/cash؛ online → card/wallet/cash. الحالة حسب العمر (أقل من يوم: معظمها pending/processing؛ أكبر من 4 أيام: 91% delivered والباقي cancelled). السطور 1–3 (wholesale لحد 5 وكميات لحد 10) من الأصناف النشطة. خصم الجملة 5%، وشحن online 60. timeline منطقية. عملاء من مدن مصرية مختلفة.

## 6) الاختبارات
- الفلاتر (خصوصًا `period=today`)، stats بتتجاهل `status`.
- كل انتقال مسموح وممنوع، وتغيّر `paymentStatus`.

## معايير القبول
- [ ] 4 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (21 ✅).


---
---

# الخطوة 22 — مدفوعات المتجر: `PaymentsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **PaymentsController** + ربطه بالطلبات (خطوة 21).

كل محاولة تحصيل قيمة طلب: بوابة دفع (بطاقة، محفظة، إنستاباي، فوري) أو المندوب عند الاستلام (COD)، بعمولاتها والاستردادات والتسوية مع البنك.

Route: `api/payments` — `[HasPermission("Payments.View")]`.

---

## 1) الـ Entities

```csharp
StorePayment {
  string Id; string Number;                 // PAY-000123 — NumberSequences "payment"
  DateTime CreatedAt; DateTime? PaidAt;
  string OrderId; string OrderNumber; string CustomerName; string CustomerPhone; string City;
  string Method;                            // card | wallet | instapay | fawry | cod
  string Provider;                          // Paymob / فودافون كاش / بوسطة …
  string Reference; string? CardLast4; int Attempt;
  decimal Amount, Fee, Refunded, Net;       // net = amount − fee − refunded
  string Status;                            // pending | paid | partially_refunded | refunded | failed
  string? FailureReason;
  string? SettlementStatus;                 // null لحد التحصيل، بعدها unsettled | settled
  DateOnly? ExpectedSettlementDate; DateTime? SettledAt; string? SettlementBatch;
  List<PaymentRefund> Refunds;              // { id, at, amount, reason, by }
  List<PaymentEvent> Timeline;              // { type: created|paid|failed|retry|refund|settled, at, by, note?, amount? }
  string SearchText;  // number + orderNumber + customerName + customerPhone + reference + provider + settlementBatch + city
}
```

## 2) القواعد الثابتة
- **العمولة** (`feeFor`): card = `amount×2.75% + 3` · wallet = `1.5%` · instapay = `0` · fawry = `2% + 2.5` · cod = `max(5, 1%)`. (round2)
- **مهلة التسوية** بالأيام من التحصيل: card 2 · wallet 1 · instapay 0 · fawry 3 · cod 7.
- **رقم دفعة التسوية**: `STL-{CRD|WAL|IPN|FWR|COD}-{yyyyMMdd}`.
- "محصّل" = `paid | partially_refunded | refunded`. `refundable = max(0, amount − refunded)`.
- عند التحصيل (`markCaptured`): `paidAt = at`، `settlementStatus = unsettled`، `expectedSettlementDate = date(at) + مهلة`، `fee = feeFor`، `net` يتحسب.
- "متأخرة" = `settlementStatus = unsettled && expectedSettlementDate < النهارده`.

## 3) الـ DTOs
- `PaymentSummaryDto` = كل الحقول من غير `refunds` و `timeline`.
- `PaymentDto` = الكل.
- `PaymentStatsDto(count, byStatus{5 حالات}, collected, pending, pendingCount, fees, refunds, net, unsettled, unsettledCount, overdueCount)`:
  - `collected/fees/refunds` = Σ amount/fee/refunded للمحصّل. `net = collected − fees − refunds`.
  - `pending/pendingCount` = Σ amount وعدد الـ pending.
  - `unsettled/unsettledCount` = Σ net وعدد المحصّل غير المسوّى. `overdueCount` = المتأخر منهم.

## 4) الـ Endpoints

### 4.1 `GET /api/payments` — paged
- Search: الحقول في `SearchText`.
- فلاتر: `status`, `method`, `orderId`, `settlement` (`unsettled` | `settled` | `overdue`)، `from`/`to` على **تاريخ `createdAt` المحلي (القاهرة)**.
- sortBy: `number`, `createdAt`, `paidAt`, `amount`, `fee`, `net`, `status`, `expectedSettlementDate`. الافتراضي `createdAt desc`.

### 4.2 `GET /api/payments/stats` — نفس الفلاتر **من غير `status`**.
### 4.3 `GET /api/payments/{id}` ← `PaymentDto` أو 404 `عملية الدفع غير موجود`.

### 4.4 `POST /api/payments/{id}/confirm` — Body `{ "reference"?: "", "note"?: "" }`
- مش pending ← 409 `لا يمكن تأكيد تحصيل عملية غير معلّقة`.
- الطلب ملغي ← 409 `الطلب المرتبط ملغي — لا يمكن تأكيد التحصيل`.
- `reference` لو مبعوت يتحدث. `status = paid`، `failureReason = null`، markCaptured(now)، event `paid` (note = اللي جاي، أو `تأكيد استلام النقدية من المندوب` لـ cod، أو `تأكيد السداد يدويًا`)، والطلب `paymentStatus = paid`.

### 4.5 `POST /api/payments/{id}/fail` — Body `{ "reason": "…" }`
- مش pending ← 409 `لا يمكن تسجيل فشل لعملية غير معلّقة`. السبب فاضي ← 422 `سبب الفشل مطلوب`.
- `status = failed`، `failureReason`، event `failed`.

### 4.6 `POST /api/payments/{id}/retry` — Body `{}`
- مش (failed && cod) ← 409 `إعادة المحاولة متاحة لعمليات التحصيل عند الاستلام الفاشلة فقط`.
- الطلب ملغي ← 409 `الطلب المرتبط ملغي — لا يمكن إعادة محاولة التحصيل`.
- `status = pending`، `failureReason = null`، `attempt += 1`، event `retry` بملاحظة `المحاولة رقم {n}`.

### 4.7 `POST /api/payments/{id}/refund` — Body `{ "amount": 250, "reason": "…" }`
- مش (paid أو partially_refunded) أو refundable = 0 ← 409 `لا يمكن استرداد هذه العملية`.
- السبب فاضي ← 422 `سبب الاسترداد مطلوب`. المبلغ ≤ 0 ← 422 `مبلغ الاسترداد غير صالح`. أكبر من المتاح ← 422 `مبلغ الاسترداد أكبر من المتاح للاسترداد`.
- أضف refund، `refunded += amount`، الحالة `partially_refunded` أو `refunded` لو خلص، event `refund`، `net` يتحسب (العمولة **مابترجعش**). لو بقى `refunded` ← الطلب `paymentStatus = refunded`.

### 4.8 `POST /api/payments/{id}/settle` — Body `{ "batch"?: "" }`
- مش (محصّل && unsettled) ← 409 `العملية غير قابلة للتسوية`.
- `settled`، `settledAt = now`، `batch` = اللي جاي أو الافتراضي، event `settled` بالـ net.

كل الأكشنز بترجع `PaymentDto`، و `by` = اسم المستخدم.

## 5) الربط مع الطلبات
- **عند إنشاء طلب** (seed أو `POST orders`): لو `online` ← اعمل payment: card/wallet ← method مقابل وحالة `paid` فورًا؛ cash ← `cod` و `pending` (provider = شركة شحن).
- **اسمع `OrderStatusChanged`** (نفس الـ transaction):
  - `delivered` ← أي payment `cod` pending للطلب: `paid` + markCaptured(وقت التسليم) + event `paid` بـ `by = "مندوب {provider}"`، note `تم التحصيل نقدًا عند التسليم`.
  - `cancelled` ← أي payment `cod` pending: `failed`، reason `أُلغي الطلب قبل التحصيل`، event بـ `by = "النظام"`.

## 6) الـ Seed (Development)
من الطلبات online آخر 120 يوم (~40% عينة من القديم وكل الحديث): محافظ (فودافون كاش، أورنج كاش، اتصالات كاش، WE Pay)، شركات شحن (بوسطة، أرامكس، جي آند تي)، بعض المحاولات الفاشلة بأسباب واقعية (رصيد غير كافٍ، رفض البنك المُصدر للبطاقة، العميل لم يرد على المندوب…)، استردادات جزئية، وتسويات للقديم ومتأخرات قليلة.

## 7) الاختبارات
- كل أكشن: الحالات المسموحة والممنوعة والرسائل.
- العمولة والـ net والـ expectedSettlementDate لكل method.
- تسليم طلب COD ← الدفع اتحصّل. إلغاء ← فشل.
- stats بتتجاهل `status`، وفلتر `overdue`.

## معايير القبول
- [ ] 8 endpoints مطابقة للعقد + الربط مع الطلبات.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (22 ✅).


---
---

# الخطوة 23 — لوحة التحكم: `DashboardController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **endpoint واحد** بيجمع أرقام حقيقية من الطلبات والمخزون.

Route: `GET api/dashboard/overview?range=7d|30d|90d` — `[HasPermission("Dashboard.View")]`. أي `range` غلط ← `30d`.

---

## 1) الـ Response

```csharp
DashboardOverviewDto(
  string Range, DateTime GeneratedAt,
  RevenueBlock Revenue,                 // { total, deltaPct, series: [{ date, revenue, orders }] }
  DashboardKpis Kpis,                   // { orders, avgOrderValue, inventoryValue, lowStockSkus } كل واحد KpiValue
  IReadOnlyList<ChannelSalesDto> Channels,      // { channel (اسم عربي), revenue, orders }
  IReadOnlyList<WarehouseStatusDto> Warehouses, // { id, name, city, capacityPct, skuCount, lowStockCount }
  IReadOnlyList<LowStockItemDto> LowStock,      // { sku, name, warehouse, quantity, reorderLevel }
  IReadOnlyList<RecentOrderDto> RecentOrders,   // { id, customer, channel (اسم عربي), itemCount, total, status, createdAt }
  IReadOnlyList<TopProductDto> TopProducts)     // { sku, name, category, unitsSold, revenue }

KpiValue(decimal Value, decimal DeltaPct, IReadOnlyList<decimal> Trend)
// deltaPct = previous ? round((cur − prev) / prev × 100, 1) : 0 — مقارنة بالفترة السابقة بنفس الطول
// trend = قيمة لكل bucket (الأقدم الأول)
```

## 2) الـ Buckets (توقيت القاهرة)
- `7d` ← 7 أيام (bucket يوم)، `30d` ← 30 يوم، `90d` ← 13 أسبوع (bucket 7 أيام). آخر bucket بينتهي آخر النهارده.
- `series[].date` = بداية الـ bucket (ISO).
- الفترة السابقة = نفس الطول قبلها مباشرة.

## 3) الحسابات (المصدر: الطلبات غير الملغية)
- `revenue.total` = Σ total. `revenue.deltaPct` مقارنة بالسابقة. `series` لكل bucket: revenue و عدد الطلبات.
- `kpis.orders` = عدد الطلبات، trend لكل bucket.
- `kpis.avgOrderValue` = round(revenue / orders)، trend لكل bucket.
- `kpis.inventoryValue` = Σ qty × purchasePrice الحالي. الـ trend/السابق من جدول **`InventorySnapshots`** (Date, TotalValue, LowStockSkus) — اعمل `BackgroundService` يسجل snapshot يومي الساعة 23:55 القاهرة، و seed لـ 120 يوم فاتوا. لو مفيش snapshot ليوم ← استخدم أقرب قيمة قبله أو القيمة الحالية.
- `kpis.lowStockSkus` = عدد صفوف الرصيد (صنف نشط × مخزن نشط) اللي level `low` أو `out` — trend من الـ snapshots.
- `channels` = لكل قناة (`online` = المتجر الإلكتروني، `pos` = نقاط البيع، `wholesale` = الجملة): revenue و orders في الفترة.
- `warehouses` = المخازن النشطة: `capacityPct = usagePct` (من خطوة 07، cap 100)، `skuCount = itemsCount`، `lowStockCount`، `city`.
- `lowStock` = أسوأ 6 صفوف رصيد (`low`/`out`) مرتبة بنسبة `qty / minStock` تصاعدي: `sku` = كود الصنف، `warehouse` = اسم المخزن، `quantity` = qty، `reorderLevel` = حد المخزن.
- `recentOrders` = آخر 6 طلبات (أي حالة): `id` = **رقم** الطلب، `customer`، `channel` بالعربي.
- `topProducts` = أعلى 5 أصناف بالإيراد في الفترة من سطور الطلبات: `sku` = الكود، `category` = اسم المجموعة.

## 4) الأداء
- كله في استعلامات مجمّعة (5–7 queries بالكتير)، و `IMemoryCache` 60 ثانية لكل `range`.

## 5) الاختبارات
- طلبات معروفة في الـ arrange ← الأرقام بالظبط (total، deltaPct، عدد الـ buckets 7/30/13).
- الطلبات الملغية مستبعدة. `range=abc` ← 30d.

## معايير القبول
- [ ] endpoint مطابق للعقد بأرقام حقيقية + snapshots يومية.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (23 ✅).


---
---

# الخطوة 24 — التقارير: `ReportsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **endpoint-ين** مبنيين على الطلبات (خطوة 21) — كل رقم لازم يطابق شاشة الطلبات.

Route: `api/reports` — `[HasPermission("Reports.View")]`.

`range` = `7d` | `30d` | `90d` | `12m` (أي حاجة تانية ← `30d`).

## 1) النوافذ الزمنية (توقيت القاهرة)
| range | granularity | buckets |
|---|---|---|
| 7d | day | 7 أيام تنتهي آخر النهارده |
| 30d | day | 30 يوم |
| 90d | week | 13 bucket × 7 أيام |
| 12m | month | 12 شهر ميلادي، آخرهم الشهر الحالي (من أول الشهر) |

الفترة السابقة = نفس الطول قبل بداية النافذة. "قابل للفوترة" = غير ملغي.

## 2) `GET /api/reports/overview?range=`

```csharp
ReportsOverviewDto(
  string Range, string Granularity, DateTime GeneratedAt,
  ReportKpis Kpis,              // revenue, orders, avgOrderValue, grossProfit — كلهم KpiValue {value, deltaPct, trend}
  IReadOnlyList<ReportPointDto> Series,        // { date (بداية الـ bucket), revenue, orders }
  IReadOnlyList<CategorySalesDto> Categories,  // { groupId, name, color, revenue, units } أعلى 8 بالإيراد
  IReadOnlyList<ChannelReportDto> Channels,    // { channel: online|pos|wholesale, revenue, orders } مرتبة تنازلي بالإيراد
  IReadOnlyList<PaymentReportDto> Payments,    // { method: cash|card|wallet|credit, amount, orders } بالترتيب ده
  IReadOnlyList<StatusReportDto> Statuses)     // { status, orders } للخمس حالات — بتشمل الملغي
```
- `revenue` = Σ total للقابل للفوترة. `orders` = عددهم. `avgOrderValue` = round(revenue/orders) أو 0.
- `grossProfit` = Σ لكل طلب: `Σ((unitPrice − unitCost) × qty) − discount`.
- `deltaPct` = round((cur − prev)/prev × 100, 1) أو 0. `trend` = القيمة لكل bucket.
- `categories` من سطور الطلبات القابلة للفوترة: revenue = Σ line.total، units = Σ qty، بالمجموعة الحالية للصنف.
- `statuses` على **كل** طلبات الفترة.

## 3) `GET /api/reports/products?range=30d&...` — paged
صف لكل صنف اتباع في الفترة (طلبات قابلة للفوترة):
```csharp
ProductReportRowDto(string Id, string Code, string Name, string GroupId, string GroupName, string GroupColor,
                    decimal UnitsSold, int Orders /*عدد سطور الطلبات*/, decimal Revenue, decimal Profit,
                    decimal MarginPct /*round(profit/revenue×100,1)*/, decimal SharePct /*round(revenue/إجمالي الفترة×100,2)*/)
```
- `range` جاي كـ query param عادي مع باقي الفلاتر.
- Search: `name`, `code`, `groupName`. فلتر: `groupId`.
- sortBy: `code`, `name`, `groupName`, `unitsSold`, `orders`, `revenue`, `profit`, `marginPct`, `sharePct`. الافتراضي `revenue desc`.
- التجميع في SQL (`GROUP BY ItemId`) وبعدين البحث والـ paging.

## 4) الأداء
- `IMemoryCache` دقيقتين لكل range للـ overview.

## 5) الاختبارات
- `revenue` في overview لـ `30d` = `stats.revenue` من `GET /orders/stats?period=30d` (نفس الطلبات).
- عدد الـ buckets لكل range، الـ `12m` شهور ميلادية.
- Σ sharePct ≈ 100، الربح بيطرح خصم الطلب.

## معايير القبول
- [ ] 2 endpoints مطابقين للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (24 ✅).


---
---

# الخطوة 25 — المراجعة النهائية والتجهيز للإنتاج

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي **مفيهاش features جديدة** — مراجعة شاملة وتقفيل.

## 1) مراجعة العقد مع الفرونت
اعمل جدول في `docs/API-CONTRACT.md` بكل endpoint (Method، Route، Permission، Query params، Body، Response، أكواد الأخطاء). لازم يحتوي على الأقل على:

```
auth: POST login · POST refresh-token · POST logout · GET me
users: GET · GET stats · GET {id} · POST · PUT {id} · DELETE {id} · POST {id}/status · POST {id}/reset-password
settings: GET · PUT
item-groups: GET · GET lookup · POST · PUT {id} · DELETE {id}
items: GET · GET {id} · POST · PUT {id} · DELETE {id} · GET lookup
warehouses: GET · GET lookup · GET {id} · POST · PUT {id} · DELETE {id}
stock: GET · GET summary · GET items/{itemId}
parties: GET · GET lookup · GET {id} · POST · PUT {id} · DELETE {id} · GET {id}/statement · GET {id}/statement/detailed · GET balances · GET balances/summary
accounts: GET · GET lookup · GET {id} · POST · PUT {id} · DELETE {id}
cost-centers: GET · GET lookup · POST · PUT {id} · DELETE {id}
documents: GET · GET stats · GET {id} · POST · PUT {id} · DELETE {id} · POST {id}/post · POST {id}/complete · POST {id}/cancel · POST {id}/convert
vouchers: GET · GET stats · GET {id} · POST · PUT {id} · DELETE {id} · POST {id}/post · POST {id}/cancel
employees: GET · GET stats · POST · PUT {id} · DELETE {id}
budget: GET · PUT {year}
currencies: GET · POST · PUT {id} · DELETE {id}
pos/settings: GET · PUT
orders: GET · GET stats · GET {id} · PATCH {id}/status
payments: GET · GET stats · GET {id} · POST {id}/confirm · POST {id}/fail · POST {id}/retry · POST {id}/refund · POST {id}/settle
dashboard: GET overview
reports: GET overview · GET products
```
- اكتب **contract test** واحد بيلف على كل الـ routes ويتأكد إنها موجودة وبترجع الـ envelope (مش 404/405)، وإن كل endpoint (ما عدا login/refresh/logout) بيرجع 401 من غير توكن.
- تأكد إن كل enum بيتبعت بالقيمة الحرفية (`sale-return`, `partially_refunded`, `goods-receipt`…) — test بيعمل serialize لكل قيمة.

## 2) الأمان
- كل الـ permissions متطبقة (test لكل controller إن مستخدم من غير الصلاحية ← 403).
- `Jwt:Key` و connection string من env vars / Key Vault في Production، مش في الريبو.
- HTTPS + HSTS، Security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`).
- CORS لأصول الإنتاج بس.
- Rate limiting عام (مثلًا 300 طلب/دقيقة لكل مستخدم) غير اللي على login.
- مفيش SQL خام بيتبني بتوصيل نصوص.
- Audit log (جدول `AuditLogs`: user, action, entity, entityId, at, payload مختصر) لكل عمليات الكتابة على: users، settings، post/cancel للمستندات والسندات، المدفوعات.

## 3) الأداء
- راجع كل الـ queries بـ logging الـ SQL: مفيش N+1، و `AsNoTracking` في كل القراءات.
- Indexes على: كل الأعمدة اللي فيها فلاتر و sort الافتراضي (`Documents(Kind, CreatedAt)`, `Documents(PartyId)`, `Vouchers(Kind, Date)`, `Orders(CreatedAt)`, `StorePayments(CreatedAt)`, `StockBalances(WarehouseId)` …)، و `SearchText`.
- Load test بسيط (k6 أو NBomber): 50 مستخدم على `/items/lookup` و `/documents` و `/dashboard/overview` — p95 أقل من 300ms.

## 4) الموثوقية
- كل العمليات المركبة في transaction واحدة (راجعها: create+post، complete reservation، order status + payments).
- Concurrency على `StockBalances` و `Documents` و `NumberSequences` (اختبارات توازي موجودة؟).
- Health checks: DB + `/health/ready`.
- Serilog structured logs + `CorrelationId` في كل request و header `X-Correlation-Id` في الرد.
- Global exception handler ماتطلعش stack trace برا.

## 5) الـ Seed والبيئات
- `Production`: الحسابات (أرصدة صفر)، EGP، الترقيم (NextNumber = 1)، إعدادات النظام ونقطة البيع الافتراضية، ومستخدم Admin واحد بباسورد من env var (`SEED_ADMIN_PASSWORD`) — **ومفيش** بيانات تجريبية.
- `Development`: كل الـ seed التجريبي من الخطوات، وفي الآخر `TrialBalance.IsBalanced` و `Σ StockBalances = Σ StockMovements` لكل صنف/مخزن.
- أمر CLI: `dotnet run -- seed --reset` لإعادة بناء داتا التطوير.

<!-- ## 6) النشر
- `Dockerfile` (multi-stage) + `docker-compose.yml` (api + sqlserver).
- الـ migrations بتتطبق بأمر منفصل/`migration bundle` في الـ pipeline (مش تلقائي عند الإقلاع في Production).
- GitHub Actions: build + test (Testcontainers) + publish image. -->

## 7) ربط الفرونت
اكتب في `docs/FRONTEND-HANDOFF.md`:
- قيمة `apiUrl` المطلوبة و `mockApi: false` في `src/environments/environment*.ts` بتاعة الفرونت.
- حسابات التجربة.
- أي اختلاف متعمد عن الـ mock (مثلًا: حذف صنف عليه حركات بقى ممنوع، قواعد خصم نقطة البيع، الـ 429 في login).

## معايير القبول
- [ ] `docs/API-CONTRACT.md` و `docs/FRONTEND-HANDOFF.md` موجودين.
- [ ] contract tests + permission tests + concurrency tests خضرا.
<!-- - [ ] `docker compose up` بيشغل الـ API والفرونت يقدر يدخل بـ `admin@xturbo.com`. -->
- [ ] `docs/PROGRESS.md` كله ✅.


---
---

