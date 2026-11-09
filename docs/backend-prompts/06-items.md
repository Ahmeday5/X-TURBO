# الخطوة 06 — الأصناف: `ItemsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **ItemsController بس** (`items` و `items/{id}`). الـ endpoint `items/lookup` **مش هنا** — هيتعمل في خطوة 08 في `StockController`.

Route: `api/items` — `[HasPermission("Items.View")]`.

---

## 1) الـ Entity

```csharp
Item {
  string Id;
  string Code;            // IT-00042 — NumberSequences key "item" (Prefix IT, Digits 5)
  string Name;            // max 200
  string GroupId;         // FK → ItemGroup (Restrict delete)
  string Unit;            // واحدة من: قطعة | طقم | لتر | علبة | كرتونة | متر | زوج
  string Barcode;         // "" مسموح، لو مش فاضي → unique (filtered unique index WHERE Barcode <> '')
  string Brand;           // max 60
  decimal PurchasePrice;  // ≥ 0 — هو كمان "التكلفة" المستخدمة في تقييم المخزون
  decimal SalePrice;      // ≥ 0
  int MinStock;           // حد إعادة الطلب ≥ 0
  string Description;     // max 1000
  bool IsActive;
  DateTime CreatedAt;
  string SearchText;      // name + code + barcode + brand + groupName
}
```

> `Stock` **مش عمود** — هو مجموع أرصدة الصنف في كل المخازن (جدول `StockBalances` هيتعمل في خطوة 08). دلوقتي رجّعه `0`، وفي خطوة 08 هيتحسب `SUM(qty)`.

## 2) الـ DTOs

```csharp
public sealed record ItemDto(
    string Id, string Code, string Name,
    string GroupId, string GroupName, string GroupColor,   // join مع المجموعة
    string Unit, string Barcode, string Brand,
    decimal PurchasePrice, decimal SalePrice,
    int MinStock,
    decimal Stock,            // مجموع الرصيد في كل المخازن
    string Description, bool IsActive, DateTime CreatedAt);

public sealed record ItemPayload(
    string Name, string GroupId, string Unit, string Barcode, string Brand,
    decimal PurchasePrice, decimal SalePrice, int MinStock, string Description, bool IsActive);
```

## 3) مستوى المخزون (`stock level`) — هيتستخدم في أكتر من مكان

```
if stock <= 0           → "out"   (نفد)
else if stock <= minStock → "low" (منخفض)
else                     → "ok"   (متوفر)
```
حطها في الـ Domain: `StockLevel.Of(decimal qty, decimal min)`.

## 4) الـ Endpoints

### 4.1 `GET /api/items` — paged
- Search: `name`, `code`, `barcode`, `brand`, `groupName`.
- فلاتر:
  - `groupId` — مساواة.
  - `status` — `active` | `inactive`.
  - `stock` — `out` | `low` | `ok` (حسب القاعدة فوق على الرصيد الإجمالي).
- sortBy: `code`, `name`, `groupName`, `salePrice`, `purchasePrice`, `stock`, `minStock`, `isActive`, `createdAt`. الافتراضي `createdAt desc`.
- خلي بالك من الأداء: الـ `stock` محسوب، فاعمل الـ query كـ projection واحد فيه subquery `SUM` (مش N+1).

### 4.2 `GET /api/items/{id}` ← `ItemDto` أو 404 `العنصر غير موجود`.

### 4.3 `POST /api/items` ← 201
- `Code` يتولد، `Stock = 0`، `CreatedAt = now`.
- **الرصيد الافتتاحي ميتحطش هنا** — بيدخل بسند استلام بضاعة سببه "رصيد افتتاحي" (خطوة 13).

### 4.4 `PUT /api/items/{id}` ← `ItemDto`
- الكود والرصيد ميتغيروش من هنا.

### 4.5 `DELETE /api/items/{id}` ← `data: null`

