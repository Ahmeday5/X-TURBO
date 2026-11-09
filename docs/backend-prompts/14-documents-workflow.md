# الخطوة 14 — دورة حياة المستندات: `DocumentsController` (الجزء 2 — Workflow)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **post / complete / cancel / convert** + تأثير المخزون + القيود + سجل حركات المخزون. هتستخدم `IStockLedger` (خطوة 07) و `IPostingEngine` (خطوة 12).

نفس الـ Controller ونفس الصلاحية: `[HasAnyPermission("Invoices.View","Pos.Access")]`.

**كل عملية هنا = transaction واحدة.** لو أي جزء فشل، مفيش أي أثر (مخزون، قيود، حالة).

---

## 1) جدول حركات المخزون (جديد)

```csharp
StockMovement {
  long Id;
  string ItemId; string WarehouseId;
  decimal Qty;                 // بإشارة: + دخول / − خروج
  DateOnly Date; DateTime At;
  string DocumentId; string DocumentNumber; string DocumentKind;
  string? PartyName;
  bool IsVoided;
}
// Index: (ItemId, At DESC) WHERE IsVoided = 0
```
- كل `AdjustQtyAsync` في `IStockLedger` لازم يكتب حركة (عدّل `IStockLedger` ياخد بيانات المستند).
- الحجز (`reserve`) **مش** حركة.
- كمّل `GET /api/stock/items/{itemId}` (خطوة 08): `movements` = آخر 30 حركة غير ملغية، الأحدث الأول، و `kindLabel` = الاسم المفرد من `DocKindConfig`.

## 2) تأثير الترحيل على المخزون (`applyEffects(sign)`)

لكل سطر (`q = qty × sign`):
| التأثير | العملية |
|---|---|
| `out` | المخزن: −q |
| `in` | المخزن: +q |
| `move` | المخزن: −q ، المخزن المستلم: +q |
| `ship` | المخزن: −q (الاستلام عند الإتمام) |
| `reserve` | المحجوز في المخزن: +q |
| `none` | مفيش |

`sign = +1` عند الترحيل، `−1` عند الإلغاء (والحركات المرتبطة تتعلم `IsVoided`).

## 3) الـ Endpoints

### 3.1 `POST /api/documents/{id}/post` — مسودة ← مُرحّل
Body: `{}` ← يرجع `DocumentDto`.
1. مش مسودة ← 409 `المستند مُرحّل بالفعل`.
2. لو التأثير `out` / `move` / `ship` / `reserve`: `IStockLedger.AssertAvailableAsync(warehouseId, lines)` — الكمية المطلوبة لكل صنف (مجمّعة) ≤ `qty − reserved`، إلا لو المخزن `AllowNegative` أو الإعداد العام `allowNegativeStock`. الرسالة: 409 `الكمية غير متاحة: «{اسم الصنف}» — المتاح في {اسم المخزن} {max(available,0)} {الوحدة}`.
3. **حد الائتمان**: لو `kind == sale` وليه طرف و `remaining > 0` والطرف `creditLimit > 0`: `exposure = رصيد الطرف الحالي + remaining`. لو `exposure > creditLimit` ← 409 `تجاوز حد الائتمان لـ«{name}»: الحد {creditLimit بفواصل آلاف} والمديونية بعد الفاتورة {round(exposure) بفواصل آلاف}` (الأرقام بأرقام إنجليزي `N0`).
4. خزّن `UnitCost` لكل سطر = سعر شراء الصنف الحالي.
5. `applyEffects(+1)`.
6. `IPostingEngine.PostDocumentAsync(doc)` (الأنواع المالية فقط حسب جدول خطوة 12).
7. `status = posted`، `postedAt = now`.

