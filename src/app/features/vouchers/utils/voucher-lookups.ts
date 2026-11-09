import { computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { formatMoney } from '../../../shared/utils/format.util';
import { AccountOption } from '../../accounts/models/account.model';
import { CostCenterOption } from '../../accounts/models/cost-center.model';
import { AccountsService } from '../../accounts/services/accounts.service';
import { CostCentersService } from '../../accounts/services/cost-centers.service';
import { BALANCE_SIDE_LABEL, balanceSide, PARTY_KIND_VIEW, PartyOption } from '../../parties/models/party.model';
import { PartiesService } from '../../parties/services/parties.service';

/** Codes of the cash boxes / bank accounts vouchers move money through. */
export const CASH_ACCOUNT_CODES: readonly string[] = ['1101', '1102', '1105'];

export interface VoucherLookups {
  accounts: Signal<AccountOption[]>;
  /** Leaf accounts except cash boxes (counter accounts, journal lines use `allAccountOptions`). */
  accountOptions: Signal<SearchableSelectOption[]>;
  allAccountOptions: Signal<SearchableSelectOption[]>;
  cashAccounts: Signal<AccountOption[]>;
  parties: Signal<PartyOption[]>;
  partyOptions: Signal<SearchableSelectOption[]>;
  centers: Signal<CostCenterOption[]>;
}

const accountOption = (a: AccountOption): SearchableSelectOption => ({ value: a.id, label: `${a.code} — ${a.name}` });

/**
 * Select options shared by the voucher screens. Call in an injection context.
 */
export function injectVoucherLookups(): VoucherLookups {
  const accounts = toSignal(inject(AccountsService).lookup({ leaf: true }), { initialValue: [] as AccountOption[] });
  const parties = toSignal(inject(PartiesService).lookup(), { initialValue: [] as PartyOption[] });
  const centers = toSignal(inject(CostCentersService).lookup(), { initialValue: [] as CostCenterOption[] });

  return {
    accounts,
    accountOptions: computed(() => accounts().filter((a) => !CASH_ACCOUNT_CODES.includes(a.code)).map(accountOption)),
    allAccountOptions: computed(() => accounts().map(accountOption)),
    cashAccounts: computed(() => accounts().filter((a) => CASH_ACCOUNT_CODES.includes(a.code))),
    parties,
    partyOptions: computed(() =>
      parties().map((p) => ({
        value: p.id,
        label: `${p.name} — ${p.code}`,
        hint: `${PARTY_KIND_VIEW[p.kind].label} · الرصيد ${formatMoney(Math.abs(p.balance))} ${BALANCE_SIDE_LABEL[balanceSide(p.balance)]}`,
      })),
    ),
    centers,
  };
}
