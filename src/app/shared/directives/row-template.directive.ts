import { Directive, input } from '@angular/core';

/**
 * Types a cell/card `<ng-template>` by the rows it renders, so `let-row`
 * is checked under strict templates instead of being `any`.
 *
 *   <ng-template #statusCell [appRowOf]="list.items()" let-o>{{ o.status }}</ng-template>
 */
@Directive({ selector: 'ng-template[appRowOf]', standalone: true })
export class RowTemplateDirective<T> {
  /** Only used for type inference. */
  readonly appRowOf = input.required<readonly T[]>();

  static ngTemplateContextGuard<T>(_dir: RowTemplateDirective<T>, _ctx: unknown): _ctx is { $implicit: T } {
    return true;
  }
}
