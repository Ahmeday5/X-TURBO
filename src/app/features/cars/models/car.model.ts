/**
 * Car catalogue (makes → models) used by item fitments and the mobile app's
 * "find parts for my car". Contract: `/api/car-makes`, `/api/car-models`.
 */

export interface CarMake {
  id: string;
  name: string;
  nameEn: string | null;
  isActive: boolean;
  /** Display order in the app (ascending). */
  sortOrder: number;
  /** Computed by the server. */
  modelsCount: number;
}

export interface CarMakePayload {
  name: string;
  nameEn?: string | null;
  isActive?: boolean;
  sortOrder: number;
}

export interface CarModel {
  id: string;
  makeId: string;
  makeName: string;
  name: string;
  nameEn: string | null;
  yearFrom: number;
  /** `null` = still in production. */
  yearTo: number | null;
  isActive: boolean;
}

export interface CarModelPayload {
  makeId: string;
  name: string;
  nameEn?: string | null;
  yearFrom: number;
  yearTo?: number | null;
  isActive?: boolean;
}

/** Business-rule codes the cars API answers with (409). */
export const CAR_ERROR_CODES = {
  /** Make still has models — delete / move them first, or deactivate the make. */
  makeHasModels: 'MAKE_HAS_MODELS',
  /** Model is used by item fitments or customers' cars — deactivate instead. */
  modelInUse: 'MODEL_IN_USE',
} as const;

/** Oldest model year the forms accept. */
export const MIN_MODEL_YEAR = 1950;

/** Next year is allowed (manufacturers announce next-year models early). */
export const maxModelYear = (): number => new Date().getFullYear() + 1;

/** "2014 – 2020" / "2018 – حتى الآن". */
export function modelYearsLabel(m: Pick<CarModel, 'yearFrom' | 'yearTo'>): string {
  return m.yearTo ? `${m.yearFrom} – ${m.yearTo}` : `${m.yearFrom} – حتى الآن`;
}

export function toCarMakePayload(m: CarMake, patch: Partial<CarMakePayload> = {}): CarMakePayload {
  return { name: m.name, nameEn: m.nameEn, isActive: m.isActive, sortOrder: m.sortOrder, ...patch };
}

export function toCarModelPayload(m: CarModel, patch: Partial<CarModelPayload> = {}): CarModelPayload {
  return { makeId: m.makeId, name: m.name, nameEn: m.nameEn, yearFrom: m.yearFrom, yearTo: m.yearTo, isActive: m.isActive, ...patch };
}