## 5) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي | 422 | `اسم الصنف مطلوب` |
| `groupId` مش موجود | 404 | `العنصر غير موجود` |
| `unit` مش من القائمة | 422 | `الوحدة غير صحيحة` |
| `purchasePrice` أو `salePrice` سالب | 422 | `الأسعار لا يمكن أن تكون سالبة` |
| `minStock` سالب | 422 | `حد إعادة الطلب لا يمكن أن يكون سالبًا` |
| `barcode` (بعد trim) مستخدم لصنف تاني | 409 | `الباركود مستخدم لصنف آخر` |
| delete وفيه رصيد أو حجز في أي مخزن | 409 | `لا يمكن حذف صنف له رصيد — أوقفه بدلًا من ذلك` |
| delete وظاهر في أي مستند أو طلب | 409 | `لا يمكن حذف صنف عليه حركات — أوقفه بدلًا من ذلك` |

> الشرطين الأخيرين بيعتمدوا على جداول هتتعمل بعدين (08، 13، 21). اعمل `IItemUsageChecker` بـ implementation بيرجع false دلوقتي، وكل خطوة تضيف جدول تحدّثه. سجّل ده في `PROGRESS.md`.

- `name`, `barcode`, `brand`, `description` → trim.
- `groupName`/`groupColor` في الرد دايمًا من المجموعة الحالية (join).

## 6) الـ Seed (Development) — بيانات واقعية

لكل مجموعة من خطوة 05 أضف أصناف بالشكل `"{القطعة} — {السيارة}"` (حوالي 80–120 صنف):

| المجموعة | القطع |
|---|---|
| الفرامل | تيل فرامل أمامي، تيل فرامل خلفي، طنبورة فرامل، أسطوانة فرامل |
| الفلاتر | فلتر زيت، فلتر هواء، فلتر بنزين، فلتر تكييف |
| الإشعال | بوجيه إيريديوم، موبينة، طقم أسلاك بوجيهات |
| المحرك | طقم سير كاتينة، جوان وش سلندر، طرمبة مياه، سير دينامو |
| العفشة | مساعد أمامي، مساعد خلفي، مقص سفلي، بلية عجل |
| الكهرباء | بطارية 70 أمبير، دينامو، مارش، حساس أكسجين |
| الزيوت | زيت محرك 5W-30، زيت فتيس أوتوماتيك، زيت فرامل DOT4 |
| التكييف | كمبروسر تكييف، رادياتير تكييف، مروحة تكييف |
| الإضاءة | فانوس أمامي، فانوس خلفي، لمبة LED H4 |
| الهيكل | صدام أمامي، مراية جانبية، كبوت |
| الإطارات | كاوتش 195/65R15، جنط ألمونيوم 15 |
| الإكسسوارات | طقم دواسات، فرش كراسي، شاشة أندرويد |

- السيارات: تويوتا كورولا، هيونداي إلنترا، كيا سيراتو، نيسان صني، شيفروليه لانوس، ميتسوبيشي لانسر، سكودا أوكتافيا، رينو لوجان.
- الماركات: بوش، دينسو، NGK، فاليو، مان، أصلي، TRW، KYB.
- الوحدة: `طقم` لو الاسم فيه "طقم"، `لتر` لو فيه "زيت"، غير كده `قطعة`.
- سعر الشراء 90–4300 (مضاعفات 5)، البيع = الشراء × 1.18–1.53، `minStock` 5–35، باركود 13 رقم يبدأ `6221`، 7% غير نشط.
- استخدم `Random` بـ seed ثابت عشان الداتا تبقى ثابتة.

## 7) الاختبارات

- CRUD + كل فلتر + البحث بالباركود والماركة واسم المجموعة.
- باركود مكرر ← 409، باركود فاضي في صنفين ← مسموح.
- sortBy بقيمة مش معروفة ← يتجاهل (مش 500).
- بعد تغيير اسم المجموعة: `GET /items?search={الاسم الجديد}` يلاقي أصنافها.

## معايير القبول

- [ ] 5 endpoints مطابقة للعقد، و `stock` بيرجع رقم (0 لحد خطوة 08).
- [ ] تأكد إن `itemsCount` في المجموعات (خطوة 05) بقى شغال صح.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (06 ✅).
