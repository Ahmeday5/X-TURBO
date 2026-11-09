# الخطوة 20 — إعدادات نقطة البيع: `PosSettingsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **PosSettingsController** + ربط الخزينة بقيود مبيعات نقطة البيع.

شاشة الكاشير نفسها **مش محتاجة endpoints جديدة** — بتستخدم:
- `GET items/lookup?warehouseId=` (خطوة 08) للأصناف.
- `GET parties/lookup?role=customer` و `POST parties` بـ `isExternal: true` للعميل السريع (خطوة 09).
- `POST documents` بـ `kind: "sale"`, `channel: "pos"`, `post: true` (خطوات 13/14).
- الحجوزات: `documents` بـ `kind: "reservation"`.
- السلات المعلقة متخزنة في المتصفح (مش في الـ API).

Route: `api/pos/settings` — `[HasPermission("Pos.Access")]` للـ GET والـ PUT.

---

## 1) الـ DTO

```json
{
  "warehouseId": "wh-shw",
  "cashAccountId": "acc-1105",
  "paymentMethods": ["cash", "card", "wallet", "credit"],
  "defaultTaxPct": 0,
  "allowDiscount": true,
  "maxDiscountPct": 15,
  "receiptHeader": "X-TURBO لقطع غيار السيارات\nالتجمع الخامس — شارع التسعين الجنوبي",
  "receiptFooter": "شكرًا لزيارتكم — الاستبدال خلال 14 يومًا بالفاتورة",
  "paperWidth": 80,
  "autoPrint": false,
  "updatedAt": "2026-10-28T09:00:00Z",
  "updatedBy": "أحمد حسن"
}
```
- `warehouseId: null` = المخزن الافتراضي للنظام.
- الـ PUT payload = نفس الشكل من غير `updatedAt`/`updatedBy`.
- التخزين: جدول `PosSettings` صف واحد (Id = 1). `paymentMethods` كـ string مفصول بفاصلة أو JSON.

## 2) `GET /api/pos/settings` ← الـ DTO (لو مفيش صف ← يرجع القيم الافتراضية فوق).

## 3) `PUT /api/pos/settings` ← الـ DTO بعد الحفظ

| الحالة | الكود | الرسالة |
|---|---|---|
| `warehouseId` مبعوت ومش موجود | 404 | `المخزن غير موجود` |
| `warehouseId` موقوف | 422 | `المخزن «{name}» موقوف` |
| `cashAccountId` مش واحد من `acc-1105`, `acc-1101`, `acc-1102` | 422 | `اختر الخزينة` |
| `paymentMethods` بعد الفلترة (من `cash, card, wallet, credit` بالترتيب ده) فاضية | 422 | `فعّل طريقة دفع واحدة على الأقل` |
| `defaultTaxPct` مش بين 0 و 100 | 422 | `نسبة الضريبة يجب أن تكون بين 0 و 100` |
| `maxDiscountPct` مش بين 0 و 100 | 422 | `أقصى خصم يجب أن يكون بين 0 و 100` |

التطبيع:
- `warehouseId` الفاضي → null.
- `maxDiscountPct` = 0 لو `allowDiscount = false`.
- `receiptHeader`/`receiptFooter` trim و max 300 حرف.
- `paperWidth`: 58 لو 58، غير كده 80.
- `autoPrint` bool. `updatedAt = now`، `updatedBy = اسم المستخدم`.

## 4) قواعد على مبيعات نقطة البيع (عدّل خطوات 12/14)

لما مستند `sale` بـ `channel = "pos"` يترحّل:
1. **الخزينة**: طريقة الدفع `cash` ← حساب التسوية = `PosSettings.CashAccountId` (بدل `acc-1105` الثابت في خطوة 12).
2. **طريقة الدفع** لازم تكون من `PosSettings.PaymentMethods` ← غير كده 422 `طريقة الدفع غير مفعلة في نقطة البيع`.
3. **الخصم**: لو `allowDiscount = false` وفيه أي خصم (سطر أو رأس) ← 422 `الخصم غير مسموح في نقطة البيع`. لو مسموح: `discountPct` لأي سطر ≤ `maxDiscountPct`، والخصم الكلي ≤ `subtotal × maxDiscountPct / 100` ← غير كده 422 `الخصم يتجاوز الحد المسموح ({max}%)`.
4. المخزن: الفرونت بيبعت المخزن، والـ API مايفرضش إنه نفس مخزن الإعدادات (المدير ممكن يبيع من مخزن تاني).

## 5) الاختبارات
- GET قبل أي حفظ ← القيم الافتراضية.
- كل قاعدة تحقق.
- بيع POS نقدي بعد تغيير الخزينة لـ `acc-1101` ← القيد على 1101.
- خصم أكبر من الحد في بيع POS ← 422، ونفس الخصم في بيع `erp` ← ينجح.

## معايير القبول
- [ ] 2 endpoints مطابقين للعقد + قواعد البيع من نقطة البيع.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (20 ✅).
