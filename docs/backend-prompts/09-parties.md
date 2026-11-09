# الخطوة 09 — العملاء والموردين: `PartiesController` (الجزء 1 — CRUD)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **CRUD + lookup** بس. كشوف الحساب والأرصدة في خطوة 16 (بعد محرك القيود).

"Party" = عميل أو مورد أو الاتنين. **اصطلاح الرصيد في كل النظام:** `balance = مدين − دائن`
- `> 0` ← **مدين** (هو مديون لنا — الطبيعي للعميل)
- `< 0` ← **دائن** (إحنا مديونين له — الطبيعي للمورد)

Route: `api/parties`
- CRUD + list: `[HasPermission("Customers.View")]`
- `lookup`: `[HasAnyPermission("Customers.View","Invoices.View","Pos.Access","Vouchers.View")]`

---

## 1) الـ Entity

```csharp
Party {
  string Id;
  string Code;               // CU-00012 (customer/both) أو SU-00012 (supplier)
  string Kind;               // customer | supplier | both
  string Name;               // ≥ 2 حروف, max 150
  string Phone;              // موبايل مصري، unique لو مش فاضي (filtered index)
  string Phone2; string Email; string City; string Address;
  string TaxNumber; string CommercialRegister;
  decimal CreditLimit;       // 0 = بلا حد
  int PaymentTermDays;       // أيام السداد للآجل
  string PriceList;          // retail | wholesale
  decimal OpeningBalance;    // بإشارة (نفس اصطلاح balance)
  string Notes;
  bool IsActive;
  bool IsExternal;           // عميل سريع اتسجل من نقطة البيع
  DateTime CreatedAt;
  string SearchText;         // name + code + phone + phone2 + email + city + taxNumber
}
```

## 2) الـ DTOs

```csharp
public sealed record PartyDto(
    string Id, string Code, string Kind, string Name,
    string Phone, string Phone2, string Email, string City, string Address,
    string TaxNumber, string CommercialRegister,
    decimal CreditLimit, int PaymentTermDays, string PriceList,
    decimal OpeningBalance, string Notes, bool IsActive, bool IsExternal, DateTime CreatedAt,
    // ── محسوبة ──
    decimal Balance,             // opening + حركات مرحلة (خطوة 12/16) — دلوقتي = OpeningBalance
    DateOnly? LastMovementAt);   // تاريخ آخر حركة — دلوقتي null

public sealed record PartyPayload(
    string Kind, string Name, string Phone, string Phone2, string Email, string City, string Address,
    string TaxNumber, string CommercialRegister, decimal CreditLimit, int PaymentTermDays,
    string PriceList, decimal OpeningBalance, string Notes, bool IsActive, bool IsExternal);

public sealed record PartyOption(string Id, string Code, string Name, string Kind, string Phone, decimal Balance, decimal CreditLimit);
```

> `Balance` و `LastMovementAt` هيتحسبوا من جدول قيود العملاء اللي هيتعمل في خطوة 12. اكتب الـ query دلوقتي من خلال interface `IPartyBalanceQuery` (implementation مؤقت = opening balance) وخطوة 12 هتبدله.

## 3) قاعدة "الدور"

`partyFits(kind, role)` = `kind == "both" || kind == role`. حطها في الـ Domain — هتتستخدم في الفواتير والسندات.

## 4) الـ Endpoints

### 4.1 `GET /api/parties` — paged
- Search: `name`, `code`, `phone`, `phone2`, `email`, `city`, `taxNumber`.
- فلاتر:
  - `kind`: لو `customer` أو `supplier` ← بـ `partyFits` (يعني `both` يظهر في الاتنين). لو `both` ← مساواة.
  - `status`: `active` | `inactive`.
  - `external`: `1` ← `isExternal = true`، أي قيمة تانية ← `false`.
  - `balance`: `debit` (> 0) | `credit` (< 0) | `zero` (= 0).
- sortBy: `code`, `name`, `kind`, `city`, `balance`, `creditLimit`, `lastMovementAt`, `createdAt`. الافتراضي `createdAt desc`.

### 4.2 `GET /api/parties/lookup?role=customer|supplier`
- Array `PartyOption` للنشطين فقط، ولو `role` مبعوت ← `partyFits`. مرتبة بالاسم.

### 4.3 `GET /api/parties/{id}` ← `PartyDto` أو 404 `الحساب غير موجود`.

### 4.4 `POST /api/parties` ← 201
- الكود: لو `kind = supplier` ← sequence `supplier` (SU) غير كده `customer` (CU).