### 3.2 `POST /api/documents/{id}/complete` — مُرحّل ← مكتمل
Body: `{}` ← يرجع `DocumentDto` (المستند نفسه بعد التحديث).
- النوع مالوش إتمام ← 422 `هذا المستند لا يحتاج إلى إتمام`.
- مش `posted` ← 409 `يجب ترحيل المستند أولًا`.
- **voucher-transfer**: لكل سطر ← المخزن المستلم +qty (حركات دخول).
- **reservation** (تسليم وإصدار فاتورة):
  1. فك الحجز: المحجوز −qty لكل سطر.
  2. أنشئ **فاتورة بيع** بنفس الطرف والمخزن والسطور والخصم والضريبة، `date = النهارده`، `dueDate = null`، `paid = عربون الحجز`، `paymentMethod = طريقة الحجز أو cash`، `notes = "تسليم {رقم الحجز}"` (+ ` — {ملاحظات الحجز}` لو موجودة)، و **رحّلها** (يعني فحص الكمية وحد الائتمان والقيود).
  3. الفاتورة: `sourceId/sourceNumber` = الحجز. الحجز: `targetId/targetNumber` = الفاتورة.
  4. لو أي حاجة فشلت ← rollback كامل (الحجز يفضل محجوز).
- `status = completed`.

> ملحوظة: عربون الحجز **مش** بيتقيد عند ترحيل الحجز (الحجز مش بيعمل قيود). الفلوس بتتقيد مرة واحدة في فاتورة البيع عند التسليم.

### 3.3 `POST /api/documents/{id}/cancel`
Body: `{ "reason": "…" }` ← يرجع `DocumentDto`.
- ملغي بالفعل ← 409 `المستند ملغي بالفعل`.
- مكتمل ← 409 `لا يمكن إلغاء مستند مكتمل`.
- فيه مرتجع غير ملغي معمول من المستند ده (`sourceId = id` ونوعه sale-return/purchase-return) ← 409 `ألغِ المرتجع المرتبط {رقم المرتجع} أولًا`.
- لو `posted`:
  - التأثير `in`: لازم الكمية اللي دخلت لسه متاحة في المخزن ← غير كده 409 `لا يمكن الإلغاء: الكمية المستلمة لم تعد متاحة`.
  - التأثير `move`: لازم متاحة في المخزن المستلم ← غير كده 409 `لا يمكن الإلغاء: الكمية المحوّلة لم تعد متاحة في المخزن المستلم`.
  - `applyEffects(−1)` + `IPostingEngine.VoidSourceAsync(id)` + الحركات `IsVoided`.
- لو المستند اتعمل من عرض سعر (المصدر quotation وحالته completed و target = المستند ده) ← رجّع عرض السعر `posted` وشيل الـ target.
- `status = cancelled`. لو فيه سبب: يتضاف للملاحظات — لو فيه ملاحظات: `"{notes}\nسبب الإلغاء: {reason}"` غير كده `"سبب الإلغاء: {reason}"`.

### 3.4 `POST /api/documents/{id}/convert`
Body: `{ "to": "sale" }` ← **201** + `DocumentDto` للمسودة الجديدة.
- `to` مش في `convertTo` بتاع النوع ← 422 `لا يمكن التحويل إلى هذا النوع`.
- المصدر مسودة أو ملغي ← 409 `رحّل المستند أولًا`.
- عرض سعر مكتمل ← 409 `عرض السعر تحوّل بالفعل إلى {targetNumber}`.
- عرض سعر `dueDate < النهارده` ← 409 `انتهت صلاحية عرض السعر`.
- لو التحويل لمرتجع: السطور = **المتاح للإرجاع** (الكمية − المرتجع قبل كده من مرتجعات غير ملغية). لو مفيش ← 409 `تم إرجاع كل أصناف هذه الفاتورة`.
- أنشئ **مسودة** (مش مرحّلة) بنفس الطرف والمخازن والسعر والخصم للسطور، و: `date = النهارده`، `dueDate = null`، `paid = 0`، `discount = 0` للمرتجع (وللباقي نفس خصم المصدر)، `reference = رقم المصدر`، `notes = ""`، `channel` = بتاع المصدر.
- `sourceId/sourceNumber` = المصدر.
- لو المصدر عرض سعر: المصدر يبقى `completed` و `targetId/targetNumber` = المسودة.

