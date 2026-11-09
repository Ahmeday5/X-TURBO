import { Party, PartyKind } from '../../features/parties/models/party.model';
import { daysAgo, pick, seeded } from '../mock-utils';

/**
 * Customers & suppliers. `balance` / `lastMovementAt` are not stored — they
 * are derived from the ledger (see ledger.db.ts) whenever a party is served.
 */

export type PartyRecord = Omit<Party, 'balance' | 'lastMovementAt'>;

interface PartiesDb {
  parties: PartyRecord[];
  nextNo: number;
}

const CUSTOMERS = [
  'محمد عبد الله', 'سارة محمود', 'أحمد سمير', 'منى إبراهيم', 'كريم حسن', 'هبة علي', 'يوسف طارق', 'دينا فؤاد',
  'عمر خالد', 'نورهان مصطفى', 'إسلام رمضان', 'ريهام عادل', 'مصطفى شريف', 'آية حمدي', 'حسام الدين نبيل', 'شيماء أشرف',
];
const WORKSHOPS = [
  'مركز الأمل لصيانة السيارات', 'ورشة النصر للميكانيكا', 'مركز سبيد سيرفيس', 'ورشة الحرية للكهرباء',
  'توكيل الشروق للسيارات', 'مركز كار كير', 'ورشة الأخوين', 'شركة النيل للنقل', 'مركز الفارس لصيانة السيارات',
  'شركة المستقبل لتأجير السيارات', 'ورشة الدلتا للعفشة', 'مركز الصفوة أوتو',
];
const SUPPLIERS = [
  'الشركة المصرية لقطع الغيار', 'مؤسسة الخليج للتجارة', 'بوش مصر — الوكيل المعتمد', 'دينسو الشرق الأوسط',
  'المتحدة لاستيراد قطع الغيار', 'شركة الأهرام للزيوت', 'النجم للإطارات', 'مصنع العربي للبطاريات',
  'الدولية لقطع غيار السيارات الكورية', 'مؤسسة طيبة التجارية', 'شركة فالكون للإكسسوارات', 'الوطنية للفلاتر',
];
const CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'الزقازيق', '6 أكتوبر', 'بورسعيد'];
const STREETS = ['شارع التحرير', 'شارع الهرم', 'طريق الحرية', 'شارع عباس العقاد', 'شارع الجمهورية', 'شارع 26 يوليو'];

let state: PartiesDb | null = null;

function db(): PartiesDb {
  return (state ??= seed());
}

function phone(rand: () => number): string {
  return `01${pick(rand, ['0', '1', '2', '5'])}${String(Math.floor(10_000_000 + rand() * 89_999_999))}`;
}

function seed(): PartiesDb {
  const rand = seeded(777);
  const parties: PartyRecord[] = [];
  let customerNo = 0;
  let supplierNo = 0;

  const add = (name: string, kind: PartyKind, extra: Partial<PartyRecord> = {}) => {
    const isSupplier = kind === 'supplier';
    const n = isSupplier ? ++supplierNo : ++customerNo;
    const id = `pty-${isSupplier ? 's' : 'c'}${n}`;
    const city = pick(rand, CITIES);
    parties.push({
      id,
      code: `${isSupplier ? 'SU' : 'CU'}-${String(n).padStart(5, '0')}`,
      kind,
      name,
      phone: phone(rand),
      phone2: rand() > 0.7 ? phone(rand) : '',
      email: '',
      city,
      address: `${Math.floor(1 + rand() * 120)} ${pick(rand, STREETS)}، ${city}`,
      taxNumber: '',
      commercialRegister: '',
      creditLimit: 0,
      paymentTermDays: 0,
      priceList: 'retail',
      openingBalance: 0,
      notes: '',
      isActive: true,
      isExternal: false,
      createdAt: daysAgo(200 + Math.floor(rand() * 500)),
      ...extra,
    });
  };

  CUSTOMERS.forEach((name, i) =>
    add(name, 'customer', { isActive: i !== 13, openingBalance: i % 5 === 0 ? Math.round(rand() * 30) * 100 : 0 }),
  );
  WORKSHOPS.forEach((name, i) =>
    add(name, i === 4 ? 'both' : 'customer', {
      priceList: 'wholesale',
      creditLimit: [150_000, 250_000, 100_000, 400_000][i % 4],
      paymentTermDays: [15, 30, 45][i % 3],
      taxNumber: String(100_000_000 + Math.floor(rand() * 899_999_999)),
      commercialRegister: String(10_000 + Math.floor(rand() * 89_999)),
      email: `info${i + 1}@workshop.eg`,
      openingBalance: Math.round(rand() * 250) * 100,
    }),
  );
  SUPPLIERS.forEach((name, i) =>
    add(name, 'supplier', {
      priceList: 'wholesale',
      paymentTermDays: [30, 60, 45][i % 3],
      taxNumber: String(200_000_000 + Math.floor(rand() * 799_999_999)),
      commercialRegister: String(20_000 + Math.floor(rand() * 79_999)),
      email: `sales${i + 1}@supplier.eg`,
      openingBalance: -Math.round(rand() * 900) * 100,
      isActive: i !== 11,
    }),
  );
  // Walk-in customers registered from the POS.
  ['عميل نقدي — طارق', 'عميل نقدي — مروة', 'عميل نقدي — باسم', 'عميل نقدي — هالة'].forEach((name) =>
    add(name, 'customer', { isExternal: true, address: '', createdAt: daysAgo(Math.floor(rand() * 40)) }),
  );

  return { parties, nextNo: parties.length + 1 };
}

export function partyRows(): PartyRecord[] {
  return db().parties;
}

/** Next sequence for a new code — customers and suppliers are numbered separately. */
export function nextPartyCode(kind: PartyKind): string {
  const isSupplier = kind === 'supplier';
  const prefix = isSupplier ? 'SU' : 'CU';
  const max = db().parties
    .filter((p) => p.code.startsWith(prefix))
    .reduce((m, p) => Math.max(m, Number(p.code.slice(3)) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(5, '0')}`;
}

export function newPartyId(): string {
  return `pty-n${db().nextNo++}`;
}
