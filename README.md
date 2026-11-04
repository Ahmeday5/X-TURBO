# X-TURBO — لوحة التحكم

لوحة الإدارة (ERP) الخاصة بمتجر X-TURBO لقطع غيار السيارات: المنتجات والفئات والطلبات، والمخازن ونقاط البيع وأرصدة المخزون، والمشتريات والحسابات.

مبنية بـ **Angular 18** (Standalone + Signals)، والواجهة **عربية بالكامل واتجاهها من اليمين لليسار (RTL)**، مع وضعين فاتح وداكن بألوان الهوية.

---

## التشغيل

```bash
npm install
npm start        # http://localhost:4200
npm run build    # نسخة الإنتاج → dist/x-turbo-dashboard/
```

### الدخول (قبل جاهزية الباك إند)

طول ما `mockApi: true` في `src/environments/environment.ts`، الـ API بيشتغل من داخل المتصفح (`src/app/mock/`)، وصفحة الدخول بتعرض حسابات تجريبية تتملى بضغطة:

| الحساب | البريد | كلمة المرور | الصلاحيات |
|---|---|---|---|
| مدير النظام | `admin@xturbo.com` | `Admin@123` | كل الصلاحيات |
| مدير المخازن | `warehouse@xturbo.com` | `Warehouse@123` | المخزون والكتالوج والمشتريات |

أول ما الباك إند يجهز: `mockApi: false` وظبط `apiUrl`. نسخة الإنتاج **لا تحتوي** أي كود mock أو بيانات تجريبية (`angular.json → fileReplacements` بيبدّل `mock/index.ts` بـ `mock/index.prod.ts`).

---

## هيكل المشروع

```text
src/
├── app/
│   ├── core/                 خدمات وبنية التطبيق (singletons)
│   │   ├── auth/             الدخول، الجلسة، تجديد التوكن، الحراس، الأدوار والصلاحيات
│   │   │   ├── permissions.ts    ← كتالوج الصلاحيات (المصدر الوحيد)
│   │   │   └── roles.ts          ← الأدوار وأسماؤها بالعربي
│   │   ├── constants/nav.constants.ts  ← القائمة الجانبية (منها بيتولد السايدبار والبحث والمسارات)
│   │   ├── interceptors/     cache → timeout → loader → error → auth
│   │   └── services/         api, theme, navigation, layout, toast, dialog, storage…
│   ├── layout/
│   │   ├── auth-layout/      شاشة الدخول (لوحة العرض المتحركة + الكارت)
│   │   └── main-layout/      الهيدر + السايدبار + منطقة المحتوى
│   ├── features/
│   │   ├── auth/pages/login/ صفحة الدخول (الصفحة الوحيدة للمصادقة)
│   │   ├── dashboard/        لوحة التحكم (models / services / components)
│   │   └── coming-soon/      صفحة مؤقتة لكل قسم لم يُبنَ بعد
│   ├── shared/               مكونات وأدوات قابلة لإعادة الاستخدام
│   │   ├── components/       charts (area/sparkline/bar-list)، delta، icon، modal، data-table…
│   │   ├── directives/       count-up، pointer-parallax، click-outside، has-permission
│   │   └── utils/            format (أرقام/عملة/تواريخ)، plural (الجمع العربي)، initials، motion
│   └── mock/                 API تجريبي للتطوير فقط
├── styles/                   نظام التصميم (tokens، base، bootstrap-overrides، patterns…)
└── environments/
```

---

## قواعد الواجهة (مهمة لأي صفحة جديدة)

**اللغة والاتجاه**
- كل النصوص عربي مباشرة في القوالب — مفيش طبقة ترجمة لأن التطبيق لغة واحدة.
- استخدم الخصائص المنطقية فقط: `margin-inline-start`، `padding-inline`، `inset-inline-end`، `text-align: start`… مش `left/right`.
- للحركة الأفقية اضرب في `var(--dir)` (= ‎-1 في RTL): `translateX(calc(4px * var(--dir)))`.
- لـ `transform-origin` وما شابه استخدم `var(--start)` / `var(--end)`.
- الأيقونات الاتجاهية (`arrow-right`، `chevron-left`، `logout`، `trend-*`) بتنعكس تلقائيًا في RTL.
- أي نص لاتيني جوه جملة عربية (إيميل، كود صنف، رقم إصدار) يتلف بـ `class="ltr"`.
- ممنوع `letter-spacing` و`text-transform: uppercase` على النص العربي (بيكسروا اتصال الحروف).

**الأرقام والتواريخ** — من `shared/utils/format.util.ts` فقط (`ar-EG` بأرقام لاتينية):
`formatMoney`، `formatMoneyCompact`، `formatInteger`، `formatDelta`، `formatDayMonth`، `formatRelative`.

**الجمع العربي** — `pluralAr(count, { one, two, few, other })` من `plural.util.ts` بدل `count + كلمة`.

**الألوان والثيم** — من التوكنز في `src/styles/_tokens.scss` فقط (`--primary`، `--bg2`، `--txt2`…)، ممنوع ألوان ثابتة في المكونات. `ThemeService` بيتحكم في الوضع الفاتح/الداكن.

**الأنماط الجاهزة** (`src/styles/_patterns.scss`): `.panel`، `.seg`، `.status-pill`، `.skeleton`، `.reveal`، `.input-icon`، `.form-lg`.

---

## المصادقة والجلسة

- `AuthService` هو مصدر الحقيقة: `currentUser`، `isAuthenticated`، `permissionSet` (signals).
- المسارات في `core/auth/auth.config.ts` (`login`، `refresh-token`، `logout`، `me`).
- تجديد التوكن: تجديد استباقي قبل الانتهاء بدقيقة، طلب تجديد واحد مشترك داخل التبويب، وقفل عبر التبويبات (Web Locks)، وإعادة محاولة بفواصل متزايدة لأخطاء الشبكة، وتسجيل خروج متزامن بين التبويبات.

## الصلاحيات والقائمة

1. أضف المفتاح في `core/auth/permissions.ts`.
2. أضف العنصر في `core/constants/nav.constants.ts` مع `permissions`.
3. السايدبار والبحث بيتحدثوا تلقائيًا، والمسار بيتعمل له صفحة "قيد التطوير" محمية بنفس الصلاحية.
4. لما تبني الصفحة الحقيقية: أضف مسارها في `app.routes.ts` وأضف الرابط لـ `BUILT_ROUTES`.

## إضافة قسم جديد

```text
features/<القسم>/
├── models/<القسم>.model.ts      شكل بيانات الـ API
├── services/<القسم>.service.ts  الاتصال بالـ API + ثوابت المسارات
├── components/                  مكونات العرض (OnPush، inputs فقط)
└── <القسم>.component.ts         الصفحة: الحالة (signals) وتنسيق البيانات
```

ولحد ما الباك إند يجهز، أضف handler في `src/app/mock/handlers/` وسجّله في `mock-api.interceptor.ts`.
