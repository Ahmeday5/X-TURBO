# الخطوة 13 — المستندات التجارية والمخزنية: `DocumentsController` (الجزء 1 — CRUD)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **list / stats / get / create / update / delete** للمستندات. الترحيل والإلغاء والتحويل (post/complete/cancel/convert) في خطوة 14.

كل المستندات (فواتير بيع وشراء، مرتجعات، عروض أسعار، تحويلات، سندات صرف واستلام بضاعة، حجوزات) **ليها شكل واحد**: رأس + سطور أصناف + إجماليات، والفرق في `kind` بس.

Route: `api/documents` — `[HasAnyPermission("Invoices.View","Pos.Access")]`.

---

## 1) الأنواع وإعداداتها (حطها في الـ Domain كـ `DocKindConfig` — هي اللي بتتحكم في التحقق والتأثير)

| kind | الاسم المفرد | Prefix | الطرف | الطرف إلزامي | تحويل لمخزن تاني | مالي (خصم/ضريبة/دفع) | تأثير المخزون | `dueDate` مستخدم | الأسباب | يتحول إلى |
|---|---|---|---|---|---|---|---|---|---|---|
| `quotation` | عرض سعر | QT | customer | ✅ | ❌ | ✅ | none | ✅ (صالح حتى) | — | sale |
| `sale` | فاتورة بيع | SI | customer | ❌ | ❌ | ✅ | out | ✅ | — | sale-return |
| `purchase` | فاتورة شراء | PI | supplier | ✅ | ❌ | ✅ | in | ✅ | — | purchase-return |
| `sale-return` | مرتجع بيع | SR | customer | ❌ | ❌ | ✅ | in | ❌ | — | — |
| `purchase-return` | مرتجع شراء | PR | supplier | ✅ | ❌ | ✅ | out | ❌ | — | — |
| `transfer` | تحويل مخزني | TR | — | ❌ | ✅ | ❌ | move | ❌ | — | — |
| `voucher-transfer` | تحويل بسند | VT | — | ❌ | ✅ | ❌ | ship | ❌ | — | — |
| `goods-issue` | سند صرف | GI | — | ❌ | ❌ | ❌ | out | ❌ | consumption, damage, sample, shortage, other | — |
| `goods-receipt` | سند استلام | GRN | — | ❌ | ❌ | ❌ | in | ❌ | opening, surplus, production, other | — |
| `reservation` | حجز طلبية | RS | customer | ✅ | ❌ | ✅ | reserve | ✅ (موعد الاستلام) | — | — |

- "يحتاج إتمام (complete)": `voucher-transfer` و `reservation` بس.
- الحالات: `draft` (مسودة — مفيش تأثير) → `posted` (مُرحّل — التأثير اتطبق) → `completed` (مكتمل) أو `cancelled` (ملغي — التأثير اتعكس).
- طرق الدفع: `cash | card | wallet | bank | credit`.
- القنوات: `erp | pos`.

## 2) الـ Entities

```csharp
Document {
  string Id; string Kind; string Number;     // unique (Kind, Number)
  DateOnly Date; DateOnly? DueDate;
  string? PartyId; string? PartyName;        // snapshot للاسم — يتحدث لما الحساب يتغير اسمه
  string WarehouseId; string WarehouseName;  // snapshot
  string? ToWarehouseId; string? ToWarehouseName;
  string Reference;                          // رقم فاتورة المورد / مرجع
  string? Reason;                            // لسندات الصرف/الاستلام
  string? PaymentMethod;
  decimal Subtotal, Discount, TaxPct, Tax, Total, Paid, Remaining;
  string Status;                             // draft | posted | completed | cancelled
  string Channel;                            // erp | pos
  string? SourceId; string? SourceNumber;    // المستند اللي اتعمل منه
  string? TargetId; string? TargetNumber;    // المستند اللي اتعمل منه (للأمام)
  string Notes;
  string CreatedBy; DateTime CreatedAt; DateTime? PostedAt;
  byte[] RowVersion;
  List<DocumentLine> Lines;
  string SearchText;   // number + partyName + reference + warehouseName + toWarehouseName + notes + createdBy
}
DocumentLine {
  long Id; string DocumentId; int LineNo;
  string ItemId; string Code; string Name; string Unit;   // snapshot من الصنف
  decimal Qty; decimal Price; decimal DiscountPct; decimal Total;
  decimal? UnitCost;   // يتملى وقت الترحيل (خطوة 12/14)
}
```
- حدّث `PartiesService` (خطوة 09) إنه يحدّث `PartyName` في المستندات لما الاسم يتغير، و `WarehousesService` (خطوة 07) يحدّث `WarehouseName`/`ToWarehouseName`.
- حدّث الـ usage checkers: `IItemUsageChecker`، `IWarehouseUsageChecker`، `IPartyUsageChecker` إنهم يشوفوا جدول المستندات.
- `INumberCollisionChecker` (خطوة 04) يشوف `(Kind, Number)`.

