import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withNoTimeout, withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService, UploadEvent } from '../../../core/services/api.service';
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

  /** Errors are NOT toasted — the caller handles 409 `MAKE_HAS_MODELS`. Removes the logo file too. */
  deleteMake(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.carMakes.byId(id), { context: withSilentErrors() });
  }

  /**
   * Upload / replace the make's logo (multipart `file`; the browser sets the
   * boundary — no manual Content-Type) → the full make with its new `logoUrl`.
   * Silent: the caller shows the 422 `message` (IMAGE_TYPE_NOT_ALLOWED / IMAGE_TOO_LARGE…).
   */
  uploadMakeLogo(id: string, file: File): Observable<UploadEvent<CarMake>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.upload<CarMake>(API_ENDPOINTS.carMakes.logo(id), body, {
      context: withNoTimeout(withSilentErrors(withSkipLoader())),
    });
  }

  /** Remove the logo → the full make with `logoUrl: null`. Silent, like the upload. */
  deleteMakeLogo(id: string): Observable<CarMake> {
    return this.api.delete<CarMake>(API_ENDPOINTS.carMakes.logo(id), { context: withSilentErrors(withSkipLoader()) });
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

  /** Errors are NOT toasted — the caller handles 409 `MODEL_IN_USE`. Removes the photo file too. */
  deleteModel(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.carModels.byId(id), { context: withSilentErrors() });
  }

  /**
   * Upload / replace the model's car photo (multipart `file`; no manual
   * Content-Type) → the full model with its new `imageUrl`. Silent: the caller
   * shows the 422 `message`.
   */
  uploadModelImage(id: string, file: File): Observable<UploadEvent<CarModel>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.upload<CarModel>(API_ENDPOINTS.carModels.image(id), body, {
      context: withNoTimeout(withSilentErrors(withSkipLoader())),
    });
  }

  /** Remove the car photo → the full model with `imageUrl: null`. Silent, like the upload. */
  deleteModelImage(id: string): Observable<CarModel> {
    return this.api.delete<CarModel>(API_ENDPOINTS.carModels.image(id), { context: withSilentErrors(withSkipLoader()) });
  }
}
