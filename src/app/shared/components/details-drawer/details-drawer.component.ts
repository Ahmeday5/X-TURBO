import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DrawerComponent } from '../drawer/drawer.component';
import { IconComponent } from '../icon/icon.component';
import { EntityDetails } from './details-drawer.model';

/**
 * Generic read-only details drawer — the "👁" of every table.
 *
 *   readonly viewId = signal<string | null>(null);
 *   readonly viewed = createQueryResource(this.viewId, (id) => this.api.get(id!), { enabled: (id) => !!id });
 *   readonly details = computed(() => { const x = this.viewed.value(); return x ? toItemDetails(x) : null; });
 *
 *   <app-details-drawer [open]="!!viewId()" label="تفاصيل الصنف" [details]="details()"
 *     [loading]="viewed.loading()" [error]="viewed.error()" (retry)="viewed.reload()" (closed)="viewId.set(null)">
 *     <button drawer-actions …>تعديل</button>
 *   </app-details-drawer>
 *
 * Data is always fetched by id (`GET /<resource>/{id}`) so the drawer shows
 * the server's current state, not a possibly stale list row.
 */
@Component({
  selector: 'app-details-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, IconComponent],
  template: `
    <app-drawer [open]="open()" [label]="label()" (closed)="closed.emit()">
      <div drawer-title class="dd-title">
        @if (details(); as d) {
          <span class="dd-title__icon"><app-icon [name]="d.header.icon ?? 'file-lines'" [size]="18" /></span>
          <div class="dd-title__text">
            <strong>{{ d.header.title }}</strong>
            @if (d.header.subtitle) {<small>{{ d.header.subtitle }}</small>}
          </div>
          @if (d.header.badge; as b) {<span [class]="'status-pill status-pill--' + b.tone">{{ b.label }}</span>}
        } @else {
          <strong>{{ label() }}</strong>
        }
      </div>

      @if (error() && !details()) {
        <div class="dd-state" role="alert">
          <app-icon name="alert" [size]="22" />
          <p>{{ error() }}</p>
          <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" (click)="retry.emit()">إعادة المحاولة</button>
        </div>
      } @else if (!details()) {
        <div class="dd-skeleton" aria-busy="true">
          @for (h of [90, 160, 120, 140]; track $index) {<span class="skeleton" [style.height.px]="h"></span>}
        </div>
      } @else {
        <div class="dd-body" [class.is-refreshing]="loading()">
          @for (s of details()!.sections; track s.title) {
            @if (s.fields.length) {
              <section class="dd-section">
                <h3><app-icon [name]="s.icon ?? 'list'" [size]="14" /> {{ s.title }}</h3>
                <dl>
                  @for (f of s.fields; track f.label) {
                    <div [class.is-full]="f.full">
                      <dt>{{ f.label }}</dt>
                      <dd [class.ltr]="f.ltr" [class]="f.tone ? 'is-' + f.tone : ''" [class.is-empty]="isEmpty(f.value)">
                        {{ isEmpty(f.value) ? '—' : f.value }}
                      </dd>
                    </div>
                  }
                </dl>
              </section>
            }
          }
        </div>
      }

      <div drawer-footer class="dd-actions"><ng-content select="[drawer-actions]" /></div>
    </app-drawer>
  `,
  styles: [
    `
      .dd-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .dd-title__icon {
        flex-shrink: 0; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px;
        background: var(--primary-soft); color: var(--primary);
      }
      .dd-title__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .dd-title__text strong { font-size: 15px; font-weight: 700; color: var(--txt); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dd-title__text small { font-size: 11.5px; color: var(--txt3); }

      .dd-body { display: flex; flex-direction: column; gap: 14px; transition: opacity var(--dur); }
      .dd-body.is-refreshing { opacity: 0.6; }
      .dd-section { padding: 14px; border: 1px solid var(--brd); border-radius: var(--rl); background: var(--bg2); }
      .dd-section h3 {
        display: flex; align-items: center; gap: 6px; margin: 0 0 12px;
        font-size: 12px; font-weight: 700; color: var(--txt2);
      }
      .dd-section dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
      .dd-section dl > div { min-width: 0; }
      .dd-section dl > div.is-full { grid-column: 1 / -1; }
      .dd-section dt { font-size: 11px; font-weight: 500; color: var(--txt3); }
      .dd-section dd {
        margin: 3px 0 0; font-size: 13px; font-weight: 600; color: var(--txt);
        overflow-wrap: anywhere; white-space: pre-line; font-variant-numeric: tabular-nums;
      }
      .dd-section dd.is-empty { color: var(--txt3); font-weight: 400; }
      .dd-section dd.is-good { color: var(--gr); }
      .dd-section dd.is-warning { color: var(--am); }
      .dd-section dd.is-danger { color: var(--re); }
      .dd-section dd.is-info { color: var(--bl); }
      .dd-section dd.is-muted { color: var(--txt3); }

      .dd-skeleton { display: flex; flex-direction: column; gap: 12px; }
      .dd-skeleton .skeleton { border-radius: var(--rl); }
      .dd-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 12px; color: var(--txt3); text-align: center; }
      .dd-state p { margin: 0; font-size: 13px; }
      .dd-actions { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
      .dd-actions:empty { display: none; }

      @media (max-width: 420px) {
        .dd-section dl { grid-template-columns: minmax(0, 1fr); }
      }
    `,
  ],
})
export class DetailsDrawerComponent {
  readonly open = input.required<boolean>();
  /** Accessible name of the drawer ("تفاصيل الصنف"). */
  readonly label = input.required<string>();
  readonly details = input<EntityDetails | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  readonly retry = output<void>();

  protected isEmpty(v: unknown): boolean {
    return v === null || v === undefined || (typeof v === 'string' && !v.trim());
  }
}
