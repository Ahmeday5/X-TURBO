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
