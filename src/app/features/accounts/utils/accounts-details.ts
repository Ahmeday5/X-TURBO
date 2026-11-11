import { EntityDetails, yesNo } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatInteger, formatMoney } from '../../../shared/utils/format.util';
import { Account, ACCOUNT_NATURE_LABEL, ACCOUNT_TYPE_VIEW } from '../models/account.model';
import { CostCenter } from '../models/cost-center.model';

/** Read-only details of a ledger account (👁 in the chart of accounts). */
export function toAccountDetails(a: Account): EntityDetails {
  return {
    header: {
      title: a.name,
      subtitle: `${a.code} · ${ACCOUNT_TYPE_VIEW[a.type].label}`,
      icon: 'calculator',
      badge: a.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات الحساب',
        icon: 'sitemap',
        fields: [
          { label: 'الكود', value: a.code, ltr: true },
          { label: 'الحساب الرئيسي', value: a.parentName ?? 'حساب رئيسي' },
          { label: 'النوع', value: ACCOUNT_TYPE_VIEW[a.type].label },
          { label: 'الطبيعة', value: ACCOUNT_NATURE_LABEL[a.nature] },
          { label: 'المستوى', value: formatInteger(a.level) },
          { label: 'التصنيف', value: a.isGroup ? `تجميعي (${formatInteger(a.childrenCount)} حساب فرعي)` : 'فرعي' },
          { label: 'يتطلب مركز تكلفة', value: yesNo(a.costCenterRequired) },
          { label: 'حساب نظام', value: yesNo(a.isSystem) },
        ],
      },
      {
        title: 'الأرصدة',
        icon: 'scale',
        fields: [
          { label: 'الرصيد', value: formatMoney(a.balance) },
          { label: 'الرصيد الافتتاحي', value: formatMoney(a.openingBalance) },
          { label: 'إجمالي المدين', value: formatMoney(a.totalDebit) },
          { label: 'إجمالي الدائن', value: formatMoney(a.totalCredit) },
        ],
      },
      {
        title: 'أخرى',
        icon: 'file-lines',
        fields: [
          { label: 'تاريخ الإضافة', value: formatDateTime(a.createdAt) },
          { label: 'ملاحظات', value: a.notes, full: true },
        ],
      },
    ],
  };
}

/** Read-only details of a cost center (👁 in the cost centers screen). */
export function toCostCenterDetails(c: CostCenter): EntityDetails {
  const usedPct = c.annualBudget > 0 ? Math.round((c.actualSpend / c.annualBudget) * 100) : null;
  return {
    header: {
      title: c.name,
      subtitle: c.code,
      icon: 'target',
      badge: c.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات المركز',
        icon: 'target',
        fields: [
          { label: 'الكود', value: c.code, ltr: true },
          { label: 'المركز الرئيسي', value: c.parentName ?? 'مركز رئيسي' },
          { label: 'المسؤول', value: c.manager },
          { label: 'تاريخ الإضافة', value: formatDateTime(c.createdAt) },
          { label: 'ملاحظات', value: c.notes, full: true },
        ],
      },
      {
        title: 'الموازنة والفعلي',
        icon: 'coins',
        fields: [
          { label: 'الموازنة السنوية', value: c.annualBudget ? formatMoney(c.annualBudget) : 'غير محددة' },
          { label: 'المصروف الفعلي', value: formatMoney(c.actualSpend) },
          {
            label: 'نسبة الاستهلاك',
            value: usedPct === null ? null : `${usedPct}%`,
            tone: usedPct === null ? undefined : usedPct > 100 ? 'danger' : usedPct >= 80 ? 'warning' : 'good',
          },
          { label: 'الإيراد الفعلي', value: formatMoney(c.actualRevenue) },
          { label: 'عدد القيود', value: formatInteger(c.postingsCount) },
        ],
      },
    ],
  };
}
