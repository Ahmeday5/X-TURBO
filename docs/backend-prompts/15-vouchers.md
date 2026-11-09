# الخطوة 15 — السندات المالية: `VouchersController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **VouchersController** (قبض / صرف / قيد) مع الترحيل عن طريق `IPostingEngine` (خطوة 12).

- **receipt — سند قبض**: فلوس داخلة لخزينة/بنك، من عميل/مورد أو من حساب (إيراد…).
- **payment — سند صرف**: فلوس خارجة من خزينة/بنك، لعميل/مورد أو لحساب (مصروف…).
- **journal — سند قيد**: سطور مدين/دائن حرة؛ لازم Σمدين = Σدائن.

Route: `api/vouchers` — `[HasPermission("Vouchers.View")]`.

---

## 1) الـ Entities

```csharp
Voucher {
  string Id; string Kind;          // receipt | payment | journal
  string Number;                   // RV-000123 / PV-… / JV-… — NumberSequences "voucher:{kind}"
  DateOnly Date;
  string Status;                   // draft | posted | cancelled
  string Description; string Reference;
  // receipt / payment
  string? CounterpartyType;        // party | account
  string? PartyId; string? PartyName;
  string? AccountId; string? AccountName;
  string? CashAccountId; string? CashAccountName;
  string? Method;                  // cash | bank | card | cheque | wallet
  decimal Amount;
  string? CostCenterId; string? CostCenterName;
  // journal
  List<VoucherLine> Lines;
  decimal TotalDebit; decimal TotalCredit;
  string CreatedBy; DateTime CreatedAt; DateTime? PostedAt;
  string SearchText;   // number + description + reference + partyName + accountName + cashAccountName + createdBy
}
VoucherLine { long Id; string VoucherId; int LineNo; string AccountId; string AccountCode; string AccountName;
              decimal Debit; decimal Credit; string? CostCenterId; string? CostCenterName; string Note; }
```

## 2) الـ DTOs

```csharp
VoucherDto: id, kind, number, date, status, description, reference,
            counterpartyType, partyId, partyName, accountId, accountName,
            cashAccountId, cashAccountName, method, amount, costCenterId, costCenterName,
            lines: JournalLineDto[], totalDebit, totalCredit, createdBy, createdAt, postedAt
JournalLineDto(accountId, accountCode, accountName, debit, credit, costCenterId, costCenterName, note)
VoucherSummaryDto = VoucherDto من غير lines + int linesCount
VoucherStatsDto(int Count, int Draft, int Posted, int Cancelled, decimal Total, decimal ThisMonth)
```

Payload:
```json
{
  "kind": "payment", "date": "2026-11-09", "description": "إيجار شهر نوفمبر", "reference": "",
  "counterpartyType": "account", "partyId": null, "accountId": "acc-5202",
  "cashAccountId": "acc-1102", "method": "bank", "amount": 42000, "costCenterId": "cc-2",
  "lines": [],
  "post": true
}
```

## 3) بناء السند (التحقق) — مشترك للإنشاء والتعديل

مساعد `leafAccount(id, what)`: مش موجود ← 404 `{what} غير موجود`؛ تجميعي ← 422 `«{name}» حساب تجميعي — اختر حسابًا فرعيًا`؛ موقوف ← 422 `الحساب «{name}» موقوف`.
مساعد `centerOf(id)`: لو مبعوت ومش موجود ← 404 `مركز التكلفة غير موجود`.

### journal
1. السطور اللي ليها `accountId` و (debit > 0 أو credit > 0) بس هي اللي تتحسب (الفاضية تتشال).
2. لكل سطر (i من 1): `leafAccount(accountId, "الحساب")`؛ debit و credit الاتنين > 0 ← 422 `السطر {i}: أدخل مدينًا أو دائنًا وليس الاثنين`؛ الحساب `costCenterRequired` ومفيش مركز ← 422 `الحساب «{name}» يتطلب مركز تكلفة`. (المبالغ `round2(max(0,x))`، `note` trim.)
3. أقل من سطرين ← 422 `القيد يحتاج إلى سطرين على الأقل`.
4. `totalDebit ≠ totalCredit` ← 422 `القيد غير متزن: المدين {totalDebit} والدائن {totalCredit}`.
5. `description` فاضي ← 422 `اكتب بيان القيد`.
6. `amount = totalDebit`، وكل حقول القبض/الصرف = null.

### receipt / payment
1. `amount = round2(amount)`، ≤ 0 ← 422 `المبلغ يجب أن يكون أكبر من صفر`.
2. `cashAccountId` مش واحد من `SystemAccounts.CashAccounts` (`acc-1101`, `acc-1102`, `acc-1105`) ← 422 `اختر الخزينة أو البنك`، وبعدين `leafAccount(cashAccountId, "الخزينة")`.
3. `counterpartyType`:
   - `party` ← الطرف لازم يكون موجود: 404 `الحساب غير موجود`.
   - `account` ← `leafAccount(accountId, "الحساب")`؛ لو هو نفس الخزينة ← 422 `لا يمكن أن يكون الحساب المقابل هو نفس الخزينة`.
   - غير كده ← 422 `حدد الجهة المقبوض منها` (قبض) / `حدد الجهة المصروف إليها` (صرف).
