/**
 * The three states any CRUD form can be in.
 *
 *   create — empty form, "Save" submits a POST
 *   edit   — pre-filled form, "Save" submits a PUT/PATCH
 *   view   — read-only display, no submit button
 */
export type FormMode = 'create' | 'edit' | 'view';

/** Returns a title like "Add Customer" / "Edit Customer" / "Customer Details". */
export function formModeTitle(mode: FormMode, entityLabel: string): string {
  switch (mode) {
    case 'create': return `Add ${entityLabel}`;
    case 'edit': return `Edit ${entityLabel}`;
    case 'view': return `${entityLabel} Details`;
  }
}

/** Returns a submit-button label, or null when no submit button should render. */
export function formModeSubmitLabel(mode: FormMode): string | null {
  switch (mode) {
    case 'create': return 'Add';
    case 'edit': return 'Save Changes';
    case 'view': return null;
  }
}
