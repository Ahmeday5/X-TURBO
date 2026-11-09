# الخطوة 19 — العملات وأسعار الصرف: `CurrenciesController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **CurrenciesController بس**.

العملة الأساسية **EGP** وسعرها دايمًا 1. باقي العملات: سعر الجنيه مقابل وحدة واحدة.

Route: `api/currencies` — `[HasPermission("Accounts.View")]`.

---

## 1) الـ Entities

```csharp
Currency {
  string Id;           // "cur-{code lowercase}" مثال cur-usd
  string Code;         // ISO-4217، 3 حروف كبيرة، unique
  string Name; string Symbol;
  bool IsBase; bool IsActive;
  DateTime UpdatedAt; string UpdatedBy;
}
CurrencyRate { long Id; string CurrencyId; decimal Rate /*18,4*/; DateTime At; string By; }   // التاريخ — آخر 12 تكفي للعرض
```

## 2) الـ DTOs

```csharp
public sealed record CurrencyDto(
    string Id, string Code, string Name, string Symbol,
    decimal Rate,           // آخر سعر
    decimal PreviousRate,   // السعر اللي قبله (أو نفس السعر لو مفيش)
    decimal ChangePct,      // round((rate − prev) / prev × 100, 2)، أو 0
    IReadOnlyList<decimal> History,   // آخر 12 سعر، الأقدم الأول والأخير = الحالي
    bool IsBase, bool IsActive, DateTime UpdatedAt, string UpdatedBy);

public sealed record CurrencyPayload(string Code, string Name, string Symbol, decimal Rate, bool IsActive);
```

## 3) الـ Endpoints

### 3.1 `GET /api/currencies` ← **Array** (مش paged)، الأساسية الأول وبعدين بالكود.
### 3.2 `POST /api/currencies` ← 201
- `Id = "cur-" + code.ToLower()`، `IsBase = false`، أول سعر في التاريخ = `rate`، `UpdatedAt/By`.
### 3.3 `PUT /api/currencies/{id}`
- الأساسية: لو `rate ≠ 1` أو الكود اتغير أو `isActive = false` ← 409 `العملة الأساسية ثابتة — سعرها 1 ولا يمكن إيقافها`.
- غير الأساسية: لو `rate` مختلف عن آخر سعر ← أضف سعر جديد للتاريخ و `UpdatedAt/By = now/اسم المستخدم`. (تغيير الاسم أو الرمز بس مايضيفش سعر.)
### 3.4 `DELETE /api/currencies/{id}`
- الأساسية ← 409 `لا يمكن حذف العملة الأساسية`.
- مستخدمة في أي حساب (`Account.Currency == code`) ← 409 `العملة مستخدمة في حسابات — أوقفها بدلًا من ذلك`.

## 4) التحقق (create + update)

| الحالة | الكود | الرسالة |
|---|---|---|
| الكود بعد trim+uppercase مش `^[A-Z]{3}$` | 422 | `رمز العملة 3 حروف لاتينية (مثل USD)` |
| الكود موجود لعملة تانية | 409 | `العملة مضافة بالفعل` |
| `name` فاضي | 422 | `اسم العملة مطلوب` |
| `rate` (مقرّب 4 أرقام) ≤ 0 | 422 | `سعر الصرف يجب أن يكون أكبر من صفر` |
| مش موجودة | 404 | `العملة غير موجود` ← `NotFoundException("العملة")` |

- `symbol` الفاضي ← نفس الكود.

## 5) الـ Seed — **كل البيئات** (EGP بس في Production، والباقي Development)

| Code | الاسم | الرمز | السعر |
|---|---|---|---|
| EGP | جنيه مصري | ج.م | 1 (أساسية) |
| USD | دولار أمريكي | $ | 48.62 |
| EUR | يورو | € | 52.94 |
| SAR | ريال سعودي | ر.س | 12.95 |
| AED | درهم إماراتي | د.إ | 13.24 |
| KWD | دينار كويتي | د.ك | 158.4 |
| GBP | جنيه إسترليني | £ | 61.73 |
| CNY | يوان صيني | ¥ | 6.72 |
| JPY | ين ياباني | ¥ | 0.322 |

في Development اعمل لكل عملة غير أساسية تاريخ 12 سعر بتذبذب ±2% ينتهي بالسعر ده.

## 6) الاختبارات
- الترتيب، `changePct`، إضافة سعر للتاريخ بس لما السعر يتغير، و `history` أقصاه 12.
- قواعد العملة الأساسية والحذف.

## معايير القبول
- [ ] 4 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (19 ✅).
