import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { AppValidators, validationMessage } from '../../../../shared/validators/app-validators';
import { CarModel } from '../../../cars/models/car.model';
import { CarCatalogService } from '../../../cars/services/car-catalog.service';
import {
  FitmentProblems,
  fitmentProblems,
  fitmentYearsLabel,
  ItemFitment,
  sortFitments,
  spanLabel,
  toFitmentPayload,
} from '../../models/item-fitment.model';
import { ItemFitmentsService } from '../../services/item-fitments.service';
import { ItemDraftService } from '../../services/item-draft.service';

/** Year typed in a box → number, or null when empty. */
const toYear = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

/**
 * The car models an item fits. Pick make → model → optional years; the list
 * is edited locally and saved in one PUT (which replaces every fitment).
 * Years are checked against the model's production span and against
 * overlaps with fitments already listed for the same model.
 */
@Component({
  selector: 'app-item-fitments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './item-fitments.component.html',
  styleUrl: './item-fitments.component.scss',
})
export class ItemFitmentsComponent {
  private readonly api = inject(ItemFitmentsService);
  private readonly cars = inject(CarCatalogService);
  private readonly toast = inject(ToastService);

  /** `null` = a new, unsaved item: the list goes to the draft and is saved right after the item. */
  readonly itemId = input<string | null>(null);

  /** Provided by the item screen; holds a new item's pending fitments. */
  private readonly setup = inject(ItemDraftService, { optional: true });
  protected readonly draftMode = computed(() => !this.itemId() && !!this.setup);

  protected readonly yearsLabel = fitmentYearsLabel;
  protected readonly spanLabel = spanLabel;

  // ── Saved list & local draft ──

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  private readonly saved = signal<ItemFitment[]>([]);
  protected readonly draft = signal<ItemFitment[]>([]);
  protected readonly dirty = computed(() => {
    const key = (l: readonly ItemFitment[]) => JSON.stringify(sortFitments(l).map(toFitmentPayload));
    return key(this.saved()) !== key(this.draft());
  });

  // ── Catalogue ──

  protected readonly makes = createQueryResource(signal(0), () => this.cars.makes(), { errorMessage: 'تعذّر تحميل الماركات' });
  protected readonly activeMakes = computed(() =>
    [...(this.makes.value() ?? [])].filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar')),
  );

  // ── Add form ──

  protected readonly makeId = signal('');
  protected readonly modelId = signal('');
  protected readonly yearFromRaw = signal('');
  protected readonly yearToRaw = signal('');
  /** Show problems only once the user tried to add (or typed a year). */
  protected readonly attempted = signal(false);

  protected readonly models = createQueryResource(this.makeId, (id) => this.cars.models(id), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الموديلات',
  });
  protected readonly activeModels = computed(() =>
    (this.models.value() ?? [])
      .filter((m) => m.makeId === this.makeId() && m.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.yearFrom - b.yearFrom),
  );
  protected readonly model = computed<CarModel | null>(() => this.activeModels().find((m) => m.id === this.modelId()) ?? null);

  /** Format problems of the year boxes (letters, fractions…), before range rules. */
  private readonly yearFormat = computed(() => ({
    yearFrom: validationMessage(AppValidators.wholeNumber('سنة البداية'), this.yearFromRaw()),
    yearTo: validationMessage(AppValidators.wholeNumber('سنة النهاية'), this.yearToRaw()),
  }));

  protected readonly problems = computed<FitmentProblems & { make?: string; model?: string }>(() => {
    if (!this.makeId()) return { make: 'اختر الماركة أولًا' };
    const model = this.model();
    if (!model) return { model: 'اختر الموديل' };
    const format = this.yearFormat();
    if (format.yearFrom || format.yearTo) return { yearFrom: format.yearFrom ?? undefined, yearTo: format.yearTo ?? undefined };
    return fitmentProblems(
      { modelId: model.id, yearFrom: toYear(this.yearFromRaw()), yearTo: toYear(this.yearToRaw()) },
      { name: model.name, yearFrom: model.yearFrom, yearTo: model.yearTo },
      this.draft(),
    );
  });
  protected readonly canAdd = computed(() => Object.values(this.problems()).every((p) => !p));

  constructor() {
    effect(() => {
      const id = this.itemId();
      untracked(() => {
        if (id) this.load(id);
        // New item: show what was added before switching tabs.
        else if (this.setup) this.draft.set(sortFitments(this.setup.fitments()));
      });
    });

    // New item: mirror the list into the draft (saved right after the item).
    effect(() => {
      const list = this.draft();
      if (this.draftMode()) untracked(() => this.setup!.setFitments(list));
    });
  }

  protected load(itemId = this.itemId()): void {
    if (!itemId) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .list(itemId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.apply(list),
        error: (err: ApiError) => this.loadError.set(err.message || 'تعذّر تحميل التوافقات'),
      });
  }

  protected selectMake(id: string): void {
    this.makeId.set(id);
    this.modelId.set('');
    this.attempted.set(false);
  }

  protected selectModel(id: string): void {
    this.modelId.set(id);
    this.attempted.set(false);
  }

  protected add(): void {
    this.attempted.set(true);
    const model = this.model();
    const make = this.activeMakes().find((m) => m.id === this.makeId());
    if (!this.canAdd() || !model || !make) return;
    const entry: ItemFitment = {
      modelId: model.id,
      modelName: model.name,
      makeId: make.id,
      makeName: make.name,
      yearFrom: toYear(this.yearFromRaw()),
      yearTo: toYear(this.yearToRaw()),
    };
    this.draft.update((list) => sortFitments([...list, entry]));
    // Keep the make (several models of one make are usually added together).
    this.modelId.set('');
    this.yearFromRaw.set('');
    this.yearToRaw.set('');
    this.attempted.set(false);
  }

  protected remove(f: ItemFitment): void {
    this.draft.update((list) => list.filter((x) => x !== f));
  }

  protected revert(): void {
    this.draft.set(this.saved());
  }

  protected save(): void {
    this.saving.set(true);
    const sent = this.draft();
    this.api
      .replace(this.itemId()!, sent.map(toFitmentPayload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (list) => {
          // Use the server's list when returned; otherwise what we sent is now the truth.
          this.apply(Array.isArray(list) ? list : sent);
          this.toast.success(sent.length ? `تم حفظ ${sent.length} توافق` : 'تم حذف كل التوافقات');
        },
        // The interceptor toasted the reason; keep the draft so nothing typed is lost.
      });
  }

  private apply(list: readonly ItemFitment[]): void {
    const sorted = sortFitments(list);
    this.saved.set(sorted);
    this.draft.set(sorted);
  }
}
