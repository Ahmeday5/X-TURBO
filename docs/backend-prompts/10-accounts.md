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
