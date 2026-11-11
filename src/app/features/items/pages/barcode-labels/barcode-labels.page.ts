import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatFullDate, formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { ItemPickerComponent } from '../../../documents/components/item-picker/item-picker.component';
import { DocumentsService } from '../../../documents/services/documents.service';
import { ItemLookup } from '../../../warehouses/models/stock.model';
import { StockService } from '../../../warehouses/services/stock.service';
import { LabelPreviewComponent } from '../../components/label-preview/label-preview.component';
import {
  DEFAULT_FIELDS,
  DEFAULT_TEMPLATE_ID,
  LABEL_FIELD_OPTIONS,
  LABEL_TEMPLATES,
  LabelFields,
  LabelRow,
  LabelSettings,
  labelValue,
  MAX_COPIES,
  MAX_LABELS_PER_JOB,
  templateById,
} from '../../models/barcode-label.model';
import { printLabels } from '../../utils/print-labels';

const SETTINGS_KEY = 'xturbo.barcode-labels.settings';
/** Recent purchase invoices offered as a source (the usual "label what just arrived" flow). */
const RECENT_PURCHASES = 50;

/** Shown when the queue is empty — every field filled, so the layout can be judged. */
const SAMPLE_ITEM: ItemLookup = {
  id: 'sample',
  code: 'ITM-00042',
  name: 'تيل فرامل أمامي — تويوتا كورولا',
  unit: 'قطعة',
  barcode: '2001234567893',
  brand: 'بوش',
  groupId: '',
  groupName: '',
  groupColor: '',
  salePrice: 850,
  purchasePrice: 600,
  stock: 0,
  available: 0,
} as ItemLookup;

/**
 * Barcode label printing: build a queue (pick items, or pull a purchase invoice's
 * lines with their quantities), choose the label stock and fields, preview, print.
 * Deep links: `?items=id1,id2` (items directory) and `?doc=<id>` (document drawer).
 */
