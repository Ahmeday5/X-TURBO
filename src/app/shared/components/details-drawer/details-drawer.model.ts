import { IconName } from '../icon/icon.component';

/**
 * Read-only "view details" content, built by each feature from an entity
 * fetched by id (`toItemDetails(item)`, `toPartyDetails(party)`…) and rendered
 * by `<app-details-drawer>`.
 */
export interface DetailField {
  label: string;
  /** Already formatted for display. Empty / null → "—". */
  value: string | number | null | undefined;
  /** Codes, phones, emails, numbers that must stay left-to-right. */
  ltr?: boolean;
  /** Takes the whole row (long text: notes, addresses, descriptions). */
  full?: boolean;
  /** Colour cue for the value. */
  tone?: 'good' | 'warning' | 'danger' | 'info' | 'muted';
}

export interface DetailSection {
  title: string;
  icon?: IconName;
  fields: DetailField[];
}

/** Header of the drawer (title line + optional status chip). */
export interface DetailHeader {
  title: string;
  subtitle?: string;
  icon?: IconName;
  badge?: { label: string; tone: 'good' | 'warning' | 'danger' | 'info' | 'neutral' };
}

export interface EntityDetails {
  header: DetailHeader;
  sections: DetailSection[];
}

/** "نعم" / "لا". */
export const yesNo = (v: boolean): string => (v ? 'نعم' : 'لا');
