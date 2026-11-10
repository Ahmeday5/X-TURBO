import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { CarMake, CarMakePayload, CarModel, CarModelPayload } from '../models/car.model';

/** Car makes & models (`Items.View`). Lists are small and returned whole (not paged). */
@Injectable({ providedIn: 'root' })
export class CarCatalogService {
  private readonly api = inject(ApiService);

  // ── Makes ──

  makes(): Observable<CarMake[]> {
    return this.api.get<CarMake[]>(API_ENDPOINTS.carMakes.list, { context: withSkipLoader() });
  }

  createMake(payload: CarMakePayload): Observable<CarMake> {
    return this.api.post<CarMake>(API_ENDPOINTS.carMakes.list, payload);
  }

  updateMake(id: string, payload: CarMakePayload): Observable<CarMake> {
    return this.api.put<CarMake>(API_ENDPOINTS.carMakes.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `MAKE_HAS_MODELS`. */
  deleteMake(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.carMakes.byId(id), { context: withSilentErrors() });
  }

  // ── Models ──

  /** All models, or one make's models when `makeId` is given. */
  models(makeId?: string | null): Observable<CarModel[]> {
    return this.api.get<CarModel[]>(API_ENDPOINTS.carModels.list, {
      params: { makeId: makeId ?? undefined },
      context: withSkipLoader(),
    });
  }

  createModel(payload: CarModelPayload): Observable<CarModel> {
    return this.api.post<CarModel>(API_ENDPOINTS.carModels.list, payload);
  }

  updateModel(id: string, payload: CarModelPayload): Observable<CarModel> {
    return this.api.put<CarModel>(API_ENDPOINTS.carModels.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `MODEL_IN_USE`. */
  deleteModel(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.carModels.byId(id), { context: withSilentErrors() });
  }
}
