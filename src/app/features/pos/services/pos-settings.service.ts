import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PosSettings, PosSettingsPayload } from '../models/pos-settings.model';

export const POS_ENDPOINTS = {
  settings: 'pos/settings',
} as const;

@Injectable({ providedIn: 'root' })
export class PosSettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<PosSettings> {
    return this.api.get<PosSettings>(POS_ENDPOINTS.settings, { context: withSkipLoader() });
  }

  save(payload: PosSettingsPayload): Observable<PosSettings> {
    return this.api.put<PosSettings>(POS_ENDPOINTS.settings, payload);
  }
}
