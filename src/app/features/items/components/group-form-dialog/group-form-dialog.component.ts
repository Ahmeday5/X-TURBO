import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { GROUP_COLORS, ItemGroup, ItemGroupOption, ItemGroupPayload } from '../../models/item-group.model';
import { ItemGroupsService } from '../../services/item-groups.service';

/**
 * Create / edit an item group in a modal. `group` null → create.
 * Emits `saved` after a successful write so the list can refresh.
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
  /** Candidate parents (the edited group itself is filtered out). */
  readonly parents = input<ItemGroupOption[]>([]);

  readonly closed = output<void>();
  readonly saved = output<ItemGroup>();

  protected readonly colors = GROUP_COLORS;
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.group());
  protected readonly parentOptions = computed(() => this.parents().filter((p) => p.id !== this.group()?.id));

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
      untracked(() =>
        this.form.reset(
          g
            ? { name: g.name, parentId: g.parentId ?? '', description: g.description, color: g.color, isActive: g.isActive }
            : undefined,
        ),
      );
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: ItemGroupPayload = {
      ...v,
      name: v.name.trim(),
      description: v.description.trim(),
      parentId: v.parentId || null,
    };
    const id = this.group()?.id;
    this.saving.set(true);
    (id ? this.groups.update(id, payload) : this.groups.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((group) => {
        this.toast.success(id ? 'تم تحديث المجموعة' : 'تم إضافة المجموعة');
        this.saved.emit(group);
      });
  }
}