### 4.5 `PUT /api/parties/{id}`
- **الكود مايتغيرش** حتى لو النوع اتغير.

### 4.6 `DELETE /api/parties/{id}`

## 5) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي أو أقل من حرفين | 422 | `الاسم مطلوب` |
| `kind` مش من التلاتة | 422 | `النوع غير صحيح` |
| `phone` (بعد شيل المسافات) مش مطابق `^01[0125]\d{8}$` | 422 | `رقم الموبايل غير صحيح` |
| `phone` مستخدم لحساب تاني | 409 | `رقم الموبايل مسجل لحساب آخر` |
| update: عليه حركات والنوع اتغير لحاجة غير `both` | 409 | `لا يمكن تغيير النوع لحساب عليه حركات — يمكنك جعله «عميل ومورد»` |
| update: عليه حركات و `openingBalance` اتغير | 409 | `لا يمكن تعديل الرصيد الافتتاحي لحساب عليه حركات — استخدم سند قيد للتسوية` |
| delete: عليه حركات | 409 | `لا يمكن حذف حساب عليه حركات — أوقفه بدلًا من ذلك` |

"عليه حركات" = ظاهر في أي مستند أو سند (خطوات 13 و 15) — `IPartyUsageChecker` مؤقت بيرجع false.

التطبيع:
- `phone`/`phone2`: شيل كل المسافات.
- باقي النصوص trim.
- `creditLimit = max(0, x)`، `paymentTermDays = max(0, round(x))`، `openingBalance = round2(x)`.
- `priceList`: لو `wholesale` تفضل، أي حاجة تانية ← `retail`.
- `isExternal`: bool.

لما الاسم يتغير: المستندات والسندات اللي فيها `partyName` متخزن (خطوات 13/15) لازم تتحدث — **أو** ماتخزنش الاسم واعمل join. القرار: خزّن الاسم في المستند كـ snapshot **وحدّثه** عند تعديل الحساب (زي سلوك الفرونت الحالي). سجّل ده في `PROGRESS.md` عشان خطوة 13.

## 6) الـ Seed (Development)

- **16 عميل قطاعي** (retail، بدون حد ائتمان): محمد عبد الله، سارة محمود، أحمد سمير، منى إبراهيم، كريم حسن، هبة علي، يوسف طارق، دينا فؤاد، عمر خالد، نورهان مصطفى، إسلام رمضان، ريهام عادل، مصطفى شريف، آية حمدي (موقوف)، حسام الدين نبيل، شيماء أشرف. كل خامس واحد عنده رصيد افتتاحي مدين صغير.
- **12 ورشة/شركة جملة** (wholesale، `creditLimit` من [150000, 250000, 100000, 400000]، `paymentTermDays` من [15, 30, 45]، رقم ضريبي وسجل وإيميل `info{n}@workshop.eg`، رصيد افتتاحي مدين): مركز الأمل لصيانة السيارات، ورشة النصر للميكانيكا، مركز سبيد سيرفيس، ورشة الحرية للكهرباء، **توكيل الشروق للسيارات (kind = both)**، مركز كار كير، ورشة الأخوين، شركة النيل للنقل، مركز الفارس لصيانة السيارات، شركة المستقبل لتأجير السيارات، ورشة الدلتا للعفشة، مركز الصفوة أوتو.
- **12 مورد** (wholesale، `paymentTermDays` من [30, 60, 45]، رصيد افتتاحي **دائن** سالب): الشركة المصرية لقطع الغيار، مؤسسة الخليج للتجارة، بوش مصر — الوكيل المعتمد، دينسو الشرق الأوسط، المتحدة لاستيراد قطع الغيار، شركة الأهرام للزيوت، النجم للإطارات، مصنع العربي للبطاريات، الدولية لقطع غيار السيارات الكورية، مؤسسة طيبة التجارية، شركة فالكون للإكسسوارات، الوطنية للفلاتر (موقوف).
- **4 عملاء نقطة بيع** (`isExternal = true`): عميل نقدي — طارق، عميل نقدي — مروة، عميل نقدي — باسم، عميل نقدي — هالة.
- المدن: القاهرة، الجيزة، الإسكندرية، المنصورة، طنطا، الزقازيق، 6 أكتوبر، بورسعيد. موبايلات صحيحة وفريدة.

## 7) الاختبارات

- CRUD + كل فلتر (خصوصًا `kind=customer` بيرجع `both`).
- lookup بـ role.
- موبايل غلط ← 422، مكرر ← 409.
- إنشاء مورد ← كود يبدأ `SU-`، عميل ← `CU-`.

## معايير القبول

- [ ] 6 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (09 ✅).
