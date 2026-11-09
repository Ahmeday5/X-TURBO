# الخطوة 25 — المراجعة النهائية والتجهيز للإنتاج

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي **مفيهاش features جديدة** — مراجعة شاملة وتقفيل.

## 1) مراجعة العقد مع الفرونت
اعمل جدول في `docs/API-CONTRACT.md` بكل endpoint (Method، Route، Permission، Query params، Body، Response، أكواد الأخطاء). لازم يحتوي على الأقل على:

```
auth: POST login · POST refresh-token · POST logout · GET me
users: GET · GET stats · GET {id} · POST · PUT {id} · DELETE {id} · POST {id}/status · POST {id}/reset-password
settings: GET · PUT
item-groups: GET · GET lookup · POST · PUT {id} · DELETE {id}
items: GET · GET {id} · POST · PUT {id} · DELETE {id} · GET lookup
warehouses: GET · GET lookup · GET {id} · POST · PUT {id} · DELETE {id}
stock: GET · GET summary · GET items/{itemId}
parties: GET · GET lookup · GET {id} · POST · PUT {id} · DELETE {id} · GET {id}/statement · GET {id}/statement/detailed · GET balances · GET balances/summary
accounts: GET · GET lookup · GET {id} · POST · PUT {id} · DELETE {id}
cost-centers: GET · GET lookup · POST · PUT {id} · DELETE {id}
documents: GET · GET stats · GET {id} · POST · PUT {id} · DELETE {id} · POST {id}/post · POST {id}/complete · POST {id}/cancel · POST {id}/convert
vouchers: GET · GET stats · GET {id} · POST · PUT {id} · DELETE {id} · POST {id}/post · POST {id}/cancel
employees: GET · GET stats · POST · PUT {id} · DELETE {id}
budget: GET · PUT {year}
currencies: GET · POST · PUT {id} · DELETE {id}
pos/settings: GET · PUT
orders: GET · GET stats · GET {id} · PATCH {id}/status
payments: GET · GET stats · GET {id} · POST {id}/confirm · POST {id}/fail · POST {id}/retry · POST {id}/refund · POST {id}/settle
dashboard: GET overview
reports: GET overview · GET products
```
- اكتب **contract test** واحد بيلف على كل الـ routes ويتأكد إنها موجودة وبترجع الـ envelope (مش 404/405)، وإن كل endpoint (ما عدا login/refresh/logout) بيرجع 401 من غير توكن.
- تأكد إن كل enum بيتبعت بالقيمة الحرفية (`sale-return`, `partially_refunded`, `goods-receipt`…) — test بيعمل serialize لكل قيمة.

## 2) الأمان
- كل الـ permissions متطبقة (test لكل controller إن مستخدم من غير الصلاحية ← 403).
- `Jwt:Key` و connection string من env vars / Key Vault في Production، مش في الريبو.
- HTTPS + HSTS، Security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`).
- CORS لأصول الإنتاج بس.
- Rate limiting عام (مثلًا 300 طلب/دقيقة لكل مستخدم) غير اللي على login.
- مفيش SQL خام بيتبني بتوصيل نصوص.
- Audit log (جدول `AuditLogs`: user, action, entity, entityId, at, payload مختصر) لكل عمليات الكتابة على: users، settings، post/cancel للمستندات والسندات، المدفوعات.

## 3) الأداء
- راجع كل الـ queries بـ logging الـ SQL: مفيش N+1، و `AsNoTracking` في كل القراءات.
- Indexes على: كل الأعمدة اللي فيها فلاتر و sort الافتراضي (`Documents(Kind, CreatedAt)`, `Documents(PartyId)`, `Vouchers(Kind, Date)`, `Orders(CreatedAt)`, `StorePayments(CreatedAt)`, `StockBalances(WarehouseId)` …)، و `SearchText`.
- Load test بسيط (k6 أو NBomber): 50 مستخدم على `/items/lookup` و `/documents` و `/dashboard/overview` — p95 أقل من 300ms.

## 4) الموثوقية
- كل العمليات المركبة في transaction واحدة (راجعها: create+post، complete reservation، order status + payments).
- Concurrency على `StockBalances` و `Documents` و `NumberSequences` (اختبارات توازي موجودة؟).
- Health checks: DB + `/health/ready`.
- Serilog structured logs + `CorrelationId` في كل request و header `X-Correlation-Id` في الرد.
- Global exception handler ماتطلعش stack trace برا.

## 5) الـ Seed والبيئات
- `Production`: الحسابات (أرصدة صفر)، EGP، الترقيم (NextNumber = 1)، إعدادات النظام ونقطة البيع الافتراضية، ومستخدم Admin واحد بباسورد من env var (`SEED_ADMIN_PASSWORD`) — **ومفيش** بيانات تجريبية.
- `Development`: كل الـ seed التجريبي من الخطوات، وفي الآخر `TrialBalance.IsBalanced` و `Σ StockBalances = Σ StockMovements` لكل صنف/مخزن.
- أمر CLI: `dotnet run -- seed --reset` لإعادة بناء داتا التطوير.

## 6) النشر
- `Dockerfile` (multi-stage) + `docker-compose.yml` (api + sqlserver).
- الـ migrations بتتطبق بأمر منفصل/`migration bundle` في الـ pipeline (مش تلقائي عند الإقلاع في Production).
- GitHub Actions: build + test (Testcontainers) + publish image.

## 7) ربط الفرونت
اكتب في `docs/FRONTEND-HANDOFF.md`:
- قيمة `apiUrl` المطلوبة و `mockApi: false` في `src/environments/environment*.ts` بتاعة الفرونت.
- حسابات التجربة.
- أي اختلاف متعمد عن الـ mock (مثلًا: حذف صنف عليه حركات بقى ممنوع، قواعد خصم نقطة البيع، الـ 429 في login).

## معايير القبول
- [ ] `docs/API-CONTRACT.md` و `docs/FRONTEND-HANDOFF.md` موجودين.
- [ ] contract tests + permission tests + concurrency tests خضرا.
- [ ] `docker compose up` بيشغل الـ API والفرونت يقدر يدخل بـ `admin@xturbo.com`.
- [ ] `docs/PROGRESS.md` كله ✅.
