import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Minimal inline-SVG icon set for starter navigation/UI use. Swap this for
 * your icon library of choice (e.g. an icon font, or a per-icon SVG sprite) —
 * the important pattern to keep is a single component keyed by name so
 * templates never inline raw `<svg>` markup.
 */
export type IconName =
  | 'home'
  | 'users'
  | 'settings'
  | 'file'
  | 'chart'
  | 'grid'
  | 'bell'
  | 'menu'
  | 'mail'
  | 'lock'
  | 'user'
  | 'eye'
  | 'eye-off'
  | 'arrow-right'
  | 'alert'
  | 'check'
  | 'shield'
  | 'bolt'
  | 'box'
  | 'warehouse'
  | 'cart'
  | 'receipt'
  | 'calculator'
  | 'truck'
  | 'tag'
  | 'store'
  | 'layers'
  | 'swap'
  | 'briefcase'
  | 'wallet'
  | 'search'
  | 'logout'
  | 'chevron-down'
  | 'chevron-left'
  | 'refresh'
  | 'trend-up'
  | 'trend-down'
  | 'table'
  | 'clock'
  | 'x'
  | 'list'
  | 'folder'
  | 'journal'
  | 'clipboard'
  | 'file-plus'
  | 'file-lines'
  | 'file-search'
  | 'file-percent'
  | 'return'
  | 'goods-in'
  | 'goods-out'
  | 'cash-in'
  | 'cash-out'
  | 'id-card'
  | 'user-plus'
  | 'scale'
  | 'sitemap'
  | 'target'
  | 'pie'
  | 'coins'
  | 'monitor'
  | 'calendar'
  | 'sliders'
  | 'edit'
  | 'trash'
  | 'plus'
  | 'barcode'
  | 'user-check'
  | 'user-x'
  | 'image'
  | 'star'
  | 'upload'
  | 'car'
  | 'grip';

