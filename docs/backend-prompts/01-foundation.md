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
- الاختبارات: **xUnit** + **FluentAssertions** + `WebApplicationFactory` + **Testcontainers.MsSql** (قاعدة SQL Server حقيقية في Docker للاختبارات).

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
