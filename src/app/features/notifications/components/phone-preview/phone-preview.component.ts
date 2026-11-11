import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

/** How the push will look on a phone's lock screen, updated as the user types. */
@Component({
  selector: 'app-phone-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pp" aria-label="معاينة الإشعار على الموبايل" role="img">
      <div class="pp__notch"></div>
      <div class="pp__clock">
        <strong>9:41</strong>
        <span>{{ today }}</span>
      </div>
      <article class="pp__card">
        <header>
          <span class="pp__app"><app-icon name="bell" [size]="11" /></span>
          <span>{{ appName }}</span>
          <small>الآن</small>
        </header>
        <strong class="pp__title" [class.is-empty]="!title()">{{ title() || 'عنوان الإشعار' }}</strong>
        <p class="pp__body" [class.is-empty]="!body()">{{ body() || 'نص الإشعار يظهر هنا…' }}</p>
        @if (link()) {
          <small class="pp__link"><app-icon name="arrow-right" [size]="10" /> يفتح: {{ link() }}</small>
        }
      </article>
    </div>
  `,
  styles: `
    :host { display: block; }
    .pp {
      position: relative; width: 100%; max-width: 280px; margin-inline: auto; aspect-ratio: 9 / 17;
      padding: 34px 12px 12px; border-radius: 34px; border: 8px solid #1b1d22;
      background: linear-gradient(160deg, #3b4a6b, #1d2433 60%, #151a24);
      box-shadow: 0 18px 40px rgb(0 0 0 / 0.25); overflow: hidden; color: #fff;
    }
    .pp__notch {
      position: absolute; top: 8px; left: 50%; translate: -50% 0; width: 84px; height: 18px;
      border-radius: 999px; background: #1b1d22;
    }
    .pp__clock { display: flex; flex-direction: column; align-items: center; margin: 6px 0 18px; }
    .pp__clock strong { font-size: 40px; font-weight: 300; line-height: 1; letter-spacing: 1px; }
    .pp__clock span { font-size: 11px; opacity: 0.8; margin-top: 4px; }
    .pp__card {
      display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 16px;
      background: rgb(255 255 255 / 0.82); color: #111; backdrop-filter: blur(8px);
      animation: pp-in 0.4s var(--ease-out, ease-out) both;
    }
    @keyframes pp-in { from { opacity: 0; transform: translateY(-8px); } }
    .pp__card header { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #555; }
    .pp__card header small { margin-inline-start: auto; }
    .pp__app {
      display: grid; place-items: center; width: 18px; height: 18px; border-radius: 5px;
      background: var(--primary); color: #fff;
    }
    .pp__title { font-size: 12.5px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .pp__body {
      margin: 0; font-size: 12px; line-height: 1.5; color: #333; overflow-wrap: anywhere; white-space: pre-line;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
    }
    .is-empty { color: #999 !important; font-weight: 400; }
    .pp__link { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: #555; }
  `,
})
export class PhonePreviewComponent {
  readonly title = input('');
  readonly body = input('');
  /** Where tapping it leads, e.g. "منتج: تيل فرامل". */
  readonly link = input<string | null>(null);

  protected readonly appName = environment.appName;
  protected readonly today = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: environment.timeZone,
  }).format(new Date());
}
