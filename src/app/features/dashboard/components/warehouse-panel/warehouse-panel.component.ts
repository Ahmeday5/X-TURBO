import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatInteger } from '../../../../shared/utils/format.util';
import { ArabicPluralForms, pluralAr } from '../../../../shared/utils/plural.util';
import { WarehouseStatus } from '../../models/dashboard.model';

type Severity = 'good' | 'warning' | 'danger';

const SEVERITY_LABEL: Record<Severity, string> = {
  good: 'مستقر',
  warning: 'يقترب من الامتلاء',
  danger: 'شبه ممتلئ',
};

const LOCATIONS: ArabicPluralForms = {
  one: 'موقع واحد',
  two: 'موقعين',
  few: '# مواقع',
  other: '# موقعًا',
};

/** Capacity thresholds (%) — the meter fill carries severity, the pill names it. */
const WARNING_AT = 75;
const DANGER_AT = 90;

@Component({
  selector: 'app-warehouse-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  templateUrl: './warehouse-panel.component.html',
  styleUrl: './warehouse-panel.component.scss',
})
export class WarehousePanelComponent {
  readonly warehouses = input.required<readonly WarehouseStatus[]>();

  protected readonly formatInteger = formatInteger;
  protected readonly locationsLabel = computed(() => pluralAr(this.warehouses().length, LOCATIONS));

  protected readonly rows = computed(() =>
    this.warehouses().map((w) => {
      const severity: Severity =
        w.capacityPct >= DANGER_AT ? 'danger' : w.capacityPct >= WARNING_AT ? 'warning' : 'good';
      return { ...w, severity, severityLabel: SEVERITY_LABEL[severity] };
    }),
  );
}