## 4) تحديثات على أجزاء سابقة

- `IItemUsageChecker` / `IWarehouseUsageChecker` / `IPartyUsageChecker` يشوفوا المستندات والحركات.
- `ItemDto.stock` و `StockRowDto.lastMovementAt` بيتحدثوا تلقائيًا عن طريق `IStockLedger`.

## 5) الـ Seed التاريخي (Development) — مهم عشان الشاشات والتقارير يبقى فيها داتا

اعمل `DevelopmentDataSeeder` بيستخدم **نفس الـ services** (مش insert مباشر) عشان المخزون والقيود يبقوا متطابقين:
1. **أرصدة افتتاحية**: لكل مخزن سند استلام (`goods-receipt`, reason `opening`, تاريخ قبل 150 يوم) بأرصدة لكل الأصناف: الرصيد الكلي للصنف 0..6×minStock (8% صفر)، موزعة على المخازن تقريبًا 46% / 18% / 15% / 13% / 8%. السعر = سعر الشراء. رحّلها.
2. **150 يوم من الحركة** (Random بـ seed ثابت)، لكل يوم:
   - 1–2 فاتورة بيع قطاعي (45% منها قناة `pos` من `wh-shw` أو `wh-cai`، مدفوعة بالكامل cash/card/wallet).
   - 45% احتمال فاتورة بيع جملة آجلة لعميل wholesale بضريبة 14%، أحيانًا دفعة 30–50%، `dueDate = date + paymentTermDays`.
   - كل 3 أيام فاتورة شراء من مورد للمخزن الرئيسي بضريبة 14%، `reference = "INV-#####"`، 30% مدفوعة بنكي.
   - 18% عرض سعر، 8% مرتجع بيع، 4% مرتجع شراء، 10% تحويل، 6% تحويل بسند (القديم أكتر من 4 أيام مكتمل)، 7% سند صرف، 5% سند استلام، 8% حجز بعربون 25%.
   - المستندات في آخر يومين: 35% منها مسودات. 3% ملغي.
   - لو مستند فشل بسبب الكمية — تجاهله وكمّل.
3. في الآخر: `TrialBalance.IsBalanced == true` (لو لأ، الـ seeder يرمي exception).

## 6) الاختبارات

- **sale**: post ← الرصيد نقص، القيد اتعمل، العميل اتمدّن بالباقي. cancel ← كل حاجة رجعت.
- **purchase**: post ← الرصيد زاد. اصرف الكمية في فاتورة بيع، وبعدين جرّب cancel للشراء ← 409 `الكمية المستلمة لم تعد متاحة`.
- **transfer**: post ← نقص من A وزاد في B.
- **voucher-transfer**: post ← نقص من A بس. complete ← زاد في B.
- **reservation**: post ← `reserved` زاد و `available` قل. complete ← فاتورة بيع مرحّلة اتعملت، الحجز اتفك، الربط في الاتجاهين.
- كمية مش متاحة ← 409 بالرسالة بالظبط. مخزن `allowNegative` ← ينجح.
- حد الائتمان ← 409.
- quotation → convert(sale) ← مسودة + العرض completed. convert تاني ← 409. حذف المسودة ← العرض رجع posted.
- sale → convert(sale-return) مرتين بكميات تتخطى المباع ← 422.
- cancel فاتورة عليها مرتجع ← 409.
- create بـ `post: true` وكمية مش متاحة ← 409 ومفيش مسودة اتحفظت والرقم ماتحرقش.
- تزامن: طلبين post متوازيين على نفس الرصيد الأخير ← واحد بس ينجح.

## معايير القبول

- [ ] 4 أكشنز مطابقة للعقد + `StockMovement` + seed تاريخي متزن.
- [ ] `GET /api/stock/items/{id}` بيرجع movements حقيقية.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (14 ✅).
