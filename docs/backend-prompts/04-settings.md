# الخطوة 04 — إعدادات النظام: `SettingsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **SettingsController بس** + ربط الترقيم بجدول `NumberSequences` من خطوة 01.

الإعدادات **سجل واحد** للنظام كله. (إعدادات نقطة البيع منفصلة في خطوة 20.)

Route: `api/settings`
- `GET` ← أي مستخدم مسجل دخول (شاشات تانية بتحتاج نسبة الضريبة).
- `PUT` ← `[HasPermission("Settings.Manage")]`.

---

## 1) الـ DTO (نفس الشكل للـ GET والـ PUT response)

```json
{
  "company": {
    "name": "X-TURBO لقطع غيار السيارات",
    "taxNumber": "512-874-339",
    "commercialRegister": "184562",
    "phone": "0225678900",
    "email": "info@xturbo.com",
    "address": "التجمع الخامس — شارع التسعين الجنوبي، القاهرة الجديدة",
    "logoInitials": "XT"
  },
  "financial": {
    "baseCurrency": "EGP",
    "vatRate": 14,
    "pricesIncludeTax": false,
    "fiscalYearStartMonth": 1,
    "decimalPlaces": 2
  },
  "numbering": [
    { "kind": "quotation", "prefix": "QT", "nextNumber": 58, "digits": 6 },
    { "kind": "sale", "prefix": "SI", "nextNumber": 1245, "digits": 6 }
  ],
  "inventory": {
    "allowNegativeStock": false,
    "lowStockThreshold": 5,
    "defaultWarehouseId": null
  },
  "updatedAt": "2026-10-28T09:00:00Z",
  "updatedBy": "أحمد حسن"
}
```

- `numbering` **دايمًا 11 عنصر بالترتيب ده**: `quotation, sale, purchase, sale-return, purchase-return, transfer, goods-issue, goods-receipt, receipt, payment, journal`.
- الـ PUT payload = نفس الشكل من غير `updatedAt`/`updatedBy`.

## 2) التخزين

- جدول `SystemSettings` (صف واحد Id=1) فيه أعمدة `company`/`financial`/`inventory` (owned types أو أعمدة عادية) + `UpdatedAt` + `UpdatedBy`.
- **الترقيم مش متخزن هنا** — بيتقرا ويتكتب من جدول `NumberSequences` (خطوة 01) بالمفاتيح:

| kind | المفتاح في NumberSequences | Prefix افتراضي | NextNumber افتراضي | Digits |
|---|---|---|---|---|
| quotation | `doc:quotation` | QT | 58 | 6 |
| sale | `doc:sale` | SI | 1245 | 6 |
| purchase | `doc:purchase` | PI | 312 | 6 |
| sale-return | `doc:sale-return` | SR | 37 | 6 |
| purchase-return | `doc:purchase-return` | PR | 12 | 6 |
| transfer | `doc:transfer` | TR | 96 | 6 |
| goods-issue | `doc:goods-issue` | GI | 141 | 6 |
| goods-receipt | `doc:goods-receipt` | GRN | 203 | 6 |
| receipt | `voucher:receipt` | RV | 428 | 6 |
| payment | `voucher:payment` | PV | 365 | 6 |
| journal | `voucher:journal` | JV | 89 | 6 |

وكمان (مش ظاهرين في الإعدادات بس لازم يتعملهم seed): `doc:voucher-transfer` → `VT`، `doc:reservation` → `RS` (NextNumber 1، Digits 6).

> لو بتبدأ على داتابيز إنتاج فاضية، خلي الـ NextNumber = 1 للكل. القيم فوق للـ Development seed.

## 3) قواعد التحقق للـ PUT

