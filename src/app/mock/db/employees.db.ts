import { EmployeeStatus } from '../../features/accounts/models/employee.model';
import { pick, seeded } from '../mock-utils';
import { isoDaysAgo } from './db-utils';

/** Staff cards. Department / account names are resolved when served. */
export interface EmployeeRecord {
  id: string;
  code: string;
  name: string;
  jobTitle: string;
  costCenterId: string | null;
  phone: string;
  nationalId: string;
  hireDate: string;
  salary: number;
  advancesAccountId: string | null;
  status: EmployeeStatus;
  notes: string;
  createdAt: string;
}

interface EmployeesDb {
  employees: EmployeeRecord[];
  nextNo: number;
}

/** [name, job, cost center, salary] */
const SEED: ReadonlyArray<[string, string, string, number]> = [
  ['أحمد حسن', 'المدير العام', 'cc-1', 38_000],
  ['خالد عادل', 'مدير المبيعات الإلكترونية', 'cc-7', 22_000],
  ['منى عادل', 'مدير المخازن', 'cc-2', 21_000],
  ['ياسمين فتحي', 'مديرة صالة العرض', 'cc-6', 17_500],
  ['كريم السيد', 'مدير فرع الإسكندرية', 'cc-3', 16_500],
  ['هاني فؤاد', 'مدير فرع الجيزة', 'cc-4', 16_000],
  ['سامح رأفت', 'مدير فرع 6 أكتوبر', 'cc-5', 15_500],
  ['رضا محمود', 'مشرف التوصيل', 'cc-8', 9_500],
  ['محمود عبد العزيز', 'محاسب أول', 'cc-1', 14_000],
  ['نهى سليمان', 'محاسبة', 'cc-1', 10_500],
  ['إبراهيم شوقي', 'أمين مخزن', 'cc-2', 8_200],
  ['عماد ناصر', 'أمين مخزن', 'cc-2', 7_900],
  ['سيد عبد الرحمن', 'عامل تحميل', 'cc-2', 5_800],
  ['مروان طلعت', 'كاشير', 'cc-6', 7_000],
  ['ريم حازم', 'بائعة', 'cc-6', 6_800],
  ['أسامة جمال', 'بائع', 'cc-3', 6_500],
  ['وليد كمال', 'أمين مخزن', 'cc-3', 7_400],
  ['شادي فوزي', 'بائع', 'cc-4', 6_400],
  ['بسمة عاطف', 'كاشير', 'cc-4', 6_900],
  ['تامر صبحي', 'بائع', 'cc-5', 6_300],
  ['علاء الدين حمدي', 'مندوب توصيل', 'cc-8', 5_900],
  ['حسن مرسي', 'مندوب توصيل', 'cc-8', 5_700],
  ['دعاء رشاد', 'خدمة عملاء', 'cc-7', 7_200],
  ['مصطفى البنا', 'مصمم محتوى', 'cc-7', 9_800],
];

let state: EmployeesDb | null = null;

function db(): EmployeesDb {
  return (state ??= seed());
}

function seed(): EmployeesDb {
  const rand = seeded(3131);
  const employees: EmployeeRecord[] = SEED.map(([name, jobTitle, costCenterId, salary], i) => {
    const hireDays = 60 + Math.floor(rand() * 2400);
    return {
      id: `emp-${i + 1}`,
      code: `EMP-${String(i + 1).padStart(4, '0')}`,
      name,
      jobTitle,
      costCenterId,
      phone: `01${pick(rand, ['0', '1', '2', '5'])}${String(Math.floor(10_000_000 + rand() * 89_999_999))}`,
      nationalId: `2${String(Math.floor(85 + rand() * 15)).padStart(2, '0')}${String(Math.floor(1e10 + rand() * 8.9e10)).slice(0, 11)}`,
      hireDate: isoDaysAgo(hireDays),
      salary,
      // A few staff carry advances on the shared advances account.
      advancesAccountId: i % 4 === 1 ? 'acc-1106' : null,
      status: i === 15 ? 'leave' : i === 21 ? 'terminated' : 'active',
      notes: '',
      createdAt: new Date(Date.now() - hireDays * 86_400_000).toISOString(),
    };
  });
  return { employees, nextNo: employees.length + 1 };
}

export function employeeRows(): EmployeeRecord[] {
  return db().employees;
}

export function nextEmployeeNo(): number {
  return db().nextNo++;
}
