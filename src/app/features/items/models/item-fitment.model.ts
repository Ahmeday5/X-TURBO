/**
 * Which cars an item fits. `GET/PUT /items/{id}/fitments`; a PUT replaces
 * the whole list. Empty years = every production year of the model.
 */
export interface ItemFitment {
  modelId: string;
  modelName: string;
  makeId: string;
  makeName: string;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface FitmentPayload {
  modelId: string;
  yearFrom?: number;
  yearTo?: number;
}

/** Production span of a model (`yearTo` null = still produced). */
export interface ModelSpan {
  name: string;
  yearFrom: number;
  yearTo: number | null;
}

/** A fitment being added, as typed in the form. */
export interface FitmentCandidate {
  modelId: string;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface FitmentProblems {
  yearFrom?: string;
  yearTo?: string;
  /** Whole-row problem (overlap with an existing fitment). */
  row?: string;
}

/** "2014 – 2020" / "2018 – حتى الآن". */
export const spanLabel = (from: number, to: number | null): string => (to ? `${from} – ${to}` : `${from} – حتى الآن`);

/** How a fitment's years read in the table. */
export function fitmentYearsLabel(f: Pick<ItemFitment, 'yearFrom' | 'yearTo'>): string {
  if (f.yearFrom === null && f.yearTo === null) return 'كل سنين الموديل';
  if (f.yearFrom !== null && f.yearTo !== null) return f.yearFrom === f.yearTo ? `${f.yearFrom}` : `${f.yearFrom} – ${f.yearTo}`;
  return f.yearFrom !== null ? `من ${f.yearFrom}` : `حتى ${f.yearTo}`;
}

/** Effective [from, to] of a fitment on its model (open ends → the model's span). */
function effectiveRange(f: Pick<FitmentCandidate, 'yearFrom' | 'yearTo'>, model: ModelSpan): [number, number] {
  return [f.yearFrom ?? model.yearFrom, f.yearTo ?? model.yearTo ?? Number.POSITIVE_INFINITY];
}

const rangeText = ([from, to]: [number, number]): string =>
  from === to ? `${from}` : to === Number.POSITIVE_INFINITY ? `${from} – حتى الآن` : `${from} – ${to}`;

/**
 * Everything wrong with a candidate, each message stating the allowed range.
 * `existing` = the fitments already in the list (same-model overlaps are refused).
 */
export function fitmentProblems(
  candidate: FitmentCandidate,
  model: ModelSpan,
  existing: readonly ItemFitment[],
): FitmentProblems {
  const problems: FitmentProblems = {};
  const span = spanLabel(model.yearFrom, model.yearTo);
  const last = model.yearTo ?? Number.POSITIVE_INFINITY;
  const allowed = model.yearTo ? `اختر سنة من ${model.yearFrom} إلى ${model.yearTo}` : `اختر سنة من ${model.yearFrom} أو بعدها`;

  const outOfSpan = (y: number) => y < model.yearFrom || y > last;
  if (candidate.yearFrom !== null && outOfSpan(candidate.yearFrom)) {
    problems.yearFrom = `${candidate.yearFrom} خارج سنين إنتاج ${model.name} (${span}) — ${allowed}`;
  }
  if (candidate.yearTo !== null && outOfSpan(candidate.yearTo)) {
    problems.yearTo = `${candidate.yearTo} خارج سنين إنتاج ${model.name} (${span}) — ${allowed}`;
  }
  if (!problems.yearFrom && !problems.yearTo && candidate.yearFrom !== null && candidate.yearTo !== null && candidate.yearTo < candidate.yearFrom) {
    problems.yearTo = `سنة النهاية (${candidate.yearTo}) قبل سنة البداية (${candidate.yearFrom}) — اختر ${candidate.yearFrom} أو بعدها`;
  }
  if (problems.yearFrom || problems.yearTo) return problems;

  const [from, to] = effectiveRange(candidate, model);
  const clash = existing.find((f) => {
    if (f.modelId !== candidate.modelId) return false;
    const [ef, et] = effectiveRange(f, model);
    return from <= et && ef <= to;
  });
  if (clash) {
    const theirs = rangeText(effectiveRange(clash, model));
    problems.row = `${model.name} مضاف بالفعل للسنوات ${theirs}، وهذا يتداخل مع ${rangeText([from, to])} — عدّل السنوات أو احذف التوافق الموجود أولًا`;
  }
  return problems;
}

/** Stable display order: make, model, first year. */
export function sortFitments(list: readonly ItemFitment[]): ItemFitment[] {
  return [...list].sort(
    (a, b) =>
      a.makeName.localeCompare(b.makeName, 'ar') ||
      a.modelName.localeCompare(b.modelName, 'ar') ||
      (a.yearFrom ?? 0) - (b.yearFrom ?? 0),
  );
}

export function toFitmentPayload(f: ItemFitment): FitmentPayload {
  return {
    modelId: f.modelId,
    ...(f.yearFrom !== null ? { yearFrom: f.yearFrom } : {}),
    ...(f.yearTo !== null ? { yearTo: f.yearTo } : {}),
  };
}
