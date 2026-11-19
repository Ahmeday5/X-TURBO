import { DEFAULT_FIELDS, DEFAULT_TEMPLATE_ID, LabelSettings, templateById } from '../models/barcode-label.model';

const SETTINGS_KEY = 'xturbo.barcode-labels.settings';

/**
 * Label template + fields chosen on the labels page, per device (each counter
 * has its own label printer). Quick-print buttons elsewhere reuse them.
 */
export function loadLabelSettings(): LabelSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<LabelSettings> | null;
    return {
      templateId: templateById(saved?.templateId ?? DEFAULT_TEMPLATE_ID).id,
      fields: { ...DEFAULT_FIELDS, ...(saved?.fields ?? {}) },
    };
  } catch {
    return { templateId: DEFAULT_TEMPLATE_ID, fields: { ...DEFAULT_FIELDS } };
  }
}

export function saveLabelSettings(settings: LabelSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}
