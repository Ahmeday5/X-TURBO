import { POS_PAYMENT_METHODS, POS_CASH_ACCOUNTS, PosSettingsPayload } from '../../features/pos/models/pos-settings.model';
import { POS_ENDPOINTS } from '../../features/pos/services/pos-settings.service';
import { actorName } from '../db/db-utils';
import { posSettings, setPosSettings } from '../db/pos-settings.db';
import { warehouseRows } from '../db/warehouses.db';
import { bodyOf } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';

function getSettings() {
  return ok(posSettings());
}

function saveSettings({ req, userId }: MockContext) {
  const p = bodyOf<PosSettingsPayload>(req.body);
  if (p.warehouseId) {
    const wh = warehouseRows().find((w) => w.id === p.warehouseId);
    if (!wh) throw fail(404, 'المخزن غير موجود', req.url);
    if (!wh.isActive) throw fail(422, `المخزن «${wh.name}» موقوف`, req.url);
  }
  if (!POS_CASH_ACCOUNTS.some((a) => a.id === p.cashAccountId)) throw fail(422, 'اختر الخزينة', req.url);
  const methods = POS_PAYMENT_METHODS.filter((m) => p.paymentMethods?.includes(m));
  if (!methods.length) throw fail(422, 'فعّل طريقة دفع واحدة على الأقل', req.url);
  const tax = Number(p.defaultTaxPct);
  if (!(tax >= 0 && tax <= 100)) throw fail(422, 'نسبة الضريبة يجب أن تكون بين 0 و 100', req.url);
  const maxDiscount = Number(p.maxDiscountPct);
  if (!(maxDiscount >= 0 && maxDiscount <= 100)) throw fail(422, 'أقصى خصم يجب أن يكون بين 0 و 100', req.url);

  const next = {
    warehouseId: p.warehouseId || null,
    cashAccountId: p.cashAccountId,
    paymentMethods: methods,
    defaultTaxPct: tax,
    allowDiscount: !!p.allowDiscount,
    maxDiscountPct: p.allowDiscount ? maxDiscount : 0,
    receiptHeader: (p.receiptHeader ?? '').trim().slice(0, 300),
    receiptFooter: (p.receiptFooter ?? '').trim().slice(0, 300),
    paperWidth: p.paperWidth === 58 ? 58 : 80,
    autoPrint: !!p.autoPrint,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName(userId),
  } as const;
  setPosSettings({ ...next, paymentMethods: [...next.paymentMethods] });
  return ok(posSettings());
}

export const POS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: POS_ENDPOINTS.settings, protected: true, handle: getSettings },
  { method: 'PUT', path: POS_ENDPOINTS.settings, protected: true, handle: saveSettings },
];
