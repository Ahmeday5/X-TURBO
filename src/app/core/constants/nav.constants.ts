import { flattenNav, NavLeaf, NavSection } from '../models/nav.model';
import { PERMISSIONS as P } from '../auth/permissions';

/**
 * Sidebar navigation: sections → (groups →) pages, ordered by daily workflow
 * (overview → selling → stock → money → admin). Each concept lives in exactly
 * one place — check for an existing entry before adding a new one. This is the one file to
 * edit when adding/removing pages — the sidebar, the topbar search and the
 * routes are all derived from it, filtered by the user's roles/permissions.
 *
 * Gates (`permissions` / `roles`) are OR-ed; a group's gate is inherited by
 * children that don't declare their own. `keywords` widen both searches.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: 'نظرة عامة',
    items: [
      {
        id: 'dashboard',
        label: 'لوحة التحكم',
        route: '/dashboard',
        icon: 'home',
        permissions: [P.dashboard],
        keywords: ['الرئيسية'],
      },
      {
        id: 'reports',
        label: 'التقارير',
        route: '/reports',
        icon: 'chart',
        permissions: [P.reports],
        keywords: ['إحصائيات', 'تحليلات'],
      },
    ],
  },
  {
    label: 'المبيعات',
    items: [
      {
        id: 'orders',
        label: 'الطلبات',
        route: '/orders',
        icon: 'cart',
        permissions: [P.orders],
        keywords: ['اوردرات', 'طلبيات', 'طلبية'],
      },
      {
        id: 'erp-invoices',
        label: 'الفواتير',
        icon: 'receipt',
        permissions: [P.invoices],
        keywords: ['فاتورة'],
        children: [
          {
            id: 'invoices.quotations',
            label: 'عروض الأسعار',
            route: '/invoices/quotations',
            icon: 'file-percent',
            description: 'إعداد عروض الأسعار للعملاء ومتابعة حالتها',
            keywords: ['عرض سعر'],
          },
          {
            id: 'invoices.sales',
            label: 'المبيعات',
            route: '/invoices/sales',
            icon: 'tag',
            description: 'فواتير البيع النقدي والآجل',
            keywords: ['فاتورة بيع', 'بيع'],
          },
          {
            id: 'invoices.purchases',
            label: 'المشتريات',
            route: '/invoices/purchases',
            icon: 'cart',
            description: 'فواتير الشراء من الموردين',
            keywords: ['فاتورة شراء', 'شراء'],
          },
          {
            id: 'invoices.sales-returns',
            label: 'مرتجع المبيعات',
            route: '/invoices/sales-returns',
            icon: 'return',
            description: 'ما يرده العملاء من أصناف مباعة',
            keywords: ['مرتجع'],
          },
          {
            id: 'invoices.purchase-returns',
            label: 'مرتجع المشتريات',
            route: '/invoices/purchase-returns',
            icon: 'return',
            description: 'ما يُرد إلى الموردين من أصناف مشتراة',
            keywords: ['مرتجع'],
          },
          {
            id: 'invoices.transfers',
            label: 'تحويلات المخازن',
            route: '/invoices/transfers',
            icon: 'swap',
            description: 'نقل الأصناف بين المخازن مباشرة',
            keywords: ['تحويل', 'نقل'],
          },
        ],
      },
      {
        id: 'erp-pos',
        label: 'نقطة البيع',
        icon: 'store',
        permissions: [P.pos],
        keywords: ['كاشير', 'POS'],
        children: [
          {
            id: 'pos.terminal',
            label: 'نقطة البيع',
            route: '/pos/terminal',
            icon: 'monitor',
            description: 'شاشة البيع السريع للكاشير',
            keywords: ['كاشير', 'بيع'],
          },
          {
            id: 'pos.reservations',
            label: 'حجز طلبية',
            route: '/pos/reservations',
            icon: 'calendar',
            description: 'حجز الأصناف للعميل لحين الاستلام',
            keywords: ['حجز'],
          },
          {
            id: 'pos.settings',
            label: 'إعدادات نقطة البيع',
            route: '/pos/settings',
            icon: 'sliders',
            description: 'الخزن والطابعات وطرق الدفع',
            keywords: ['إعدادات'],
          },
          {
            id: 'pos.external-customers',
            label: 'تعريف عميل خارجي',
            route: '/pos/external-customers',
            icon: 'user-plus',
            description: 'تسجيل عميل سريع من شاشة البيع',
            keywords: ['عميل'],
          },
        ],
      },
    ],
  },
  {
    label: 'المخزون',
    items: [
      {
        id: 'erp-items',
        label: 'الأصناف',
        icon: 'box',
        permissions: [P.items],
        keywords: ['صنف', 'منتجات', 'قطع غيار'],
        children: [
          {
            id: 'items.define',
            label: 'تعريف صنف',
            route: '/items/define',
            icon: 'file-plus',
            description: 'إضافة صنف جديد بوحداته وأسعاره',
            keywords: ['منتج', 'قطع غيار'],
          },
          {
            id: 'items.groups',
            label: 'تعريف مجموعة',
            route: '/items/groups',
            icon: 'folder',
            description: 'تقسيم الأصناف إلى مجموعات',
            keywords: ['مجموعات', 'فئة', 'تصنيف'],
          },
          {
            id: 'items.directory',
            label: 'دليل الأصناف',
            route: '/items/directory',
            icon: 'table',
            description: 'كل الأصناف مع الأسعار والأرصدة',
            keywords: ['منتجات', 'قطع غيار'],
          },
          {
            id: 'items.cars',
            label: 'ماركات وموديلات السيارات',
            route: '/items/cars',
            icon: 'car',
            description: 'الماركات والموديلات وسنوات الإنتاج — أساس توافق القطع وتطبيق الموبايل',
            keywords: ['سيارة', 'سيارات', 'ماركة', 'موديل', 'تويوتا', 'توافق'],
          },
        ],
      },
      {
        id: 'erp-warehouses',
        label: 'المخازن',
        icon: 'warehouse',
        permissions: [P.warehouses],
        keywords: ['مستودعات', 'مخزون'],
        children: [
          {
            id: 'warehouses.define',
            label: 'تعريف مخزن',
            route: '/warehouses/define',
            icon: 'file-plus',
            description: 'إضافة مخزن جديد وبياناته',
            keywords: ['مستودع'],
          },
          {
            id: 'warehouses',
            label: 'دليل المخازن',
            route: '/warehouses',
            icon: 'list',
            description: 'كل المخازن وبياناتها',
            keywords: ['مستودعات'],
          },
          {
            id: 'stock',
            label: 'أرصدة المخزون',
            route: '/stock',
            icon: 'layers',
            permissions: [P.inventory],
            description: 'الكميات المتاحة من كل صنف في كل مخزن',
            keywords: ['كميات', 'جرد'],
          },
        ],
      },
    ],
  },
  {
    label: 'المالية',
    items: [
      {
        id: 'erp-customers',
        label: 'العملاء والموردون',
        icon: 'users',
        permissions: [P.customers],
        keywords: ['عملاء', 'موردين'],
        children: [
          {
            id: 'customers.card',
            label: 'بطاقة تعريف عميل / مورد',
            route: '/customers/card',
            icon: 'id-card',
            description: 'إضافة عميل أو مورد وتعديل بياناته',
            keywords: ['إضافة عميل', 'مورد'],
          },
          {
            id: 'customers.list',
            label: 'قائمة العملاء والموردين',
            route: '/customers/list',
            icon: 'list',
            description: 'كل العملاء والموردين مع البحث والتصفية',
          },
          {
            id: 'customers.statement',
            label: 'كشف حساب عميل / مورد',
            route: '/customers/statement',
            icon: 'file-lines',
            description: 'حركة الحساب والرصيد خلال فترة',
            keywords: ['كشف حساب'],
          },
          {
            id: 'customers.statement-detailed',
            label: 'كشف حساب تفصيلي',
            route: '/customers/statement-detailed',
            icon: 'file-search',
            description: 'كشف الحساب بتفاصيل الأصناف في كل فاتورة',
            keywords: ['كشف حساب'],
          },
          {
            id: 'customers.balances',
            label: 'أرصدة العملاء والموردين',
            route: '/customers/balances',
            icon: 'scale',
            description: 'الأرصدة المدينة والدائنة في تاريخ محدد',
            keywords: ['مديونية', 'رصيد'],
          },
        ],
      },
      {
        id: 'erp-vouchers',
        label: 'السندات',
        icon: 'journal',
        permissions: [P.vouchers],
        keywords: ['سند'],
        children: [
          {
            id: 'vouchers.journal',
            label: 'سند القيد',
            route: '/vouchers/journal',
            icon: 'journal',
            description: 'قيود اليومية المحاسبية',
            keywords: ['قيد', 'يومية'],
          },
          {
            id: 'vouchers.receipt',
            label: 'سند القبض',
            route: '/vouchers/receipt',
            icon: 'cash-in',
            description: 'تحصيل المبالغ من العملاء والجهات',
            keywords: ['قبض', 'تحصيل'],
          },
          {
            id: 'vouchers.payment',
            label: 'سند الصرف',
            route: '/vouchers/payment',
            icon: 'cash-out',
            description: 'صرف المبالغ للموردين والمصروفات',
            keywords: ['صرف', 'دفع'],
          },
        {
            id: 'payments',
            label: 'المدفوعات',
            route: '/payments',
            icon: 'wallet',
            permissions: [P.payments],
            description: 'مدفوعات المتجر الإلكتروني وتحصيلاتها',
            keywords: ['تحصيل', 'دفع إلكتروني'],
          },
        ],
      },
      {
        id: 'erp-accounts',
        label: 'الحسابات',
        icon: 'calculator',
        permissions: [P.accounts],
        keywords: ['محاسبة'],
        children: [
          {
            id: 'accounts.card',
            label: 'بطاقة تعريف حساب',
            route: '/accounts/card',
            icon: 'file-plus',
            description: 'إضافة حساب جديد إلى الشجرة المحاسبية',
            keywords: ['حساب جديد'],
          },
          {
            id: 'accounts.chart',
            label: 'دليل الحسابات',
            route: '/accounts/chart',
            icon: 'sitemap',
            description: 'شجرة الحسابات بمستوياتها',
            keywords: ['شجرة الحسابات'],
          },
          {
            id: 'accounts.cost-centers',
            label: 'بطاقة تعريف مركز تكلفة',
            route: '/accounts/cost-centers',
            icon: 'target',
            description: 'مراكز التكلفة لتوزيع المصروفات والإيرادات',
            keywords: ['مركز تكلفة'],
          },
        ],
      },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      {
        id: 'users',
        label: 'المستخدمون والصلاحيات',
        route: '/users',
        icon: 'users',
        permissions: [P.users],
        keywords: ['أدوار'],
      },
      {
        id: 'settings',
        label: 'الإعدادات',
        route: '/settings',
        icon: 'settings',
        permissions: [P.settings],
      },
      {
        id: 'delivery-zones',
        label: 'مناطق التوصيل',
        route: '/delivery-zones',
        icon: 'truck',
        permissions: [P.settings],
        description: 'رسوم ومدة التوصيل والشحن المجاني لكل محافظة في تطبيق الموبايل',
        keywords: ['شحن', 'توصيل', 'محافظة', 'محافظات'],
      },
    ],
  },
];

/** Every page in the tree, with effective gates — used by the router. */
export const NAV_LEAVES: readonly NavLeaf[] = flattenNav(NAV_SECTIONS);
