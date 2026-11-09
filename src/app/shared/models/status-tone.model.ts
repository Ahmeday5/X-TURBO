/** Semantic colour of a status pill — maps 1:1 to `.status-pill--{tone}`. */
export type StatusTone = 'good' | 'warning' | 'danger' | 'info' | 'neutral';

/** Display data for an enum value (status, method…). */
export interface StatusView {
  label: string;
  tone: StatusTone;
  /** Solid colour for charts / dots (a CSS colour or token). */
  color: string;
}