const PATHS: Record<IconName, string> = {
  home: 'M3 9.5L10 4l7 5.5V16a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3H8v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z',
  users:
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 16c.3-2.5 2-4 4.5-4S11 13.5 11 16M9.5 12.2c.4-1.6 1.9-2.7 4-2.7 2.5 0 4.2 1.5 4.5 4',
  settings:
    'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7-2.5-1.6-.3a5.4 5.4 0 0 0-.5-1.2l1-1.4-1.4-1.4-1.4 1a5.4 5.4 0 0 0-1.2-.5L11.6 3H8.4l-.3 1.7c-.4.1-.8.3-1.2.5l-1.4-1L4.1 5.6l1 1.4c-.2.4-.4.8-.5 1.2L3 10.5v0l1.6.3c.1.4.3.8.5 1.2l-1 1.4 1.4 1.4 1.4-1c.4.2.8.4 1.2.5l.3 1.7h3.2l.3-1.7c.4-.1.8-.3 1.2-.5l1.4 1 1.4-1.4-1-1.4c.2-.4.4-.8.5-1.2L17 10Z',
  file: 'M6 2.5h5.5L15 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm5 0V6h3.5',
  chart: 'M4 16V9M9 16V4M14 16v-6M3 17h13',
  grid: 'M3 3h5.5v5.5H3V3Zm8.5 0H17v5.5h-5.5V3ZM3 11.5h5.5V17H3v-5.5Zm8.5 0H17V17h-5.5v-5.5Z',
  bell: 'M10 3a4 4 0 0 0-4 4v2.4c0 .5-.2 1-.5 1.4L4 13h12l-1.5-2.2a2.3 2.3 0 0 1-.5-1.4V7a4 4 0 0 0-4-4Zm-1.7 12a1.8 1.8 0 0 0 3.4 0',
  menu: 'M3 5h14M3 10h14M3 15h14',
  mail: 'M3 5.5h14v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9Zm0 0 7 5.5 7-5.5',
  lock: 'M5 9h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm2 0V6.5a3 3 0 0 1 6 0V9M10 12.5V14',
  user: 'M10 9.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM3.5 17c.6-3.2 3.1-5 6.5-5s5.9 1.8 6.5 5',
  eye: 'M1.8 10S4.7 4.5 10 4.5 18.2 10 18.2 10 15.3 15.5 10 15.5 1.8 10 1.8 10Zm8.2 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  'eye-off':
    'M3 3l14 14M8.2 4.7c.6-.1 1.2-.2 1.8-.2 5.3 0 8.2 5.5 8.2 5.5a14 14 0 0 1-2.3 3M12.1 12.2a2.5 2.5 0 0 1-4.3-3.8M5.3 6.4A13.6 13.6 0 0 0 1.8 10s2.9 5.5 8.2 5.5c1.3 0 2.5-.3 3.5-.8',
  'arrow-right': 'M4 10h12m-4.5-4.5L16 10l-4.5 4.5',
  alert: 'M10 6.5V11m0 2.75V14M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z',
  check: 'M4.5 10.5 8 14l7.5-8',
  shield: 'M10 2.5l6 2.25v4.5c0 3.9-2.6 6.9-6 8.25-3.4-1.35-6-4.35-6-8.25v-4.5L10 2.5ZM7.5 10l1.8 1.8L13 8.2',
  bolt: 'M11 2 4.5 11H10l-1 7 6.5-9H10l1-7Z',
  box: 'M10 2.5l7 3.75v7.5L10 17.5l-7-3.75v-7.5L10 2.5ZM3 6.25 10 10l7-3.75M10 10v7.5',
  warehouse: 'M2.5 7.5 10 3l7.5 4.5V17h-15V7.5ZM6 17v-6.5h8V17M6 13.75h8',
  cart: 'M2.5 3.5h2l1.8 9h9.2L17 6H5.4M8 16.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm7 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z',
  receipt: 'M5 2.5h10v15l-2-1.25-1.5 1.25L10 16.25 8.5 17.5 7 16.25 5 17.5v-15ZM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3',
  calculator:
    'M5.5 2.5h9a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1ZM7 5.5h6V8H7V5.5ZM7 11h.01M10 11h.01M13 11h.01M7 14h.01M10 14h.01M13 14h.01',
  truck: 'M1.5 5h10v8.5h-10V5Zm10 3H15l3 3v2.5h-6.5M5 15.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  tag: 'M2.5 10.2V3.5a1 1 0 0 1 1-1h6.7l7.3 7.3-7.7 7.7-7.3-7.3ZM6.5 6.5h.01',
  store: 'M3 8v8.5h14V8M2.5 3.5h15l1 4.5h-17l1-4.5ZM8 16.5v-4h4v4',
  layers: 'M10 2.5 17.5 6.5 10 10.5 2.5 6.5 10 2.5ZM2.5 10 10 14l7.5-4M2.5 13.5 10 17.5l7.5-4',
  swap: 'M4 7h12m-3.5-3.5L16 7l-3.5 3.5M16 13H4m3.5-3.5L4 13l3.5 3.5',
  briefcase: 'M3 6.5h14a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5Zm4 0V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M2.5 11h15',
  wallet: 'M3.5 5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 0 9-2.5V5M16.5 9h-3a1.5 1.5 0 0 0 0 3h3',
  search: 'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm8.5 2-4-4',
  logout: 'M8 3.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8M12.5 6.5 16 10l-3.5 3.5M16 10H7.5',
  'chevron-down': 'M5 7.5 10 12.5 15 7.5',
  'chevron-left': 'M12.5 5 7.5 10l5 5',
  refresh: 'M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v3.5H13',
  'trend-up': 'M3 14l4.5-4.5 3 3L17 6m0 0h-4m4 0v4',
  'trend-down': 'M3 6l4.5 4.5 3-3L17 14m0 0h-4m4 0v-4',
  table: 'M3 4h14v12H3V4Zm0 4h14M3 12h14M8 4v12',
  clock: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 6v4l2.5 2.5',
  x: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  list: 'M7.5 5h9.5M7.5 10h9.5M7.5 15h9.5M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  folder: 'M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-10Z',
  journal: 'M4 3.5h10a1 1 0 0 1 1 1v12H5.5A1.5 1.5 0 0 1 4 15V3.5Zm0 11.5a1.5 1.5 0 0 1 1.5-1.5H15M7 6.5h5M7 9h3.5',
  clipboard:
    'M7.5 3.5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-12a1 1 0 0 0-1-1h-1.5M7.5 2.5h5v2h-5v-2ZM7.5 9h5M7.5 12h5M7.5 15h3',
  'file-plus': 'M6 2.5h5.5L15 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm5 0V6h3.5M10 9v5M7.5 11.5h5',
  'file-lines': 'M6 2.5h5.5L15 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm5 0V6h3.5M7.5 9.5h5M7.5 12h5M7.5 14.5h3',
  'file-search':
    'M6 2.5h5.5L15 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm5 0V6h3.5M9.5 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm1.5-.5 1.75 1.75',
  'file-percent':
    'M6 2.5h5.5L15 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm5 0V6h3.5M7.75 14.5l4.5-5M8.25 10h.01M11.75 14h.01',
  return: 'M7.5 4.5 4 8l3.5 3.5M4 8h8.5a4 4 0 0 1 0 8H9',
  'goods-in':
    'M2.5 11.5h4l1 2h5l1-2h4M2.5 11.5V16a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4.5M2.5 11.5 5 5h1.5M17.5 11.5 15 5h-1.5M10 2.5v7M7.5 7 10 9.5 12.5 7',
  'goods-out':
    'M2.5 11.5h4l1 2h5l1-2h4M2.5 11.5V16a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4.5M2.5 11.5 5 5h1.5M17.5 11.5 15 5h-1.5M10 9.5v-7M7.5 5 10 2.5 12.5 5',
  'cash-in': 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 6.5v7m-3-3 3 3 3-3',
  'cash-out': 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 13.5v-7m-3 3 3-3 3 3',
  'id-card':
    'M3 4.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM7 10a1.75 1.75 0 1 0 0-3.5A1.75 1.75 0 0 0 7 10Zm-2.5 3c.3-1.3 1.3-2 2.5-2s2.2.7 2.5 2M12 8h3.5M12 11h2.5',
  'user-plus':
    'M8.5 9.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM2 17c.6-3.2 3.1-5 6.5-5 1.4 0 2.7.3 3.7.9M15.5 12v5M13 14.5h5',
  scale: 'M10 3v14M6.5 17h7M4 6h12M4 6l-2 5a2.5 2.5 0 0 0 4 0L4 6Zm12 0-2 5a2.5 2.5 0 0 0 4 0l-2-5Z',
  sitemap: 'M8 2.5h4V6H8V2.5ZM2.5 14h4v3.5h-4V14ZM8 14h4v3.5H8V14Zm5.5 0h4v3.5h-4V14ZM10 6v8M4.5 14v-2.5h11V14',
  target: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm0-4a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-3.5h.01',
  pie: 'M10 2.5a7.5 7.5 0 1 0 7.5 7.5H10V2.5Zm2.5-.1v5.1h5.1a7.5 7.5 0 0 0-5.1-5.1Z',
  coins:
    'M7.5 8.5c2.8 0 5-1 5-2.25S10.3 4 7.5 4s-5 1-5 2.25S4.7 8.5 7.5 8.5Zm-5-2.25v7.5c0 1.25 2.2 2.25 5 2.25s5-1 5-2.25v-7.5M2.5 10c0 1.25 2.2 2.25 5 2.25s5-1 5-2.25M14.5 8.5c1.8.3 3 1 3 1.75v5c0 1-1.8 1.9-4.3 2.2',
  monitor: 'M3 3.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM7 17h6M10 13.5V17',
  calendar:
    'M4 4.5h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM3 8.5h14M7 2.5v4M13 2.5v4M7.5 12.75l1.75 1.75L13 10.75',
  edit: 'M11.5 4.5l4 4M3.5 16.5l1-4L13 4a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-8.5 8.5-4 1Z',
  trash: 'M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 10.6a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L15 5.5M8.5 9v5M11.5 9v5',
  plus: 'M10 4v12M4 10h12',
  barcode: 'M3 4.5v11M5.5 4.5v11M8.5 4.5v11M10.5 4.5v11M13.5 4.5v11M15.5 4.5v11M17 4.5v11',
  sliders: 'M3 5.5h8.5M15.5 5.5H17M3 10h2.5M9.5 10H17M3 14.5h9M16 14.5h1M13.5 3.5v4M7.5 8v4M14 12.5v4',
  'user-check': 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 17c.4-3 2.6-5 5.5-5 1.2 0 2.3.3 3.1.9M12.5 14.5l1.8 1.8 3.2-3.6',
  'user-x': 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 17c.4-3 2.6-5 5.5-5 1.2 0 2.3.3 3.1.9M13 13l4 4m0-4-4 4',
  image:
    'M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 12.5 13 8.5l-7.5 7.5',
  star: 'm10 3 2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7L3.2 8l4.7-.7L10 3Z',
  upload: 'M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4 13v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2',
  car: 'M3 13v-2.2l1.8-4.3a1.5 1.5 0 0 1 1.4-1h7.6a1.5 1.5 0 0 1 1.4 1l1.8 4.3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm0-2.5h14M6 14v2m8-2v2M6.5 12h.01m7 0h.01',
  grip: 'M7 5h1M12 5h1M7 10h1M12 10h1M7 15h1M12 15h1',
};

/**
 * Icons that point along the reading direction. They are drawn for LTR and
 * mirrored automatically under `dir="rtl"`, so "forward"/"back"/"collapse"
 * and trend arrows always face the right way.
 */
const DIRECTIONAL: ReadonlySet<IconName> = new Set<IconName>([
  'arrow-right',
  'chevron-left',
  'logout',
  'return',
  'trend-up',
  'trend-down',
]);

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [class.is-directional]="directional()"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        [attr.d]="path()"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [
    `
      :host { display: inline-flex; line-height: 0; }
      :host-context([dir='rtl']) .is-directional { transform: scaleX(-1); }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number>(16);

  protected path(): string {
    return PATHS[this.name()] ?? PATHS['grid'];
  }

  protected directional(): boolean {
    return DIRECTIONAL.has(this.name());
  }
}
