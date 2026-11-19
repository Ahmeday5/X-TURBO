import { IconName } from '../components/icon/icon.component';

/**
 * An action offered on a list row AND in its details drawer. Each feature
 * derives the list from one pure function of the row (status rules live in
 * one place), and the drawer runs the chosen key — so a row and its drawer
 * can never disagree about what's allowed or how it's done.
 */
export interface RowAction<K extends string = string> {
  key: K;
  label: string;
  icon: IconName;
  /** `primary` = the next step of the workflow, `danger` = destructive. */
  tone?: 'primary' | 'danger';
  /** Draws a separator above (groups destructive actions at the bottom). */
  separated?: boolean;
  /**
   * Shown but locked, with this reason under the label — for a step that
   * exists but has a prerequisite (e.g. "assign a driver first"). Hiding it
   * would leave the user guessing why the step is missing.
   */
  disabledReason?: string;
}
