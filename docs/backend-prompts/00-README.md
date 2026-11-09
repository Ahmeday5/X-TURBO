# برومبتات الـ Backend (.NET) لمشروع X-TURBO

الملفات دي مكتوبة عشان تتبعت **واحد واحد** لأي AI agent (Claude Code / Cursor / Copilot) شغال على ريبو الـ Backend.
كل ملف = خطوة واحدة = Controller واحد (أو أساس مشترك). متبعتش خطوتين مع بعض.

## طريقة الاستخدام

1. اعمل ريبو فاضي للـ Backend وافتحه في الـ agent.
2. ابعت محتوى `01-foundation.md` كامل كرسالة واحدة.
3. استنى لحد ما يخلص، وتأكد من **"معايير القبول"** اللي في آخر الملف (build + tests + Swagger).
4. اعمل commit، وبعدين ابعت الملف اللي بعده.
5. لو الـ agent فتح session جديدة، ابدأ الرسالة بـ: «اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول».

> الخطوة 01 بتخلي الـ agent يحفظ القواعد المشتركة في `docs/CONVENTIONS.md` جوه ريبو الـ Backend، وكل خطوة بعدها بتحدث `docs/PROGRESS.md`. عشان كده كل برومبت بعد كده قصير نسبيًا ومش بيكرر القواعد.

## ترتيب الخطوات (الترتيب مهم — كل خطوة بتعتمد على اللي قبلها)

| # | الملف | الـ Controller | الـ Endpoints |
|---|------|----------------|---------------|
| 01 | `01-foundation.md` | — (الأساس) | Envelope، Paging، Errors، Search عربي، Numbering |
| 02 | `02-auth.md` | `AuthController` | `auth/login` · `auth/refresh-token` · `auth/logout` · `auth/me` |
| 03 | `03-users.md` | `UsersController` | `users` + stats + status + reset-password |
| 04 | `04-settings.md` | `SettingsController` | `settings` |
| 05 | `05-item-groups.md` | `ItemGroupsController` | `item-groups` + lookup |
| 06 | `06-items.md` | `ItemsController` | `items` |
| 07 | `07-warehouses.md` | `WarehousesController` | `warehouses` + lookup |
| 08 | `08-stock.md` | `StockController` | `stock` · `stock/summary` · `stock/items/{id}` · `items/lookup` |
| 09 | `09-parties.md` | `PartiesController` (CRUD) | `parties` + lookup |
| 10 | `10-accounts.md` | `AccountsController` | `accounts` + lookup |
| 11 | `11-cost-centers.md` | `CostCentersController` | `cost-centers` + lookup |
| 12 | `12-ledger-engine.md` | — (محرك القيود) | خدمة الترحيل المحاسبي + أرصدة الحسابات |
| 13 | `13-documents-crud.md` | `DocumentsController` (1) | list · stats · get · create · update · delete |
| 14 | `14-documents-workflow.md` | `DocumentsController` (2) | post · complete · cancel · convert |
| 15 | `15-vouchers.md` | `VouchersController` | `vouchers` + stats + post + cancel |
| 16 | `16-party-statements.md` | `PartiesController` (2) | statement · statement/detailed · balances · balances/summary |
| 17 | `17-employees.md` | `EmployeesController` | `employees` + stats |
| 18 | `18-budget.md` | `BudgetController` | `budget` · `budget/{year}` |
| 19 | `19-currencies.md` | `CurrenciesController` | `currencies` |
| 20 | `20-pos-settings.md` | `PosSettingsController` | `pos/settings` |
| 21 | `21-orders.md` | `OrdersController` | `orders` + stats + status |
| 22 | `22-payments.md` | `PaymentsController` | `payments` + stats + confirm/fail/retry/refund/settle |
| 23 | `23-dashboard.md` | `DashboardController` | `dashboard/overview` |
| 24 | `24-reports.md` | `ReportsController` | `reports/overview` · `reports/products` |
| 25 | `25-final-hardening.md` | — | Seed كامل، أمان، أداء، ربط الفرونت |

## بعد ما الـ Backend يخلص — ربط الفرونت

في `src/environments/environment.ts` و `environment.prod.ts`:

```ts
apiUrl: 'https://localhost:5001/api',   // أو رابط السيرفر الحقيقي
mockApi: false,
```

## قرارات اتاخدت في البرومبتات (غيّرها لو حابب قبل ما تبعت)

- **.NET 10 (LTS)** + **SQL Server** + **EF Core** + **Clean Architecture** (4 مشاريع).
- الـ IDs كلها `string`. الحسابات بالذات لازم تبقى `acc-{code}` لأن الفرونت كاتب `acc-1101`… ثابتين في الكود.
- القيود المحاسبية **بتتسجل فعليًا في جدول** وقت الترحيل (مش بتتحسب كل مرة زي الـ mock) — أسرع وأدق.
- الطلبات (Orders) هي مصدر أرقام الـ Dashboard والتقارير، زي ما الفرونت مصمم.
