import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, filter, finalize, last, map, Observable, of, switchMap } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  findGroup,
  flattenGroups,
  GROUP_COLORS,
  GROUP_ERROR_CODES,
  GROUP_IMAGE_RULES,
  ItemGroup,
  ItemGroupNode,
  ItemGroupPayload,
  subtreeIds,
} from '../../models/item-group.model';
import { ItemGroupsService } from '../../services/item-groups.service';

interface ParentOption {
  id: string;
  /** Indented for the native select ("— — تيل"). */
  label: string;
  /** Holds items → can't take sub-groups (409 GROUP_HAS_ITEMS). */
  blocked: boolean;
}

/** Image change to apply after the group itself is saved. */
type ImageChange = { kind: 'upload'; file: File; previewUrl: string } | { kind: 'remove' } | null;

/**
 * Create / edit an item group in a modal: name, parent (any group in the tree
 * except itself / its own sub-groups / groups that hold items), description,
 * colour, status and its single image. `group` null → create; `parentId`
 * pre-selects a parent ("add sub-group" from the tree).
 */
@Component({
  selector: 'app-group-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  templateUrl: './group-form-dialog.component.html',
  styleUrl: './group-form-dialog.component.scss',
})
export class GroupFormDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly groups = inject(ItemGroupsService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly group = input<ItemGroup | null>(null);
  /** The whole hierarchy (from `GET item-groups/tree`). */
  readonly tree = input<readonly ItemGroupNode[]>([]);
  /** Pre-selected parent when creating. */
  readonly parentId = input<string | null>(null);
  /** "Turn into a sub-group": a main group holding items must get a parent. */
  readonly requireParent = input(false);

  readonly closed = output<void>();
  readonly saved = output<ItemGroup>();

  protected readonly colors = GROUP_COLORS;
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.group());

  protected readonly imageChange = signal<ImageChange>(null);
  protected readonly imageError = signal<string | null>(null);
  /** What the preview shows: the picked file, nothing (removed), or the saved image. */
  protected readonly imageSrc = computed(() => {
    const change = this.imageChange();
    if (change?.kind === 'upload') return change.previewUrl;
    if (change?.kind === 'remove') return null;
    return this.group()?.imageUrl ?? null;
  });
  protected readonly acceptTypes = GROUP_IMAGE_RULES.types.join(',');

  /** Every group except the edited one and its descendants (a group can't move under itself). */
  protected readonly parentOptions = computed<ParentOption[]>(() => {
    const editing = this.group();
    const node = editing ? findGroup(this.tree(), editing.id) : null;
    const excluded = node ? subtreeIds(node) : new Set<string>();
    return flattenGroups(this.tree())
      .filter((g) => !excluded.has(g.node.id))
      .map((g) => ({
        id: g.node.id,
        label: `${'— '.repeat(g.depth)}${g.node.name}${g.node.itemsCount ? ` (فيها ${g.node.itemsCount} صنف)` : ''}`,
        blocked: g.node.itemsCount > 0 && g.node.id !== editing?.parentId,
      }));
  });

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    parentId: [''],
    description: ['', Validators.maxLength(200)],
    color: [GROUP_COLORS[0] as string],
    isActive: [true],
  });

  constructor() {
    // Re-seed the form each time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      const g = this.group();
      const parentId = this.parentId();
      const requireParent = this.requireParent();
      untracked(() => {
        const parent = this.form.controls.parentId;
        parent.setValidators(
          requireParent
            ? (c) =>
                c.value
                  ? null
                  : { parentRequired: 'اختر المجموعة الرئيسية التي ستنتقل تحتها — الأصناف تكون تحت المجموعات الفرعية فقط' }
            : null,
        );
        this.clearImageChange();
        this.imageError.set(null);
        this.form.reset(
          g
            ? { name: g.name, parentId: g.parentId ?? '', description: g.description, color: g.color, isActive: g.isActive }
            : { parentId: parentId ?? '' },
        );
      });
    });
    inject(DestroyRef).onDestroy(() => this.clearImageChange());
  }

  protected pickImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be picked again after removing it
    if (!file) return;
    const problem = imageProblem(file);
    this.imageError.set(problem);
    if (problem) return;
    this.clearImageChange();
    this.imageChange.set({ kind: 'upload', file, previewUrl: URL.createObjectURL(file) });
  }

  protected removeImage(): void {
    const hadSaved = !!this.group()?.imageUrl;
    this.clearImageChange();
    this.imageChange.set(hadSaved ? { kind: 'remove' } : null);
    this.imageError.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const blocked = this.parentOptions().find((p) => p.id === v.parentId)?.blocked;
    if (blocked) {
      this.form.controls.parentId.setErrors({
        server: 'المجموعة المختارة تحتوي على أصناف، فلا يمكن إضافة فروع تحتها — انقل أصنافها أولًا أو اختر مجموعة أخرى',
      });
      this.form.controls.parentId.markAsTouched();
      return;
    }
    const payload: ItemGroupPayload = {
      ...v,
      name: v.name.trim(),
      description: v.description.trim(),
      parentId: v.parentId || null,
    };
    const id = this.group()?.id;
    this.saving.set(true);
    (id ? this.groups.update(id, payload) : this.groups.create(payload))
      .pipe(
        switchMap((group) => this.applyImage(group)),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: ({ group, imageFailed }) => {
          if (imageFailed) this.toast.warning(`تم حفظ المجموعة، لكن تعذّر تحديث الصورة: ${imageFailed}`);
          else this.toast.success(id ? 'تم تحديث المجموعة' : 'تم إضافة المجموعة');
          this.clearImageChange();
          this.saved.emit(group);
        },
        // 409 GROUP_HAS_ITEMS → under the parent field; 422 (e.g. moved under its own sub-group) → toast + fields.
        error: (err: ApiError) => {
          if (hasErrorCode(err, GROUP_ERROR_CODES.hasItems)) {
            this.form.controls.parentId.setErrors({ server: err.message });
            this.form.controls.parentId.markAsTouched();
            return;
          }
          applyServerErrors(this.form, err);
        },
      });
  }

  /** Runs the pending image change; an image failure doesn't undo the saved group. */
  private applyImage(group: ItemGroup): Observable<{ group: ItemGroup; imageFailed: string | null }> {
    const change = this.imageChange();
    if (!change) return of({ group, imageFailed: null });
    const request: Observable<ItemGroup> =
      change.kind === 'upload'
        ? this.groups.uploadImage(group.id, change.file).pipe(
            filter((e) => e.kind === 'done'),
            last(),
            map((e) => (e.kind === 'done' ? e.value : group)),
          )
        : this.groups.removeImage(group.id);
    return request.pipe(
      map((updated) => ({ group: updated ?? group, imageFailed: null as string | null })),
      catchError((err: ApiError) => of({ group, imageFailed: err.message })),
    );
  }

  private clearImageChange(): void {
    const change = this.imageChange();
    if (change?.kind === 'upload') URL.revokeObjectURL(change.previewUrl);
    this.imageChange.set(null);
  }
}

/** Client-side check mirroring the server's IMAGE_TYPE_NOT_ALLOWED / IMAGE_TOO_LARGE. */
function imageProblem(file: File): string | null {
  if (!GROUP_IMAGE_RULES.types.includes(file.type)) {
    return `نوع الملف «${file.name}» غير مدعوم — اختر صورة JPG أو PNG أو WEBP`;
  }
  if (file.size > GROUP_IMAGE_RULES.maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `حجم الصورة ${mb} ميجا أكبر من الحد (5 ميجا) — صغّر الصورة أو اختر غيرها`;
  }
  return null;
}
