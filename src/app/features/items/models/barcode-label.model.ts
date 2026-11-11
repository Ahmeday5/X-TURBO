import { ItemLookup } from '../../warehouses/models/stock.model';

/**
 * Barcode label printing. Two kinds of stock:
 *  - `roll`  — thermal label printers (Xprinter, Zebra, TSC…): one label per printed page,
 *              the page size IS the label size.
 *  - `sheet` — A4 sticker sheets on a normal printer: a fixed grid per page.
 */
export type LabelStock = 'roll' | 'sheet';

export interface LabelTemplate {
  id: string;
  label: string;
  stock: LabelStock;
  /** Label size (mm). */
  width: number;
  height: number;
  /** Sheets only: grid, page margins and gaps (mm). */
  columns?: number;
  rows?: number;
  marginTop?: number;
  marginSide?: number;
  gapX?: number;
  gapY?: number;
}

export const LABEL_TEMPLATES: readonly LabelTemplate[] = [
  { id: 'roll-38x25', label: 'رول حراري 38×25 مم', stock: 'roll', width: 38, height: 25 },
  { id: 'roll-50x25', label: 'رول حراري 50×25 مم', stock: 'roll', width: 50, height: 25 },
  { id: 'roll-50x30', label: 'رول حراري 50×30 مم', stock: 'roll', width: 50, height: 30 },
  { id: 'roll-58x40', label: 'رول حراري 58×40 مم', stock: 'roll', width: 58, height: 40 },
  {
    id: 'a4-3x8',
    label: 'ورق A4 — 24 ملصق (3×8، 70×37 مم)',
    stock: 'sheet',
    width: 70,
    height: 37,
    columns: 3,
    rows: 8,
    marginTop: 0.5,
    marginSide: 0,
    gapX: 0,
    gapY: 0,
  },
  {
    id: 'a4-4x10',
    label: 'ورق A4 — 40 ملصق (4×10، 48.5×25.4 مم)',
    stock: 'sheet',
    width: 48.5,
    height: 25.4,
    columns: 4,
    rows: 10,
    marginTop: 21.5,
    marginSide: 8,
    gapX: 0,
    gapY: 0,
  },
];

export const DEFAULT_TEMPLATE_ID = 'roll-38x25';

/** What appears on each label besides the bars. */
export interface LabelFields {
  name: boolean;
  /** Item code (SKU). */
  code: boolean;
  price: boolean;
  brand: boolean;
  /** Human-readable digits under the bars. */
  barcodeText: boolean;
  /** Company name at the top. */
  company: boolean;
}

export const DEFAULT_FIELDS: LabelFields = {
  name: true,
  code: true,
  price: true,
  brand: false,
  barcodeText: true,
  company: false,
};

export const LABEL_FIELD_OPTIONS: readonly { key: keyof LabelFields; label: string }[] = [
  { key: 'name', label: 'اسم الصنف' },
  { key: 'code', label: 'كود الصنف (SKU)' },
  { key: 'price', label: 'سعر البيع' },
  { key: 'brand', label: 'الماركة' },
  { key: 'barcodeText', label: 'رقم الباركود تحت الخطوط' },
  { key: 'company', label: 'اسم الشركة' },
];

export interface LabelSettings {
  templateId: string;
  fields: LabelFields;
}

/** One item in the print queue. */
export interface LabelRow {
  item: ItemLookup;
  copies: number;
}

export const MAX_COPIES = 500;
/** Guard against an accidental 50k-page print job. */
export const MAX_LABELS_PER_JOB = 3000;

/**
 * What the bars encode: the item's barcode, or its code (SKU) when it has none —
 * scanning either finds the item in POS and invoices.
 */
export const labelValue = (item: Pick<ItemLookup, 'barcode' | 'code'>): string => item.barcode?.trim() || item.code;

export const templateById = (id: string): LabelTemplate =>
  LABEL_TEMPLATES.find((t) => t.id === id) ?? LABEL_TEMPLATES[0];
