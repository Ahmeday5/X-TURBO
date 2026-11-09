# الخطوة 17 — الموظفين: `EmployeesController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **EmployeesController بس**.

بطاقة موظف مربوطة بقسم (= مركز تكلفة) وبحساب سلف.

Route: `api/employees` — `[HasPermission("Accounts.View")]`.

---

## 1) الـ Entity

```csharp
Employee {
  string Id;
  string Code;               // EMP-0012 — NumberSequences "employee" (Prefix EMP, Digits 4)
  string Name;               // ≥ 3 حروف, max 120
  string JobTitle;
  string? CostCenterId;      // القسم
  string Phone;
  string NationalId;         // "" أو 14 رقم، unique لو مش فاضي
  DateOnly HireDate;
  decimal Salary;            // المرتب الشهري الإجمالي — عدد صحيح ≥ 0
  string? AdvancesAccountId; // حساب فرعي لتتبع سلف الموظف
  string Status;             // active | leave | terminated
  string Notes;
  DateTime CreatedAt;
  string SearchText;         // name + code + jobTitle + phone + costCenterName + nationalId
}
```

## 2) الـ DTOs

```csharp
public sealed record EmployeeDto(
    string Id, string Code, string Name, string JobTitle,
    string? CostCenterId, string? CostCenterName, string? CostCenterColor,   // join
    string Phone, string NationalId, DateOnly HireDate, decimal Salary,
    string? AdvancesAccountId, string? AdvancesAccountName,                    // join
    string Status, string Notes, DateTime CreatedAt);

public sealed record EmployeePayload(
    string Name, string JobTitle, string? CostCenterId, string Phone, string NationalId,
    DateOnly? HireDate, decimal Salary, string? AdvancesAccountId, string Status, string Notes);

public sealed record EmployeeDepartmentStatDto(string? CostCenterId, string Name, string Color, int Count, decimal Salaries);

public sealed record EmployeeStatsDto(
    int Headcount,        // غير المنتهية خدمتهم (active + leave)
    int Active, int OnLeave,
    decimal TotalSalaries,   // Σ مرتبات active + leave
    decimal AverageSalary,   // round(TotalSalaries / Headcount) أو 0
    IReadOnlyList<EmployeeDepartmentStatDto> ByDepartment);  // مرتبة بالمرتبات تنازلي
```
- في `ByDepartment`: الموظفين من غير قسم يتجمعوا في صف `costCenterId = null`، `name = "بدون قسم"`، `color = "var(--txt3)"`.

## 3) الـ Endpoints

### 3.1 `GET /api/employees` — paged
- Search: `name`, `code`, `jobTitle`, `phone`, `costCenterName`, `nationalId`.
- فلاتر: `costCenterId`، `status`.
- sortBy: `code`, `name`, `jobTitle`, `costCenterName`, `hireDate`, `salary`, `status`, `createdAt`. الافتراضي `code asc`.

### 3.2 `GET /api/employees/stats` — نفس البحث والفلاتر **ما عدا `status`**.
### 3.3 `POST /api/employees` ← 201
### 3.4 `PUT /api/employees/{id}`
### 3.5 `DELETE /api/employees/{id}`

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي أو أقل من 3 حروف | 422 | `اسم الموظف مطلوب` |
| `status` مش من التلاتة | 422 | `حالة الموظف غير صحيحة` |
| `phone` (بعد شيل المسافات) مش `^01[0125]\d{8}$` | 422 | `رقم الموبايل غير صحيح` |
| `nationalId` مش 14 رقم | 422 | `الرقم القومي يجب أن يكون 14 رقمًا` |
| `nationalId` مكرر | 409 | `الرقم القومي مسجل لموظف آخر` |
| `costCenterId` مش موجود | 404 | `القسم غير موجود` |
| `advancesAccountId` مش موجود | 404 | `حساب السلف غير موجود` |
| `advancesAccountId` تجميعي | 422 | `اختر حسابًا فرعيًا للسلف` |
| `hireDate` فاضي | 422 | `تاريخ التعيين مطلوب` |
| delete وحالته مش `terminated` | 409 | `أنهِ خدمة الموظف أولًا — لا يُحذف موظف على رأس العمل` |
| مش موجود | 404 | `الموظف غير موجود` |

- التطبيع: `salary = max(0, round(x))`، النصوص trim، الـ ids الفاضية → null.
- حدّث `ICostCenterUsageChecker` (خطوة 11) — فيه موظفين على المركز، و `IAccountUsageChecker`/قاعدة حذف الحساب (خطوة 10) — مربوط بسلف موظف.

## 5) الـ Seed (Development)
- ~25 موظف موزعين على cc-1..cc-8 بمسميات واقعية (مدير فرع، أمين مخزن، كاشير، محاسب، مندوب مبيعات، سائق، فني…)، مرتبات 6000–35000، 3 في إجازة، 2 منتهية خدمتهم، أرقام قومية 14 رقم فريدة، بعضهم مربوط بحساب `acc-1106` سلف الموظفين.

## 6) الاختبارات
- CRUD + القواعد + stats (بتتجاهل `status`، والمنتهية خدمتهم مش في المرتبات).
- حذف مركز تكلفة عليه موظفين ← 409 (خطوة 11).

## معايير القبول
- [ ] 5 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (17 ✅).
