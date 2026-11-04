import { MenuSection } from '../models/menu-item.model';
import { PERMISSIONS as P } from '../auth/permissions';

/**
 * Sidebar navigation, grouped into sections. This is the file to edit when
 * adding/removing pages — the sidebar, the topbar search and the placeholder
 * routes are all derived from it, filtered by the user's roles/permissions.
 *
 * `roles`/`permissions` are OR-gates: an item with both shows when the user
 * satisfies *either*. Omit both to make an item visible to everyone.
 * `keywords` widen the topbar search (synonyms, common spellings).
 */
export const NAV_SECTIONS: MenuSection[] = [
  {
    label: 'نظرة عامة',
    items: [
      { id: 'dashboard', label: 'لوحة التحكم', route: '/dashboard', icon: 'home', permissions: [P.dashboard], keywords: ['الرئيسية'] },
      { id: 'reports', label: 'التقارير', route: '/reports', icon: 'chart', permissions: [P.reports], keywords: ['إحصائيات', 'تحليلات'] },
    ],
  },
  {
    label: 'المبيعات',
    items: [
      { id: 'orders', label: 'الطلبات', route: '/orders', icon: 'cart', permissions: [P.orders], keywords: ['اوردرات'] },
      { id: 'pos', label: 'نقاط البيع', route: '/pos', icon: 'store', permissions: [P.pos], keywords: ['كاشير', 'POS'] },
      { id: 'customers', label: 'العملاء', route: '/customers', icon: 'user', permissions: [P.customers] },
      { id: 'shipping', label: 'الشحن', route: '/shipping', icon: 'truck', permissions: [P.shipping], keywords: ['توصيل'] },
    ],
  },
  {
    label: 'الكتالوج',
    items: [
      { id: 'products', label: 'المنتجات', route: '/products', icon: 'box', permissions: [P.products], keywords: ['قطع غيار', 'أصناف'] },
      { id: 'categories', label: 'الفئات', route: '/categories', icon: 'tag', permissions: [P.categories], keywords: ['أقسام', 'تصنيفات'] },
    ],
  },
  {
    label: 'المخزون',
    items: [
      { id: 'stock', label: 'أرصدة المخزون', route: '/stock', icon: 'layers', permissions: [P.inventory], keywords: ['كميات', 'جرد'] },
      { id: 'warehouses', label: 'المخازن', route: '/warehouses', icon: 'warehouse', permissions: [P.warehouses], keywords: ['مستودعات'] },
      { id: 'transfers', label: 'التحويلات المخزنية', route: '/transfers', icon: 'swap', permissions: [P.transfers], keywords: ['نقل'] },
    ],
  },
  {
    label: 'المشتريات',
    items: [
      { id: 'suppliers', label: 'الموردون', route: '/suppliers', icon: 'briefcase', permissions: [P.suppliers], keywords: ['موردين'] },
      { id: 'purchase-orders', label: 'أوامر الشراء', route: '/purchase-orders', icon: 'file', permissions: [P.purchasing] },
    ],
  },
  {
    label: 'المالية',
    items: [
      { id: 'accounting', label: 'الحسابات', route: '/accounting', icon: 'calculator', permissions: [P.accounting], keywords: ['محاسبة', 'قيود'] },
      { id: 'invoices', label: 'الفواتير', route: '/invoices', icon: 'receipt', permissions: [P.invoices] },
      { id: 'payments', label: 'المدفوعات', route: '/payments', icon: 'wallet', permissions: [P.payments], keywords: ['تحصيل'] },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { id: 'users', label: 'المستخدمون والصلاحيات', route: '/users', icon: 'users', permissions: [P.users], keywords: ['أدوار'] },
      { id: 'settings', label: 'الإعدادات', route: '/settings', icon: 'settings', permissions: [P.settings] },
    ],
  },
];