| الحقل | القاعدة | الكود | الرسالة |
|---|---|---|---|
| company.name | مطلوب بعد trim (max 120) | 422 | `اسم الشركة مطلوب` |
| company.logoInitials | من 1 لـ 3 حروف بعد trim | 422 | `حروف الشعار من حرف إلى 3 أحرف` |
| financial.vatRate | 0..100 | 422 | `نسبة الضريبة يجب أن تكون بين 0 و 100` |
| financial.fiscalYearStartMonth | 1..12 (int) | 422 | `شهر بداية السنة المالية غير صالح` |
| financial.decimalPlaces | 0..4 (int) | 422 | `عدد الخانات العشرية من 0 إلى 4` |
| numbering | لازم الـ 11 kind موجودين | 422 | `إعدادات الترقيم ناقصة` |
| numbering[].prefix | بعد trim+uppercase يطابق `^[A-Z]{1,5}$` | 422 | `بادئة غير صالحة: «{القيمة الأصلية}»` |
| numbering[].nextNumber | ≥ 1 | 422 | `الرقم التالي لـ {PREFIX} يجب أن يكون 1 أو أكثر` |
| numbering[].digits | 1..10 | 422 | `عدد خانات الرقم من 1 إلى 10` |
| numbering | prefix مكرر بين أكتر من kind | 422 | `البادئة «{PREFIX}» مكررة لأكثر من مستند` |
| inventory.lowStockThreshold | ≥ 0 (int) | 422 | `حد التنبيه للمخزون يجب أن يكون 0 أو أكثر` |
| inventory.defaultWarehouseId | لو مبعوت: موجود | 404 | `المخزن غير موجود` |
| inventory.defaultWarehouseId | لو مبعوت: نشط | 422 | `المخزن «{name}» موقوف` |

> جدول المخازن لسه مش موجود (خطوة 07). اعمل interface `IWarehouseLookup` في الـ Application دلوقتي بـ implementation مؤقت، وفي خطوة 07 هيتربط بالحقيقي. أو أجّل التحقق ده لخطوة 07 واكتب TODO واضح في `PROGRESS.md`.

التطبيع:
- `taxNumber`/`commercialRegister` max 30، `phone` max 20، `email` max 80، `address` max 250، كلها trim.
- `logoInitials` → uppercase.
- `vatRate` يتقرب لرقمين عشريين.
- `baseCurrency` دايمًا `"EGP"` (يتجاهل اللي جاي).
- `pricesIncludeTax` / `allowNegativeStock` → bool.
- `defaultWarehouseId` الفاضي → `null` (يعني استخدم المخزن اللي عليه `isDefault`).

حفظ الترقيم: حدّث صفوف `NumberSequences` (prefix, nextNumber, digits) **في نفس الـ transaction** بتاعة الإعدادات. `UpdatedAt = now`، `UpdatedBy = اسم المستخدم الحالي`.

> **قاعدة أمان إضافية (هتتفعل في خطوة 13 و 15):** لما جداول المستندات/السندات تتعمل، امنع إن `nextNumber` + `prefix` يولدوا رقم موجود فعلًا (409 `الرقم التالي لـ {PREFIX} يتعارض مع مستند موجود`). اعمل الـ hook دلوقتي كـ interface `INumberCollisionChecker` بيرجع false.

## 4) خدمة مساعدة للموديولات التانية

```csharp
public interface ISystemSettingsProvider {
    Task<SystemSettingsDto> GetAsync(CancellationToken ct);   // مع cache في الذاكرة يتمسح بعد الـ PUT
    Task<decimal> VatRateAsync(CancellationToken ct);
    Task<bool> AllowNegativeStockAsync(CancellationToken ct);
    Task<int> LowStockThresholdAsync(CancellationToken ct);
}
```

## 5) الـ Seed

القيم اللي في مثال الـ JSON فوق + `inventory = { allowNegativeStock: false, lowStockThreshold: 5, defaultWarehouseId: null }`، `updatedBy = "أحمد حسن"`.

## 6) الاختبارات

- GET بأي مستخدم ← 200 والشكل كامل والترتيب صح.
- PUT من غير `Settings.Manage` ← 403.
- كل قاعدة في جدول التحقق ليها test.
- بعد PUT بتغيير `sale` إلى `prefix: "inv", nextNumber: 5000` ← `INumberSequenceService.NextAsync("doc:sale")` يرجع `INV-005000`.

## معايير القبول

- [ ] GET/PUT مطابقين للعقد.
- [ ] الترقيم مقروء ومكتوب من `NumberSequences` (مصدر واحد للحقيقة).
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (04 ✅).
