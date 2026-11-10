import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { SystemSettings, SystemSettingsPayload } from '../models/settings.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<SystemSettings> {
    return this.api.get<SystemSettings>(API_ENDPOINTS.settings.root, { context: withSkipLoader() });
  }

  save(payload: SystemSettingsPayload): Observable<SystemSettings> {
    return this.api.put<SystemSettings>(API_ENDPOINTS.settings.root, payload);
  }
}