## 3) الحسابات (لازم تتطابق مع الفرونت بالظبط)

```
round2(x)          = Math.Round(x, 2, AwayFromZero)
lineTotal          = round2(qty × price × (1 − clamp(discountPct,0,100)/100))
subtotal           = round2(Σ lineTotal)
discount           = round2(clamp(discount, 0, subtotal))
tax                = round2((subtotal − discount) × max(taxPct,0) / 100)     ← الضريبة بعد الخصم
total              = round2(subtotal − discount + tax)
remaining          = round2(max(total − max(paid,0), 0))
```
حطها في `DocumentMath` + unit tests بأرقام معروفة.

## 4) بناء المستند من الـ Payload (التحقق) — نفس الدالة للإنشاء والتعديل

Payload:
```json
{
  "kind": "sale", "date": "2026-11-09", "dueDate": null,
  "partyId": "…", "warehouseId": "wh-cai", "toWarehouseId": null,
  "reference": "", "reason": null, "paymentMethod": "cash",
  "lines": [ { "itemId": "…", "qty": 2, "price": 1450, "discountPct": 0 } ],
  "discount": 0, "taxPct": 14, "paid": 3306, "notes": "",
  "channel": "erp",
  "post": false
}
```

بالترتيب:
1. `kind` مش معروف ← 422 `نوع المستند غير معروف`.
2. المخزن مش موجود ← 404 `المخزن غير موجود`؛ موقوف ← 422 `المخزن «{name}» موقوف`.
3. لو النوع تحويل: المخزن المستلم مش موجود ← 404 `المخزن المستلم غير موجود`؛ هو نفس المخزن ← 422 `المخزن المستلم يجب أن يختلف عن المخزن المحوِّل`.
4. لو النوع ليه طرف و `partyId` مبعوت: مش موجود ← 404 `الحساب غير موجود`؛ مش مناسب (`partyFits`) ← 422 `«{name}» ليس عميلًا` أو `«{name}» ليس موردًا`.
5. الطرف إلزامي ومش موجود ← 422 `اختر العميل` (أو `اختر المورد` للمورد).
6. النوع ليه أسباب و `reason` فاضي أو مش من القائمة ← 422 `اختر سبب الحركة`.
7. `lines` فاضية ← 422 `أضف صنفًا واحدًا على الأقل`.
8. لكل سطر `i` (من 1): الصنف مش موجود ← 422 `الصنف في السطر {i} غير موجود`؛ `qty ≤ 0` ← 422 `الكمية في السطر {i} يجب أن تكون أكبر من صفر`. `price = max(0, price)`، `discountPct = clamp(0..100)`. الكود/الاسم/الوحدة من الصنف.
9. لو مش مالي: `taxPct = 0`, `discount = 0`.
10. `paid`: لو مالي و تأثيره مش `none` ← `clamp(paid, 0, total)`، غير كده 0 (عرض السعر مفيهوش دفع؛ الحجز بياخد عربون).
11. لو مالي و تأثيره ≠ none و النوع ≠ reservation و `remaining > 0` ومفيش طرف ← 422 `البيع / الشراء الآجل يتطلب تحديد الحساب`.
12. `date` الفاضي ← النهارده. `dueDate` يتحفظ بس لو النوع بيستخدمه، غير كده null.
13. `reason` يتحفظ بس لو النوع ليه أسباب.
14. `paymentMethod`: لو مالي و تأثير ≠ none: لو `remaining > 0 && paid == 0` ← `credit`، غير كده اللي جاي أو `cash`. غير كده null.
15. `channel`: من الـ payload، أو القديم (في التعديل)، أو `erp`.
16. `reference` و `notes` trim.

### المرتجعات المربوطة بفاتورة
لو المستند مرتجع وليه `SourceId` (اتعمل بالتحويل في خطوة 14): لكل صنف، الكمية ≤ (كمية الفاتورة الأصلية − مرتجعات تانية غير ملغية من نفس الفاتورة، من غير المستند ده نفسه) ← غير كده 422 `لا يمكن إرجاع {qty} من «{name}» — المتاح للإرجاع {max}`.

## 5) الـ DTOs