4. `centerOf(costCenterId)`. لو الحساب المقابل `costCenterRequired` ومفيش مركز ← 422 `الحساب «{name}» يتطلب مركز تكلفة`.
5. `method` الافتراضي `cash`. `totalDebit = totalCredit = amount`، `lines = []`.

عام: `date` الفاضي ← النهارده، `description`/`reference` trim، الأسماء (party/account/cash/costCenter) snapshot.

## 4) الـ Endpoints

### 4.1 `GET /api/vouchers?kind=receipt&...` — paged
- Search: `number`, `description`, `reference`, `partyName`, `accountName`, `cashAccountName`, `createdBy`.
- فلاتر: `kind`, `status`, `partyId`, `cashAccountId`, `method`, `costCenterId`, `from`/`to` (على `date` شاملين).
- sortBy: `number`, `date`, `amount`, `partyName`, `accountName`, `status`, `createdAt`. **الافتراضي `date desc`** ثم `createdAt desc`.

### 4.2 `GET /api/vouchers/stats?kind=…` — نفس الفلاتر **ما عدا `status`**
- `count/draft/posted/cancelled` على الكل.
- `total` = Σ amount للسندات غير الملغية. `thisMonth` = نفس الحاجة للشهر الحالي (`date` في نفس السنة والشهر).

### 4.3 `GET /api/vouchers/{id}` ← `VoucherDto` أو 404 `السند غير موجود`.

### 4.4 `POST /api/vouchers` ← 201
- `kind` مش معروف ← 422 `نوع السند غير معروف`.
- يبني ويتحقق، رقم من `voucher:{kind}`، الحالة `draft`، أو لو `post: true` ← `posted` + `postedAt` + `IPostingEngine.PostVoucherAsync` في نفس الـ transaction.

### 4.5 `PUT /api/vouchers/{id}` — مسودات بس
- مش مسودة ← 409 `لا يمكن تعديل سند مُرحّل`.
- `kind` مختلف ← 422 `لا يمكن تغيير نوع السند`.
- `post: true` ← يرحّل بعد الحفظ.

### 4.6 `DELETE /api/vouchers/{id}` — مسودات بس
- مش مسودة ← 409 `يمكن حذف المسودات فقط — ألغِ السند بدلًا من ذلك`.

### 4.7 `POST /api/vouchers/{id}/post` — Body `{}`
- مش مسودة ← 409 `السند مُرحّل بالفعل`. ← `posted`، `postedAt`، القيود.

### 4.8 `POST /api/vouchers/{id}/cancel` — Body `{ "reason": "…" }`
- ملغي بالفعل ← 409 `السند ملغي بالفعل`.
- لو كان مرحّل ← `VoidSourceAsync(id)`.
- `status = cancelled`. لو فيه سبب: `description = "{description} — سبب الإلغاء: {reason}"` (أو من غير الشرطة لو الوصف فاضي).

## 5) تحديثات على أجزاء سابقة
- `IPartyUsageChecker` يشوف السندات. `IAccountUsageChecker` يشوف `AccountId` و سطور القيد. `INumberCollisionChecker` يشوف أرقام السندات.
- `PartiesService` يحدّث `PartyName` في السندات عند تغيير الاسم.

## 6) الـ Seed التاريخي (Development) — بعد seed المستندات
- **تحصيلات**: لكل فاتورة بيع آجلة مرحّلة فيها باقي، 85% احتمال سند قبض من العميل بعد (`paymentTermDays − 5 + 0..15`، أقل حاجة 5 أيام) بالباقي كله (70%) أو نصه، بنكي (45%، `reference = "TRX-######"`) أو نقدي. الوصف `سداد {رقم}` أو `دفعة من {رقم}`. (التاريخ لو في المستقبل — تجاهل.)
- **سداد موردين**: لكل فاتورة شراء فيها باقي، 75% سند صرف للمورد بعد 25–50 يوم من البنك (30% شيك `CHQ-#####`). الوصف `سداد فاتورة {reference أو الرقم}`.
- **مصروفات شهرية لآخر 5 شهور**: إيجار (`acc-5202`) يوم 3 للمراكز cc-2..cc-6 بمبالغ 42000/26000/22000/18000/35000؛ رواتب (`acc-5201`) يوم 26 لكل المراكز cc-1..cc-6 (18000–44000)؛ دعاية (`acc-5205`) يوم 12 لـ cc-7 (15000–40000، بطاقة)؛ شحن (`acc-5204`) أيام 7/14/21/28 لـ cc-8 (2500–6500، نقدي).
- **قيود شهرية**: استحقاق كهرباء (مدين 5203 cc-2 / دائن 2102)، مصروفات بنكية (مدين 5207 / دائن 1102)، توريد نقدية الصندوق للبنك (مدين 1102 / دائن 1101)، توريد نقدية نقطة البيع للبنك (مدين 1102 / دائن 1105).
- مسودة واحدة النهارده: سند قبض من حساب `acc-4103` بـ 1500 نقدي «بيع كراتين وخردة».
- في الآخر الميزان متزن.

## 7) الاختبارات
- كل قاعدة تحقق.
- قيد غير متزن ← 422 بالأرقام.
- سند قبض من عميل مرحّل ← رصيد العميل قل، و `GET /accounts` الخزينة زادت.
- cancel سند مرحّل ← الأرصدة رجعت.
- stats بتتجاهل `status`.

## معايير القبول
- [ ] 8 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (15 ✅).
