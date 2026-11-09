import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Drop `<app-print-styles />` on a page that offers "طباعة": while printing
 * it hides the app chrome (topbar, sidebar) and anything marked `.no-print`,
 * lets the content flow across pages, and shows `.print-only` blocks.
 * Global (unencapsulated) on purpose — it only applies under `@media print`.
 */
@Component({
  selector: 'app-print-styles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: '',
  styles: [
    `
      app-print-styles { display: none; }
      .print-only { display: none; }
      @media print {
        @page { size: A4; margin: 12mm; }
        app-topbar, .sidebar-wrapper, .sidebar-overlay, app-toast, app-loader, .no-print { display: none !important; }
        .app-layout, .app-body, .content-body { display: block !important; height: auto !important; overflow: visible !important; padding: 0 !important; }
        body { background: #fff !important; }
        .print-only { display: block !important; }
        .panel, .tw { box-shadow: none !important; break-inside: auto; }
        tr { break-inside: avoid; }
        * { animation: none !important; transition: none !important; }
      }
    `,
  ],
})
export class PrintStylesComponent {}