```csharp
// صف القائمة = الرأس كله + عدّادات (من غير السطور)
DocumentSummaryDto : (كل حقول الرأس) + int LinesCount + decimal TotalQty
// GET by id = الرأس + السطور
DocumentDto : (كل حقول الرأس) + IReadOnlyList<DocLineDto> Lines
DocLineDto(string ItemId, string Code, string Name, string Unit, decimal Qty, decimal Price, decimal DiscountPct, decimal Total)

DocumentStatsDto(int Count, int Draft, int Posted, int Completed, int Cancelled,
                 decimal Total, decimal Paid, decimal Remaining, decimal TotalQty)
```
حقول الرأس بالترتيب: `id, kind, number, date, dueDate, partyId, partyName, warehouseId, warehouseName, toWarehouseId, toWarehouseName, reference, reason, paymentMethod, subtotal, discount, taxPct, tax, total, paid, remaining, status, channel, sourceId, sourceNumber, targetId, targetNumber, notes, createdBy, createdAt, postedAt`. (`UnitCost` **مايطلعش** في الـ API.)

## 6) الـ Endpoints

### 6.1 `GET /api/documents?kind=sale&...` — paged
- Search: `number`, `partyName`, `reference`, `warehouseName`, `toWarehouseName`, `notes`, `createdBy`.
- فلاتر:
  - `kind` — مساواة (الشاشات دايمًا بتبعته).
  - `status`.
  - `partyId`.
  - `warehouseId` — المخزن **أو** المخزن المستلم.
  - `channel` — `erp` | `pos`.
  - `payment` — `paid` (`remaining ≤ 0`) | `unpaid` (`paid ≤ 0 && remaining > 0`) | `partial` (`paid > 0 && remaining > 0`).
  - `overdue` — أي قيمة: `dueDate != null && remaining > 0 && status == posted && dueDate < النهارده`.
  - `from` / `to` — على `date` شاملين.
- sortBy: `number`, `date`, `dueDate`, `partyName`, `warehouseName`, `total`, `paid`, `remaining`, `status`, `createdAt`. **الافتراضي `createdAt desc`**.

### 6.2 `GET /api/documents/stats?kind=…` — نفس الفلاتر **ما عدا `status` بيتجاهل** (عشان عدّادات التابات)
- `count/draft/posted/completed/cancelled` على كل الصفوف.
- `total/paid/remaining/totalQty` على الصفوف **غير الملغية** بس.

### 6.3 `GET /api/documents/{id}` ← `DocumentDto` أو 404 `المستند غير موجود`.

### 6.4 `POST /api/documents` ← 201 + `DocumentDto`
- يبني ويتحقق (بند 4)، الرقم من `NumberSequences` key `doc:{kind}`، الحالة `draft`، `CreatedBy` = اسم المستخدم.
- `post: true` ← يرحّل فورًا في **نفس الـ transaction** (المنطق في خطوة 14). لو الترحيل فشل ← **مايتحفظش أي حاجة** (ولا حتى المسودة، ولا الرقم يتحرق — رجّع الـ sequence في نفس الـ transaction). في الخطوة دي اعمل الـ hook `IDocumentWorkflow.PostAsync` واتركه `NotImplemented` لحد خطوة 14 (والـ test بتاعه skipped).

### 6.5 `PUT /api/documents/{id}` — **مسودات بس**
- مش مسودة ← 409 `لا يمكن تعديل مستند مُرحّل — ألغِه وأنشئ غيره`.
- `kind` مختلف ← 422 `لا يمكن تغيير نوع المستند`.
- يعيد بناء الرأس والسطور (استبدال كامل للسطور)، ويعيد فحص المرتجع لو مربوط.
- `post: true` ← يرحّل بعد الحفظ.

### 6.6 `DELETE /api/documents/{id}` — **مسودات بس**
- مش مسودة ← 409 `يمكن حذف المسودات فقط — ألغِ المستند بدلًا من ذلك`.
- لو مستند تاني بيشاور عليه بـ `TargetId` (مثلًا عرض سعر اتحول للمسودة دي) ← رجّع الأصل لحالته (`status = posted`، `TargetId/Number = null`).

## 7) الاختبارات

- `DocumentMath` بأرقام فيها خصم سطر + خصم رأس + ضريبة.
- كل قاعدة تحقق في بند 4 ليها test.
- فلاتر `payment` و `overdue` و `warehouseId` (للمستلم).
- stats بتتجاهل `status` وبتستبعد الملغي من المبالغ.
- تعديل/حذف مستند مش مسودة ← 409.

## معايير القبول

- [ ] 6 endpoints مطابقة للعقد + `DocKindConfig` في الـ Domain.
- [ ] الـ snapshots (اسم الطرف/المخزن) بتتحدث.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (13 ✅).
