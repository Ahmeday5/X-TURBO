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
