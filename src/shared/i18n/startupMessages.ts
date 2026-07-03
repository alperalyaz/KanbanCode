import { APP_NAME } from '@shared/constants/brand';
import {
  FALLBACK_APP_LOCALE,
  resolveAppLocale,
  type ResolvedAppLocale,
} from '@features/localization';

export const STARTUP_LOCALE_CACHE_KEY = 'agent-teams-locale-cache';
export const STARTUP_LOCALE_PREFERENCE_CACHE_KEY = 'agent-teams-locale-preference-cache';

export const STARTUP_INITIAL_MESSAGE_EN = 'Preparing workspace...';

const STARTUP_MESSAGE_TRANSLATIONS: Record<string, string> = {
  [STARTUP_INITIAL_MESSAGE_EN]: 'Çalışma alanı hazırlanıyor...',
  [`Starting ${APP_NAME}...`]: `${APP_NAME} başlatılıyor...`,
  'Preparing app services...': 'Uygulama servisleri hazırlanıyor...',
  'Resolving local runtime...': 'Yerel çalışma zamanı aranıyor...',
  'Loading secure settings...': 'Güvenli ayarlar yükleniyor...',
  'Wiring app actions...': 'Uygulama eylemleri bağlanıyor...',
  'Finishing startup...': 'Başlatma tamamlanıyor...',
  'Opening window...': 'Pencere açılıyor...',
  Ready: 'Hazır',
  'Startup failed': 'Başlatma başarısız',
  'Preparing runtime environment...': 'Çalışma zamanı ortamı hazırlanıyor...',
  'Resolving Agent Teams MCP server...': 'Agent Teams MCP sunucusu aranıyor...',
  'Preparing runtime work sync hooks...': 'Çalışma zamanı senkronizasyon kancaları hazırlanıyor...',
  'Starting Agent Teams MCP server...': 'Agent Teams MCP sunucusu başlatılıyor...',
  'Agent Teams MCP server is ready...': 'Agent Teams MCP sunucusu hazır...',
  'Preparing OpenCode bridge...': 'OpenCode köprüsü hazırlanıyor...',
  'Runtime not found. Continuing with limited launch support...':
    'Çalışma zamanı bulunamadı. Sınırlı başlatma desteğiyle devam ediliyor...',
  'Using cached shell environment...': 'Önbelleğe alınmış kabuk ortamı kullanılıyor...',
  'Waiting for shell environment...': 'Kabuk ortamı bekleniyor...',
  'Skipping shell environment on Windows...': "Windows'ta kabuk ortamı atlanıyor...",
  'Reading login shell environment...': 'Oturum açma kabuk ortamı okunuyor...',
  'Trying interactive shell environment...': 'Etkileşimli kabuk ortamı deneniyor...',
  'Using current process environment...': 'Mevcut işlem ortamı kullanılıyor...',
  'Using fallback shell environment...': 'Yedek kabuk ortamı kullanılıyor...',
  'Shell environment is still resolving; using fallback for now...':
    'Kabuk ortamı hâlâ çözümleniyor; şimdilik yedek kullanılıyor...',
  'Checking bundled Electron Node runtime...':
    'Paketlenmiş Electron Node çalışma zamanı kontrol ediliyor...',
  'Resolving Node.js runtime for MCP server...':
    'MCP sunucusu için Node.js çalışma zamanı aranıyor...',
  'Trying login shell Node.js runtime...':
    'Oturum açma kabuğundan Node.js çalışma zamanı deneniyor...',
  'Using resolved Node.js runtime...': 'Bulunan Node.js çalışma zamanı kullanılıyor...',
  'Node.js runtime for MCP server was not found.':
    'MCP sunucusu için Node.js çalışma zamanı bulunamadı.',
  'Checking packaged MCP server...': 'Paketlenmiş MCP sunucusu kontrol ediliyor...',
  'Using cached MCP server copy...': 'Önbelleğe alınmış MCP sunucusu kopyası kullanılıyor...',
  'Copying MCP server to app data...': 'MCP sunucusu uygulama verilerine kopyalanıyor...',
  'MCP server copy is ready...': 'MCP sunucusu kopyası hazır...',
  'Using bundled Electron Node runtime...':
    'Paketlenmiş Electron Node çalışma zamanı kullanılıyor...',
  'Bundled Electron Node runtime unavailable, resolving Node.js fallback...':
    'Paketlenmiş Electron Node çalışma zamanı kullanılamıyor, Node.js yedeği aranıyor...',
  'Checking MCP source entry...': 'MCP kaynak girişi kontrol ediliyor...',
  'Resolving MCP TypeScript runner...': 'MCP TypeScript çalıştırıcısı aranıyor...',
  'Checking built MCP server entry...': 'Derlenmiş MCP sunucusu girişi kontrol ediliyor...',
  'Verifying cached runtime...': 'Önbelleğe alınmış çalışma zamanı doğrulanıyor...',
  'Using cached runtime...': 'Önbelleğe alınmış çalışma zamanı kullanılıyor...',
  'Using cached runtime status...': 'Önbelleğe alınmış çalışma zamanı durumu kullanılıyor...',
  'Waiting for runtime lookup...': 'Çalışma zamanı araması bekleniyor...',
  'Checking configured runtime path...': 'Yapılandırılmış çalışma zamanı yolu kontrol ediliyor...',
  'Using configured runtime path...': 'Yapılandırılmış çalışma zamanı yolu kullanılıyor...',
  'Checking bundled Agent Teams runtime...':
    'Paketlenmiş Agent Teams çalışma zamanı kontrol ediliyor...',
  'Using bundled Agent Teams runtime...': 'Paketlenmiş Agent Teams çalışma zamanı kullanılıyor...',
  'Searching PATH for Agent Teams runtime...':
    'PATH üzerinde Agent Teams çalışma zamanı aranıyor...',
  'Using Agent Teams runtime from PATH...': "PATH'teki Agent Teams çalışma zamanı kullanılıyor...",
  'Checking runtime diagnostics fallback...': 'Çalışma zamanı tanılama yedeği kontrol ediliyor...',
  'Using runtime from diagnostics fallback...':
    'Tanılama yedeğinden çalışma zamanı kullanılıyor...',
  'Searching PATH for Claude CLI...': 'PATH üzerinde Claude CLI aranıyor...',
  'Using Claude CLI from PATH...': "PATH'teki Claude CLI kullanılıyor...",
  'Checking standard Claude install locations...':
    'Standart Claude kurulum konumları kontrol ediliyor...',
  'Checking nvm-managed Claude installs...':
    'nvm ile yönetilen Claude kurulumları kontrol ediliyor...',
  'Using Claude CLI from install locations...': 'Kurulum konumlarından Claude CLI kullanılıyor...',
  'Checking Claude diagnostics fallback...': 'Claude tanılama yedeği kontrol ediliyor...',
  'Using Claude CLI from diagnostics fallback...': 'Tanılama yedeğinden Claude CLI kullanılıyor...',
  'Startup failed. Please restart.': 'Başlatma başarısız. Lütfen yeniden başlatın.',
  'Shell startup is still running. Slow shell profile scripts can delay first launch.':
    'Kabuk başlatması hâlâ çalışıyor. Yavaş kabuk profil betikleri ilk açılışı geciktirebilir.',
  'Reading your shell PATH. This can take a few seconds on first launch.':
    'Kabuk PATH okunuyor. İlk açılışta birkaç saniye sürebilir.',
  'Checking Node.js for the local MCP server. This can wait up to 5 seconds.':
    'Yerel MCP sunucusu için Node.js kontrol ediliyor. Bu adım 5 saniyeye kadar sürebilir.',
  'Preparing the packaged MCP server copy. This should only happen after updates.':
    'Paketlenmiş MCP sunucusu kopyası hazırlanıyor. Bu yalnızca güncellemelerden sonra olur.',
  'Searching local runtime paths. A large PATH or slow disk can make this step longer.':
    'Yerel çalışma zamanı yolları aranıyor. Geniş bir PATH veya yavaş disk bu adımı uzatabilir.',
  'Using diagnostics fallback to locate the runtime.':
    'Çalışma zamanını bulmak için tanılama yedeği kullanılıyor.',
  'Loading encrypted local settings.': 'Şifreli yerel ayarlar yükleniyor.',
  'Still working on this startup step.': 'Bu başlatma adımı üzerinde hâlâ çalışılıyor.',
};

