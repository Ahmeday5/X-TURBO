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
