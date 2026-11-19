import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { StoreCarMake, StoreCarModel } from '../models/car-filter.model';

/**
 * Public car catalogue for the make → model → year filters. Answers are
 * cached for the session (the catalogue rarely changes and every filter
 * change would otherwise refetch it); a failed request is not cached.
 */
@Injectable({ providedIn: 'root' })
export class StoreCarsService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, Observable<unknown>>();

  makes(): Observable<StoreCarMake[]> {
    return this.cached('makes', () => this.api.get<StoreCarMake[]>(API_ENDPOINTS.storeCars.makes, { context: withSkipLoader() }));
  }

  models(makeId: string): Observable<StoreCarModel[]> {
    return this.cached(`models:${makeId}`, () =>
      this.api.get<StoreCarModel[]>(API_ENDPOINTS.storeCars.models(makeId), { context: withSkipLoader() }),
    );
  }

  /** Production years, newest first. */
  years(modelId: string): Observable<number[]> {
    return this.cached(`years:${modelId}`, () =>
      this.api.get<number[]>(API_ENDPOINTS.storeCars.years(modelId), { context: withSkipLoader() }),
    );
  }

  private cached<T>(key: string, load: () => Observable<T>): Observable<T> {
    let hit = this.cache.get(key) as Observable<T> | undefined;
    if (!hit) {
      hit = load().pipe(
        catchError((err) => {
          this.cache.delete(key);
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(key, hit);
    }
    return hit;
  }
}
