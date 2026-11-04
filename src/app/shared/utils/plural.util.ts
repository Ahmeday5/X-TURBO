/**
 * Arabic count phrases with correct grammatical number, driven by the CLDR
 * rules in `Intl.PluralRules('ar')`:
 *   zero (0) · one (1) · two (2) · few (3–10) · many (11–99) · other (100+…)
 *
 *   pluralAr(1, ITEMS)  → "قطعة واحدة"
 *   pluralAr(2, ITEMS)  → "قطعتان"
 *   pluralAr(5, ITEMS)  → "5 قطع"
 *   pluralAr(14, ITEMS) → "14 قطعة"
 *
 * `#` in a form is replaced with the (Latin-digit) number.
 */
export type ArabicPluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const rules = new Intl.PluralRules('ar');

export function pluralAr(count: number, forms: ArabicPluralForms): string {
  const form = forms[rules.select(count)] ?? forms.other;
  return form.replace('#', count.toLocaleString('en-US'));
}
