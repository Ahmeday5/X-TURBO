# الخطوة 12 — محرك القيود المحاسبية (Posting Engine)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي **مفيهاش Controller جديد** — هنبني القلب المحاسبي اللي المستندات (13–14) والسندات (15) هتستخدمه، ونوصّل الأرصدة الحقيقية في الحسابات ومراكز التكلفة والعملاء.

المبدأ: **أي حاجة مالية بتتسجل كقيد وقت الترحيل** (مش بتتحسب كل مرة). القيد ليه مصدر (`SourceId`)، ولو المصدر اتلغى القيد بيتعلم `IsVoided` ويختفي من كل الحسابات (بس يفضل موجود للمراجعة).

---

## 1) الجداول

```csharp
// سطر قيد في دفتر الأستاذ العام
GlEntry {
  long Id;                    // identity
  string AccountId;           // حساب فرعي (leaf) دايمًا
  DateOnly Date;
  decimal Debit; decimal Credit;   // واحد منهم بس > 0
  string? CostCenterId;
  string SourceType;          // document | voucher | opening
  string SourceId;            // id المستند / السند / الحساب (party) للافتتاحي
  string SourceKind;          // sale, purchase... أو receipt/payment/journal أو party-opening
  string Number;              // رقم المستند/السند أو كود العميل
  string Description;
  bool IsVoided;  DateTime? VoidedAt;
  DateTime CreatedAt;
}
// Indexes: (AccountId, Date) WHERE IsVoided=0 ، (SourceId) ، (CostCenterId, Date)

// سطر في كشف حساب عميل/مورد
PartyLedgerEntry {
  long Id;
  string PartyId;
  DateOnly Date;
  DateTime At;                // للترتيب داخل نفس اليوم
  decimal Debit; decimal Credit;
  string SourceType;          // document | voucher
  string SourceId; string SourceKind; string Number;
  string Description;
  bool IsVoided;
}
// Index: (PartyId, Date, At) WHERE IsVoided=0
```

**قاعدة ذهبية:** كل مجموعة قيود لمصدر واحد لازم Σdebit = Σcredit (بعد التقريب لرقمين). لو مش متزنة ← exception (bug) ومفيش حفظ.

## 2) الواجهة

```csharp
public interface IPostingEngine {
    Task PostDocumentAsync(Document doc, CancellationToken ct);      // خطوة 14 هتناديه عند الترحيل/الإتمام
    Task PostVoucherAsync(Voucher v, CancellationToken ct);          // خطوة 15
    Task VoidSourceAsync(string sourceId, CancellationToken ct);     // عند الإلغاء — يعلّم GL و Party entries
    Task SyncPartyOpeningAsync(Party party, CancellationToken ct);   // عند إنشاء/تعديل عميل
}
```
كله يشتغل **جوه الـ transaction بتاعة العملية الأصلية** (نفس `DbContext`، من غير `SaveChanges` منفصل).

## 3) قواعد الترحيل (Posting Rules)

تعريفات:
- `net = subtotal − discount` (قبل الضريبة)
- `cash` = حساب التسوية حسب طريقة الدفع:
  - `cash` + قناة `pos` ← خزينة نقطة البيع (`acc-1105` — في خطوة 20 هتبقى `PosSettings.CashAccountId`)
  - `cash` + قناة `erp` ← `acc-1101` الصندوق الرئيسي
  - `card` / `wallet` / `bank` ← `acc-1102` البنك
  - `credit` ← مفيش فلوس اتدفعت (paid = 0 غالبًا)
- `receivable(party)` = `acc-1103` العملاء، `payable(party)` = `acc-2101` الموردين. **لو** الحساب نوعه مايناسبش (مثلًا مورد في فاتورة بيع) استخدم الحساب التاني حسب `partyFits`.
- `cost` = Σ(qty × **تكلفة الصنف وقت الترحيل**). خزّن `UnitCost` على سطر المستند عند الترحيل (snapshot) عشان الإلغاء والتقارير يبقوا ثابتين.
- `cc` = مركز تكلفة المخزن (`Warehouse.CostCenterId`) — بيتحط على كل سطور قيود المستند.
- أي سطر قيمته 0 مايتكتبش.

| المستند | مدين | دائن |
|---|---|---|
| **sale** فاتورة بيع | cash ← `paid` · receivable ← `remaining` · COGS `5101` ← `cost` | Sales `4101` ← `net` · VAT `2201` ← `tax` · Inventory `1104` ← `cost` |
| **sale-return** مرتجع بيع | Sales Returns `4102` ← `net` · VAT ← `tax` · Inventory ← `cost` | cash ← `paid` · receivable ← `remaining` · COGS ← `cost` |
| **purchase** فاتورة شراء | Inventory ← `net` · VAT ← `tax` | cash ← `paid` · payable ← `remaining` |
| **purchase-return** مرتجع شراء | cash ← `paid` · payable ← `remaining` | Inventory ← `net` · VAT ← `tax` |
| **goods-issue** سند صرف | COGS ← `value` | Inventory ← `value` |
| **goods-receipt** سند استلام | Inventory ← `value` | لو السبب `opening` ← Retained Earnings `3102`، غير كده ← Other Income `4103` |
| transfer / voucher-transfer / reservation / quotation | — (مفيش قيد مالي) | — |

