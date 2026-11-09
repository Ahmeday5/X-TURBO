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