const STARTUP_MESSAGE_PATTERNS: Array<{
  pattern: RegExp;
  translate: (match: RegExpMatchArray, locale: ResolvedAppLocale) => string;
}> = [
  {
    pattern: /^Using (.+) runtime mode\.\.\.$/,
    translate: (match, locale) =>
      locale === 'tr' ? `${match[1]} çalışma zamanı modu kullanılıyor...` : match[0]!,
  },
  {
    pattern: /^Startup failed: (.+)$/,
    translate: (match, locale) => (locale === 'tr' ? `Başlatma başarısız: ${match[1]}` : match[0]!),
  },
  {
    pattern: /^Using fallback shell environment after recent failure: (.+)$/,
    translate: (match, locale) =>
      locale === 'tr'
        ? `Son hata nedeniyle yedek kabuk ortamı kullanılıyor: ${match[1]}`
        : match[0]!,
  },
  {
    pattern: /^Using fallback shell environment for (\d+)ms after recent failure\.\.\.$/,
    translate: (match, locale) =>
      locale === 'tr'
        ? `Son hata nedeniyle ${match[1]} ms boyunca yedek kabuk ortamı kullanılıyor...`
        : match[0]!,
  },
];

export interface StartupLocaleResolutionInput {
  readonly preference?: unknown;
  readonly systemLocale?: string | null;
  readonly cachedLocale?: string | null;
  readonly cachedPreference?: string | null;
}

