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
