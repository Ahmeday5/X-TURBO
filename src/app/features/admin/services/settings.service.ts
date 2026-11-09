import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { SystemSettings, SystemSettingsPayload } from '../models/settings.model';

export const SETTINGS_ENDPOINTS = {
  settings: 'settings',
} as const;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<SystemSettings> {
    return this.api.get<SystemSettings>(SETTINGS_ENDPOINTS.settings, { context: withSkipLoader() });
  }

  save(payload: SystemSettingsPayload): Observable<SystemSettings> {
    return this.api.put<SystemSettings>(SETTINGS_ENDPOINTS.settings, payload);
  }
}
