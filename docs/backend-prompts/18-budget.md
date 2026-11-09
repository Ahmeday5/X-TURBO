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
