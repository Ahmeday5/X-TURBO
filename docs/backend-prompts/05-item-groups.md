# الخطوة 05 — مجموعات الأصناف: `ItemGroupsController`

> اقرأ `docs/CONVENTIONS.md` و `docs/PROGRESS.md` الأول. الخطوة دي: **ItemGroupsController بس**.

Route: `api/item-groups` — كل الـ endpoints عليها `[HasPermission("Items.View")]`، ما عدا `lookup` عليها `[HasAnyPermission("Items.View","Inventory.View","Invoices.View","Pos.Access","Reports.View")]` (بتتستخدم كفلتر في شاشات كتير).

---

## 1) الـ Entity

```csharp
ItemGroup {
  string Id;
  string Code;          // GR-001 — من NumberSequences key "item-group" (Prefix GR, Digits 3)
  string Name;          // unique, max 80
  string? ParentId;     // self reference (اختياري)
  string Description;   // "" افتراضي, max 300
  string Color;         // hex مثل "#e31e24"
  bool IsActive;
  DateTime CreatedAt;
  string SearchText;    // name + code + description
}
```

## 2) الـ DTOs

```csharp
public sealed record ItemGroupDto(
    string Id, string Code, string Name,
    string? ParentId, string? ParentName,  // ParentName محسوب
    string Description, string Color, bool IsActive,
    int ItemsCount,                        // محسوب: عدد الأصناف (نشطة وغير نشطة) في المجموعة
    DateTime CreatedAt);

public sealed record ItemGroupPayload(string Name, string? ParentId, string Description, string Color, bool IsActive);

public sealed record ItemGroupOption(string Id, string Name, string Color);
```

> `ItemsCount` = 0 دلوقتي لأن جدول الأصناف لسه مش موجود. اكتبه كـ subquery هيشتغل لما خطوة 06 تضيف الجدول (أو حط TODO في `PROGRESS.md` واتأكد منه في خطوة 06).

## 3) الـ Endpoints

### 3.1 `GET /api/item-groups` — paged
- Search: `name`, `code`, `description`.
- فلتر: `status` = `active` | `inactive`.
- sortBy المسموح: `name`, `code`, `itemsCount`, `isActive`, `createdAt`. الافتراضي `createdAt desc`.

### 3.2 `GET /api/item-groups/lookup`
- Array من `ItemGroupOption` للمجموعات **النشطة فقط**، مرتبة بالاسم.

### 3.3 `POST /api/item-groups` ← 201 + `ItemGroupDto`
### 3.4 `PUT /api/item-groups/{id}` ← `ItemGroupDto`
### 3.5 `DELETE /api/item-groups/{id}` ← `data: null`

(مفيش `GET /item-groups/{id}` — الفرونت مش بيستخدمه، بس مفيش مانع تضيفه.)

## 4) قواعد العمل

| الحالة | الكود | الرسالة |
|---|---|---|
| `name` فاضي بعد trim | 422 | `اسم المجموعة مطلوب` |
| اسم موجود لمجموعة تانية (بعد trim، مقارنة تامة) | 409 | `يوجد مجموعة بنفس الاسم` |
| `parentId` مبعوت ومش موجود | 404 | `المجموعة الرئيسية غير موجود` ← استخدم `NotFoundException("المجموعة الرئيسية")` |
| update و `parentId == id` | 422 | `لا يمكن أن تكون المجموعة أبًا لنفسها` |
| update و `parentId` واحد من أحفادها (يعمل دورة) | 422 | `لا يمكن نقل المجموعة تحت إحدى مجموعاتها الفرعية` |
| delete ومجموعة فيها أصناف | 409 | `لا يمكن حذف مجموعة تحتوي على أصناف` |
| delete ومجموعة ليها مجموعات فرعية | 409 | `لا يمكن حذف مجموعة لها مجموعات فرعية` |
| id مش موجود | 404 | `العنصر غير موجود` ← `NotFoundException("العنصر")` |

- `parentId` الفاضي `""` → `null`.
- `color` لو فاضي أو مش hex صالح → `#64748b`.
- لما اسم أو لون المجموعة يتغير: الأصناف بتعرض `groupName` و `groupColor` — لو هتعملهم denormalized في خطوة 06 لازم يتحدثوا هنا في نفس الـ transaction (ومعاهم `SearchText` للأصناف). الأفضل: **ماتخزنهمش** في الأصناف واعمل join.

## 5) الـ Seed (Development)

12 مجموعة بالترتيب (الكود GR-001…GR-012، كلها نشطة ما عدا الأخيرة):

| الاسم | الوصف | اللون |
|---|---|---|
| الفرامل | تيل وطنابير وأسطوانات الفرامل | #e31e24 |
| الفلاتر | فلاتر الزيت والهواء والبنزين والتكييف | #f97316 |
| الإشعال | البوجيهات والموبينات والأسلاك | #eab308 |
| المحرك | سيور وجوانات وقطع المحرك | #22c55e |
| العفشة | المساعدين والمقصات والبلي | #14b8a6 |
| الكهرباء | البطاريات والدينامو والمارش | #0ea5e9 |
| الزيوت | زيوت المحرك والفتيس والفرامل | #6366f1 |
| التكييف | كمبروسر ورادياتير التكييف | #a855f7 |
| الإضاءة | الفوانيس واللمبات | #ec4899 |
| الهيكل | الصدامات والمرايات والأبواب | #64748b |
| الإطارات | الكاوتش والجنوط | #e31e24 |
| الإكسسوارات | الدواسات والفرش والكماليات | #f97316 (غير نشطة) |

## 6) الاختبارات

- CRUD + البحث العربي (`الاكسسوارات` تلاقي `الإكسسوارات`).
- lookup بيرجع النشطة بس.
- اسم مكرر ← 409، دورة في الأب ← 422.
- 403 لمستخدم من غير صلاحية.

## معايير القبول

- [ ] 5 endpoints مطابقة للعقد.
- [ ] الاختبارات خضرا، `docs/PROGRESS.md` محدث (05 ✅).
