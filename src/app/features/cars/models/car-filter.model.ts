/**
 * "Parts for this car" filter: make → model → production year, each optional
 * but cumulative (a model needs its make, a year needs its model). Sent as
 * `makeId` / `modelId` / `year` query params — the same keys in the URL.
 *
 * Public catalogue: `GET /api/store/car-makes`, `…/car-makes/:id/models`,
 * `…/car-models/:id/years` (active entries only, no token needed).
 */
export interface CarFilter {
  makeId: string | null;
  modelId: string | null;
  year: string | null;
}

export const CAR_FILTER_KEYS = ['makeId', 'modelId', 'year'] as const;

export const EMPTY_CAR_FILTER: CarFilter = { makeId: null, modelId: null, year: null };

export interface StoreCarMake {
  id: string;
  name: string;
  nameEn: string | null;
  modelsCount: number;
}

export interface StoreCarModel {
  id: string;
  makeId: string;
  name: string;
  nameEn: string | null;
  yearFrom: number;
  /** `null` = still in production. */
  yearTo: number | null;
}

/** Reads the filter from a flat filters record (e.g. `UrlListState.query().filters`). */
export function carFilterFrom(filters: Readonly<Record<string, string | null | undefined>>): CarFilter {
  const makeId = filters['makeId'] || null;
  const modelId = (makeId && filters['modelId']) || null;
  const year = (modelId && filters['year']) || null;
  return { makeId, modelId, year };
}

/** Query params for the API — empty parts are left out. */
export function carFilterParams(car: CarFilter | null | undefined): Record<string, string | undefined> {
  return {
    makeId: car?.makeId ?? undefined,
    modelId: car?.makeId ? (car.modelId ?? undefined) : undefined,
    year: car?.makeId && car.modelId ? (car.year ?? undefined) : undefined,
  };
}

export const isCarFilterActive = (car: CarFilter): boolean => !!car.makeId;
