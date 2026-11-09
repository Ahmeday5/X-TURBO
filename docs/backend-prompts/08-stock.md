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
