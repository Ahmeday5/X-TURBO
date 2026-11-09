import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../../core/services/toast.service';
import { DrawerComponent } from '../../../../../shared/components/drawer/drawer.component';
import { FormErrorComponent } from '../../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../../shared/components/searchable-select/searchable-select.component';
import { formatMoney } from '../../../../../shared/utils/format.util';
import { CostCenter, CostCenterPayload } from '../../../models/cost-center.model';
import { CostCentersService } from '../../../services/cost-centers.service';

/** Swatches offered for a center's colour (charts, tags, employee departments). */
export const COST_CENTER_COLORS: readonly string[] = [
  '#e31e24', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b',
];

/** Create / edit a cost center in a side drawer. */
@Component({
  selector: 'app-cost-center-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DrawerComponent, FormErrorComponent, IconComponent, SearchableSelectComponent],
  templateUrl: './cost-center-editor.component.html',
  styleUrl: './cost-center-editor.component.scss',
})
export class CostCenterEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CostCentersService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  /** `null` → new center. */
  readonly center = input<CostCenter | null>(null);
  /** Every center (parent picker). */
  readonly centers = input<readonly CostCenter[]>([]);
  readonly closed = output<void>();
  readonly saved = output<CostCenter>();

  protected readonly palette = COST_CENTER_COLORS;
  protected readonly money = formatMoney;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    parentId: [''],
    manager: ['', Validators.maxLength(60)],
    annualBudget: [0, [Validators.min(0), Validators.max(1_000_000_000)]],
    color: [COST_CENTER_COLORS[0]],
    notes: ['', Validators.maxLength(300)],
    isActive: [true],
  });

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly value = computed(() => ({ ...this.form.getRawValue(), ...this.draft() }));
  protected readonly isEdit = computed(() => !!this.center());

  /** Excludes the center itself and its descendants (no cycles). */
  protected readonly parentOptions = computed<SearchableSelectOption[]>(() => {
    const all = this.centers();
    const self = this.center()?.id;
    const blocked = new Set<string>();
    if (self) {
      blocked.add(self);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of all) {
          if (c.parentId && blocked.has(c.parentId) && !blocked.has(c.id)) {
            blocked.add(c.id);
            grew = true;
          }
        }
      }
    }
    return [
      { value: '', label: '— بدون (مركز رئيسي) —' },
      ...all
        .filter((c) => !blocked.has(c.id) && (c.isActive || c.id === this.center()?.parentId))
        .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}`, hint: c.manager || undefined })),
    ];
  });

  /** Monthly allowance implied by the annual budget. */
  protected readonly monthly = computed(() => Math.round((Number(this.value().annualBudget) || 0) / 12));

  constructor() {
    effect(() => {
      const open = this.open();
      const c = this.center();
      if (open) untracked(() => this.reset(c));
    });
  }

  protected pickColor(color: string): void {
    this.form.controls.color.setValue(color);
    this.form.controls.color.markAsDirty();
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    const payload: CostCenterPayload = {
      name: v.name.trim(),
      parentId: v.parentId || null,
      manager: v.manager.trim(),
      annualBudget: Math.max(0, Number(v.annualBudget) || 0),
      color: v.color,
      notes: v.notes.trim(),
      isActive: v.isActive,
    };
    const id = this.center()?.id;
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload)).pipe(finalize(() => this.saving.set(false))).subscribe((cc) => {
      this.toast.success(id ? 'تم تحديث مركز التكلفة' : `تم إضافة المركز ${cc.code} — ${cc.name}`);
      this.saved.emit(cc);
    });
  }

  private reset(c: CostCenter | null): void {
    if (c) {
      this.form.reset({
        name: c.name,
        parentId: c.parentId ?? '',
        manager: c.manager,
        annualBudget: c.annualBudget,
        color: c.color,
        notes: c.notes,
        isActive: c.isActive,
      });
    } else {
      // Suggest the next unused swatch.
      const used = new Set(this.centers().map((x) => x.color));
      this.form.reset({ color: COST_CENTER_COLORS.find((x) => !used.has(x)) ?? COST_CENTER_COLORS[this.centers().length % COST_CENTER_COLORS.length] });
    }
  }
}