`value` لسندات الصرف/الاستلام = Σ(qty × price) — السعر هنا هو التكلفة.

### السندات (Vouchers)
| السند | مدين | دائن |
|---|---|---|
| **receipt** سند قبض | `cashAccountId` ← amount (بدون مركز تكلفة) | المقابل ← amount (بمركز تكلفة السند) |
| **payment** سند صرف | المقابل ← amount (بمركز تكلفة السند) | `cashAccountId` ← amount |
| **journal** سند قيد | كل سطر كما هو (account, debit, credit, costCenterId, note أو بيان السند) | |

المقابل: لو `counterpartyType = party` ← receivable (للقبض) / payable (للصرف) حسب `partyFits`. لو `account` ← `accountId`.

### الرصيد الافتتاحي للعميل/المورد
- `SyncPartyOpeningAsync`: علّم القيود القديمة (`SourceType=opening, SourceId=party.Id`) `IsVoided` واكتب جديدة لو `openingBalance ≠ 0`:
  - موجب (مدين) ← مدين `1103` / دائن `3102`
  - سالب (دائن) ← مدين `3102` / دائن `2101`
  - التاريخ = `0001-01-01` (ثابت `LedgerDates.Opening`)، الوصف `رصيد افتتاحي — {الاسم}`، الرقم = كود العميل.
- **مش** بيتكتب في `PartyLedgerEntry` (الرصيد الافتتاحي متخزن على الـ party نفسه، والكشف بيبدأ منه).
- اربطه في `PartiesService` (خطوة 09) عند الإنشاء والتعديل، ولكل العملاء في الـ seed.

## 4) قيود العملاء (PartyLedgerEntry)

بتتكتب لمستندات `sale`, `purchase`, `sale-return`, `purchase-return` اللي ليها `partyId`، وللسندات `receipt`/`payment` اللي `counterpartyType = party`:

| المصدر | الوصف | مدين | دائن |
|---|---|---|---|
| sale / purchase-return | `{الاسم المفرد}` + (` — {reference}` لو موجود) | total | 0 |
| purchase / sale-return | نفس الشكل | 0 | total |
| لو `paid > 0` — سطر تاني بعده (`At` = نفس الوقت + 1 tick) | sale/purchase-return: `تحصيل مع {المفرد}` · purchase/sale-return: `سداد مع {المفرد}` | purchase/sale-return: paid | sale/purchase-return: paid |
| receipt | `سند قبض` + (` — {description}`) | 0 | amount |
| payment | `سند صرف` + (` — {description}`) | amount | 0 |

الأسماء المفردة: sale=`فاتورة بيع`، purchase=`فاتورة شراء`، sale-return=`مرتجع بيع`، purchase-return=`مرتجع شراء`.

## 5) استبدال الـ Implementations المؤقتة

- `IAccountTotalsQuery` (خطوة 10): Σdebit/Σcredit لكل حساب من `GlEntry` (غير ملغية، و `Date ≤ asOf` لو مبعوت) — query واحد `GROUP BY AccountId`.
- `IAccountUsageChecker` (خطوة 10): الحساب عليه قيود = فيه `GlEntry` (حتى لو ملغي) **أو** مستخدم في سند (خطوة 15).
- `ICostCenterStatsQuery` (خطوة 11): للسنة الحالية — join مع نوع الحساب.
- `ICostCenterUsageChecker` (خطوة 11): فيه `GlEntry` بالمركز.
- `IPartyBalanceQuery` (خطوة 09): `balance = opening + Σ(debit − credit)`، `lastMovementAt = max(Date)` — query واحد مجمّع لكل القائمة (مش N+1).

## 6) أدوات تشخيص

- `ITrialBalanceService.GetAsync(DateOnly? asOf)` ← Σ مدين و Σ دائن لكل الحسابات + `IsBalanced`.
- Endpoint داخلي اختياري `GET /api/accounts/trial-balance` بصلاحية `Accounts.View` (الفرونت مش بيستخدمه، بس مفيد للمراجعة).

## 7) الاختبارات (unit + integration)

لكل نوع مستند وسند: ابني object، نادي المحرك، وتأكد من السطور والمبالغ بالظبط وإن القيد متزن. ومنها:
- فاتورة بيع آجلة جزئيًا (paid 300 من 1140 شامل 14% ضريبة).
- مرتجع بيع نقدي.
- سند استلام بسبب `opening` ← 3102، وبسبب `surplus` ← 4103.
- سند قبض من عميل ← party entry دائن.
- Void ← الرصيد يرجع زي ما كان.
- عميل برصيد افتتاحي −5000 ← قيد 3102/2101 وميزان المراجعة متزن.
- بعد الـ seed كله: `TrialBalance.IsBalanced == true`.

## معايير القبول

- [ ] الجدولين + `IPostingEngine` + كل الـ implementations الحقيقية.
- [ ] `GET /api/accounts` بقى بيرجع أرصدة من القيود، و `GET /api/parties` بقى بيرجع `balance` حقيقي.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (12 ✅).
