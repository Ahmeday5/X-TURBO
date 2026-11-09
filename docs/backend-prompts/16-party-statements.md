# الخطوة 16 — كشوف الحساب والأرصدة: `PartiesController` (الجزء 2)

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **4 endpoints تقارير** تتضاف لنفس `PartiesController` (خطوة 09)، مبنية على `PartyLedgerEntry` (خطوة 12).

الصلاحية: `[HasPermission("Customers.View")]`.

> ⚠️ ترتيب الـ routes: `parties/balances` و `parties/balances/summary` لازم مايتفهموش كـ `parties/{id}` — ASP.NET بيفضّل الـ literal، بس اكتب test.

---

## 1) الـ DTOs

```csharp
public sealed record StatementEntryDto(
    string SourceId,
    string SourceType,      // document | voucher | opening
    string SourceKind,      // نوع المستند أو السند
    string Number,
    DateOnly Date,
    string Description,
    decimal Debit, decimal Credit,
    decimal Balance);       // الرصيد الجاري بعد السطر ده

public sealed record StatementLineDto(string Code, string Name, string Unit, decimal Qty, decimal Price, decimal Total);

public sealed record DetailedStatementEntryDto(... نفس حقول StatementEntryDto ..., IReadOnlyList<StatementLineDto> Lines);

public sealed record PartyStatementDto<TEntry>(
    PartyOption Party,       // من خطوة 09 (فيه balance الحالي)
    string From,             // "" لو من البداية
    string To,               // "YYYY-MM-DD"
    decimal OpeningBalance,  // الرصيد قبل From
    decimal TotalDebit, decimal TotalCredit,
    decimal ClosingBalance,  // opening + debit − credit
    IReadOnlyList<TEntry> Entries);

public sealed record PartyBalanceRowDto(
    string Id, string Code, string Name, string Kind, string Phone,
    decimal CreditLimit,
    decimal TotalDebit,      // يشمل الجزء المدين من الرصيد الافتتاحي
    decimal TotalCredit,     // يشمل الجزء الدائن من الرصيد الافتتاحي
    decimal Balance,
    bool OverLimit,          // creditLimit > 0 && balance > creditLimit
    DateOnly? LastMovementAt);

public sealed record PartyBalancesSummaryDto(int Count, decimal Receivable, decimal Payable, decimal Net, int OverLimitCount);
```

## 2) الـ Endpoints

### 2.1 `GET /api/parties/{id}/statement?from=&to=`
- الطرف مش موجود ← 404 `الحساب غير موجود`.
- `from` الفاضي = من البداية. `to` الفاضي = النهارده. `from > to` ← 422 `تاريخ البداية بعد تاريخ النهاية`.
- المصدر: `PartyLedgerEntry` غير الملغية للطرف، مرتبة بـ `Date` ثم `At`.
- `openingBalance = party.OpeningBalance + Σ(debit − credit)` للسطور اللي `Date < from` (لو from موجود)، مقرّب لرقمين.
- `entries` = السطور اللي `from ≤ Date ≤ to`، ولكل سطر `balance` جاري يبدأ من `openingBalance`.
- `totalDebit/totalCredit` = مجموع سطور الفترة. `closingBalance = round2(opening + debit − credit)`.
- `entries[]` من غير `lines`.

### 2.2 `GET /api/parties/{id}/statement/detailed?from=&to=`
- نفس الحسبة بالظبط، بس كل سطر مصدره مستند بيرجع معاه `lines` = سطور المستند (`code, name, unit, qty, price, total`). سطور التحصيل/السداد مع الفاتورة والسندات ← `lines = []`.
- اعمل الـ query بحيث السطور تتجاب في استعلام واحد (مش N+1).

### 2.3 `GET /api/parties/balances?asOf=` — paged
- `asOf` الفاضي = النهارده. الأرصدة محسوبة لحد التاريخ ده (شامل).
- الصفوف: كل الأطراف اللي `CreatedAt.Date ≤ asOf` **أو** ليها حركة لحد `asOf`.
- لكل طرف: `debit = max(opening,0) + Σdebit`، `credit = max(−opening,0) + Σcredit`، `balance = opening + Σdebit − Σcredit`، `lastMovementAt = آخر Date`.
- Search: `name`, `code`, `phone`.
- فلاتر:
  - `kind` (زي القائمة: `customer`/`supplier` بـ `partyFits`، `both` مساواة).
  - `side`: `debit` | `credit` | `zero`.
  - `overLimit`: أي قيمة ← `overLimit = true` بس.
  - `hideZero`: أي قيمة ← `balance ≠ 0` بس.
- sortBy: `code`, `name`, `kind`, `totalDebit`, `totalCredit`, `balance`, `creditLimit`, `lastMovementAt`. **الافتراضي `balance desc`**.
- الأداء: aggregate واحد `GROUP BY PartyId` على `PartyLedgerEntry WHERE Date ≤ asOf AND IsVoided = 0`، و join مع الأطراف، وبعدين الفلترة والـ paging في SQL.

### 2.4 `GET /api/parties/balances/summary?asOf=`
نفس البحث والفلاتر (من غير paging):
- `count` = عدد الصفوف.
- `receivable` = Σ الأرصدة الموجبة. `payable` = Σ |الأرصدة السالبة|. `net = receivable − payable`.
- `overLimitCount`.

## 3) الاختبارات

- عميل برصيد افتتاحي 1000 + فاتورة بيع 5000 (دفع 2000) + سند قبض 1000:
  - الكشف من البداية: 3 سطور (فاتورة مدين 5000، تحصيل دائن 2000، سند دائن 1000)، `opening = 1000`، `closing = 3000`.
  - الكشف من تاريخ بعد الفاتورة: `opening = 4000`، سطر واحد.
- الكشف التفصيلي فيه سطور الفاتورة.
- مستند ملغي مايظهرش في الكشف.
- `balances?asOf=` تاريخ قديم ← الرصيد وقتها.
- `summary` = مجموع صفوف `balances` بنفس الفلاتر.
- `from > to` ← 422.

## معايير القبول

- [ ] 4 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (16 ✅).