export function resolveStartupLocale(input: StartupLocaleResolutionInput = {}): ResolvedAppLocale {
  const cached = input.cachedLocale?.trim();
  if (cached === 'tr' || cached === 'en') {
    return cached;
  }

  const cachedPreference = input.cachedPreference?.trim();
  if (cachedPreference === 'tr' || cachedPreference === 'en') {
    return cachedPreference;
  }

  return resolveAppLocale({
    preference: cachedPreference ?? input.preference,
    systemLocale: input.systemLocale,
    fallbackLocale: FALLBACK_APP_LOCALE,
  });
}

export function persistStartupLocaleCaches(
  preference: string,
  resolvedLocale: ResolvedAppLocale
): void {
  try {
    localStorage.setItem(STARTUP_LOCALE_PREFERENCE_CACHE_KEY, preference);
    localStorage.setItem(STARTUP_LOCALE_CACHE_KEY, resolvedLocale);
  } catch {
    // Ignore storage failures during startup.
  }
}

export function localizeStartupMessage(message: string, locale: ResolvedAppLocale): string {
  if (locale === 'en') {
    return message;
  }

  const exact = STARTUP_MESSAGE_TRANSLATIONS[message];
  if (exact) {
    return exact;
  }

  for (const entry of STARTUP_MESSAGE_PATTERNS) {
    const match = message.match(entry.pattern);
    if (match) {
      return entry.translate(match, locale);
    }
  }

  return message;
}

export function getInitialSplashMessage(locale: ResolvedAppLocale): string {
  return localizeStartupMessage(STARTUP_INITIAL_MESSAGE_EN, locale);
}

export function localizeStartupTimelineDurationLabel(
  finished: boolean,
  duration: string,
  locale: ResolvedAppLocale
): string {
  if (locale === 'en') {
    return finished ? `took ${duration}` : `running ${duration}`;
  }
  return finished ? `${duration} sürdü` : `${duration} çalışıyor`;
}
