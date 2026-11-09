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