@Component({
  selector: 'app-barcode-labels-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    ItemPickerComponent,
    LabelPreviewComponent,
    PageHeaderComponent,
    RouterLink,
    SearchableSelectComponent,
  ],
  templateUrl: './barcode-labels.page.html',
  styleUrl: './barcode-labels.page.scss',
})
export class BarcodeLabelsPage {
  private readonly stock = inject(StockService);
  private readonly documents = inject(DocumentsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly catalogue = createQueryResource(signal(true), () => this.stock.itemLookup(), {
    errorMessage: 'تعذّر تحميل الأصناف',
  });
  protected readonly purchases = createQueryResource(
    signal(true),
    () =>
      this.documents
        .list('purchase', {
          pageIndex: 1,
          pageSize: RECENT_PURCHASES,
          search: '',
          sort: { key: 'date', dir: 'desc' },
          filters: {},
        })
        .pipe(
          map((page): SearchableSelectOption[] =>
            page.data
              .filter((d) => d.status !== 'cancelled')
              .map((d) => ({
                value: d.id,
                label: d.number,
                hint: [d.partyName, formatFullDate(d.date), `${formatInteger(d.totalQty)} قطعة`].filter(Boolean).join(' · '),
              })),
          ),
        ),
    { errorMessage: 'تعذّر تحميل فواتير المشتريات' },
  );

  protected readonly rows = signal<LabelRow[]>([]);
  protected readonly settings = signal<LabelSettings>(loadSettings());
  protected readonly loadingDoc = signal(false);
  /** Picker value; cleared after its lines are added so the same invoice can be picked again. */
  protected readonly docId = signal('');

  protected readonly templates = LABEL_TEMPLATES;
  protected readonly fieldOptions = LABEL_FIELD_OPTIONS;
  protected readonly maxCopies = MAX_COPIES;

  protected readonly template = computed(() => templateById(this.settings().templateId));
  protected readonly fields = computed(() => this.settings().fields);
  protected readonly totalLabels = computed(() => this.rows().reduce((sum, r) => sum + r.copies, 0));
  /** Items printed with their code because they have no barcode. */
  protected readonly withoutBarcode = computed(() => this.rows().filter((r) => !r.item.barcode?.trim()));
  protected readonly previewRow = computed(() => this.rows()[0] ?? { item: SAMPLE_ITEM });
  protected readonly isSample = computed(() => !this.rows().length);
  protected readonly sheetsNeeded = computed(() => {
    const t = this.template();
    return t.stock === 'sheet' ? Math.ceil(this.totalLabels() / ((t.columns ?? 1) * (t.rows ?? 1))) : null;
  });

  protected readonly priceOf = (item: ItemLookup) => item.salePrice;
  protected readonly value = labelValue;
  protected readonly money = formatMoney;
  protected readonly integer = formatInteger;

  constructor() {
    effect(() => saveSettings(this.settings()));

    // Deep links are applied once, as soon as the catalogue is available.
    let applied = false;
    effect(() => {
      const items = this.catalogue.value();
      if (!items || applied) return;
      applied = true;
      untracked(() => this.applyDeepLinks(items));
    });
  }

  protected add(item: ItemLookup, copies = 1): void {
    this.rows.update((rows) => {
      const i = rows.findIndex((r) => r.item.id === item.id);
      if (i < 0) return [...rows, { item, copies: clampCopies(copies) }];
      return rows.map((r, j) => (j === i ? { ...r, copies: clampCopies(r.copies + copies) } : r));
    });
  }

  protected setCopies(index: number, raw: number | string): void {
    const copies = clampCopies(Number(raw));
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, copies } : r)));
  }

  /** Same number of labels for every row (e.g. one each for a shelf refresh). */
  protected setAllCopies(raw: number | string): void {
    const copies = clampCopies(Number(raw));
    this.rows.update((rows) => rows.map((r) => ({ ...r, copies })));
  }

  protected remove(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected clear(): void {
    this.rows.set([]);
  }

  protected setTemplate(templateId: string): void {
    this.settings.update((s) => ({ ...s, templateId }));
  }

  protected toggleField(key: keyof LabelFields): void {
    this.settings.update((s) => ({ ...s, fields: { ...s.fields, [key]: !s.fields[key] } }));
  }

  /** Adds every line of a document, one label per unit received. */
  protected loadDocument(id: string | number | null): void {
    const docId = String(id ?? '');
    if (!docId) return;
    this.docId.set(docId);
    const catalogue = this.catalogue.value() ?? [];
    this.loadingDoc.set(true);
    this.documents
      .get(docId)
      .pipe(finalize(() => this.loadingDoc.set(false)))
      .subscribe((doc) => {
        let added = 0;
        for (const line of doc.lines) {
          const item = catalogue.find((i) => i.id === line.itemId);
          if (!item) continue;
          this.add(item, Math.max(1, Math.round(line.qty)));
          added++;
        }
        const skipped = doc.lines.length - added;
        this.toast.success(`تمت إضافة ${formatInteger(added)} صنف من ${doc.number}${skipped ? ` — تم تخطي ${skipped} صنف موقوف` : ''}`);
        this.docId.set('');
      });
  }

  protected print(): void {
    const total = this.totalLabels();
    if (!total) {
      this.toast.error('أضف صنفًا واحدًا على الأقل للطباعة');
      return;
    }
    if (total > MAX_LABELS_PER_JOB) {
      this.toast.error(`عدد الملصقات ${formatInteger(total)} أكبر من الحد (${formatInteger(MAX_LABELS_PER_JOB)}) في المرة الواحدة — قسّمها على أكثر من طباعة`);
      return;
    }
    if (!printLabels(this.rows(), this.template(), this.fields())) {
      this.toast.error('المتصفح منع نافذة الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة');
    }
  }

  private applyDeepLinks(catalogue: readonly ItemLookup[]): void {
    const params = this.route.snapshot.queryParamMap;
    const ids = (params.get('items') ?? '').split(',').filter(Boolean);
    for (const id of ids) {
      const item = catalogue.find((i) => i.id === id);
      if (item) this.add(item);
    }
    const doc = params.get('doc');
    if (doc) this.loadDocument(doc);
  }
}

function clampCopies(n: number): number {
  return Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(1, Math.round(n))) : 1;
}

/** Per-device preference (each counter has its own label printer). */
function loadSettings(): LabelSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<LabelSettings> | null;
    return {
      templateId: templateById(saved?.templateId ?? DEFAULT_TEMPLATE_ID).id,
      fields: { ...DEFAULT_FIELDS, ...(saved?.fields ?? {}) },
    };
  } catch {
    return { templateId: DEFAULT_TEMPLATE_ID, fields: { ...DEFAULT_FIELDS } };
  }
}

function saveSettings(settings: LabelSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}
