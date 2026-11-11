import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { shouldActivateRow } from '../../../../shared/utils/row-activation.util';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { formatInteger } from '../../../../shared/utils/format.util';
import { CarMakeDialogComponent } from '../../components/car-make-dialog/car-make-dialog.component';
import { CarModelDialogComponent } from '../../components/car-model-dialog/car-model-dialog.component';
import {
  CAR_ERROR_CODES,
  CarMake,
  CarModel,
  modelYearsLabel,
  toCarMakePayload,
  toCarModelPayload,
} from '../../models/car.model';
import { CarCatalogService } from '../../services/car-catalog.service';
import { toCarMakeDetails, toCarModelDetails } from '../../utils/car-details';
import { DetailsDrawerComponent } from '../../../../shared/components/details-drawer/details-drawer.component';

/**
 * Car makes & models (master–detail): makes on one side, the selected make's
 * models on the other. Feeds item fitments and the mobile app's car picker.
 * Gated by `Items.View`.
 */
@Component({
  selector: 'app-car-catalog-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, CarMakeDialogComponent, CarModelDialogComponent, DetailsDrawerComponent],
  templateUrl: './car-catalog.page.html',
  styleUrl: './car-catalog.page.scss',
})
export class CarCatalogPage {
  private readonly api = inject(CarCatalogService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly int = formatInteger;
  protected readonly years = modelYearsLabel;

  // ── Makes ──

  protected readonly makes = createQueryResource(signal(0), () => this.api.makes(), {
    errorMessage: 'تعذّر تحميل الماركات',
  });
  protected readonly makeSearch = signal('');
  protected readonly visibleMakes = computed(() => {
    const tokens = tokenize(this.makeSearch());
    return [...(this.makes.value() ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'))
      .filter((m) => matchesAll([m.name, m.nameEn ?? ''], tokens));
  });
  protected readonly nextSortOrder = computed(() =>
    (this.makes.value() ?? []).reduce((max, m) => Math.max(max, m.sortOrder + 1), 0),
  );

  protected readonly selectedMakeId = signal<string | null>(null);
  protected readonly selectedMake = computed(
    () => this.makes.value()?.find((m) => m.id === this.selectedMakeId()) ?? null,
  );

  // ── Models of the selected make ──

  protected readonly models = createQueryResource(this.selectedMakeId, (id) => this.api.models(id), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الموديلات',
  });
  /** Ignore a previous make's models while the next ones load. */
  protected readonly currentModels = computed(() => {
    const id = this.selectedMakeId();
    const list = this.models.value() ?? [];
    return list.filter((m) => m.makeId === id).sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.yearFrom - b.yearFrom);
  });

  // ── Dialogs ──

  protected readonly makeDialogOpen = signal(false);
  protected readonly editingMake = signal<CarMake | null>(null);
  protected readonly modelDialogOpen = signal(false);
  protected readonly editingModel = signal<CarModel | null>(null);
  protected readonly busyId = signal<string | null>(null);

  // ── Details drawer (👁) — built from the row: the API has no GET by id for makes / models ──
  protected readonly viewing = signal<{ kind: 'make'; make: CarMake } | { kind: 'model'; model: CarModel } | null>(null);

  /** A click anywhere on a model row opens its details (its buttons keep their own action). */
  protected openModelRow(model: CarModel, event: Event): void {
    if (shouldActivateRow(event)) this.viewing.set({ kind: 'model', model });
  }
  protected readonly details = computed(() => {
    const v = this.viewing();
    return !v ? null : v.kind === 'make' ? toCarMakeDetails(v.make) : toCarModelDetails(v.model);
  });

  protected editViewed(): void {
    const v = this.viewing();
    this.viewing.set(null);
    if (v?.kind === 'make') this.editMake(v.make);
    else if (v?.kind === 'model') this.editModel(v.model);
  }

  constructor() {
    // Keep a valid selection: first make by default, and after the selected one is deleted.
    effect(() => {
      const list = this.visibleMakes();
      const all = this.makes.value() ?? [];
      untracked(() => {
        const id = this.selectedMakeId();
        if (!id || !all.some((m) => m.id === id)) this.selectedMakeId.set(list[0]?.id ?? null);
      });
    });
  }

  protected selectMake(m: CarMake): void {
    this.selectedMakeId.set(m.id);
  }

  protected refresh(): void {
    this.makes.reload();
    this.models.reload();
  }

  // ── Make actions ──

  protected newMake(): void {
    this.editingMake.set(null);
    this.makeDialogOpen.set(true);
  }

  protected editMake(m: CarMake): void {
    this.editingMake.set(m);
    this.makeDialogOpen.set(true);
  }

  protected onMakeSaved(m: CarMake): void {
    this.makeDialogOpen.set(false);
    this.selectedMakeId.set(m.id);
    this.makes.reload();
  }

  protected async removeMake(m: CarMake): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف الماركة',
      message: `سيتم حذف «${m.name}» نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.busyId.set(m.id);
    this.api.deleteMake(m.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(`تم حذف ${m.name}`);
        this.makes.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (hasErrorCode(err, CAR_ERROR_CODES.makeHasModels)) void this.resolveMakeHasModels(m, err.message);
        else this.toast.error(err.message);
      },
    });
  }

  /** A make with models can't be deleted — offer to hide it from the app instead. */
  private async resolveMakeHasModels(m: CarMake, serverMessage: string): Promise<void> {
    const reason = serverMessage || `«${m.name}» تحتها موديلات.`;
    if (!m.isActive) {
      this.toast.error(`${reason} احذف موديلاتها أولًا.`);
      return;
    }
    const deactivate = await this.dialog.confirm({
      title: 'لا يمكن حذف الماركة',
      message: `${reason}\nاحذف موديلاتها أولًا، أو أوقف الماركة لتختفي من التطبيق مع بقاء بياناتها.`,
      confirmText: 'إيقاف الماركة',
      type: 'warning',
    });
    if (!deactivate) return;
    this.api.updateMake(m.id, toCarMakePayload(m, { isActive: false })).subscribe(() => {
      this.toast.success(`تم إيقاف ${m.name}`);
      this.makes.reload();
    });
  }

  // ── Model actions ──

  protected newModel(): void {
    this.editingModel.set(null);
    this.modelDialogOpen.set(true);
  }

  protected editModel(m: CarModel): void {
    this.editingModel.set(m);
    this.modelDialogOpen.set(true);
  }

  protected onModelSaved(m: CarModel): void {
    this.modelDialogOpen.set(false);
    // The model may have been moved to another make — follow it.
    this.selectedMakeId.set(m.makeId);
    this.models.reload();
    this.makes.reload(); // models count
  }

  protected async removeModel(m: CarModel): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف الموديل',
      message: `سيتم حذف «${m.makeName} ${m.name}» نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.busyId.set(m.id);
    this.api.deleteModel(m.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(`تم حذف ${m.name}`);
        this.models.reload();
        this.makes.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (hasErrorCode(err, CAR_ERROR_CODES.modelInUse)) void this.resolveModelInUse(m, err.message);
        else this.toast.error(err.message);
      },
    });
  }

  /** A model linked to item fitments / customers' cars can't be deleted — offer to deactivate it. */
  private async resolveModelInUse(m: CarModel, serverMessage: string): Promise<void> {
    const reason = serverMessage || `«${m.name}» مرتبط بتوافقات أصناف أو بسيارات عملاء.`;
    if (!m.isActive) {
      this.toast.error(`${reason} الموديل موقوف بالفعل.`);
      return;
    }
    const deactivate = await this.dialog.confirm({
      title: 'لا يمكن حذف الموديل',
      message: `${reason}\nهل تريد إيقافه بدلًا من ذلك؟ يختفي من التطبيق وتبقى التوافقات المسجلة كما هي.`,
      confirmText: 'إيقاف الموديل',
      type: 'warning',
    });
    if (!deactivate) return;
    this.api.updateModel(m.id, toCarModelPayload(m, { isActive: false })).subscribe(() => {
      this.toast.success(`تم إيقاف ${m.name}`);
      this.models.reload();
    });
  }
}
