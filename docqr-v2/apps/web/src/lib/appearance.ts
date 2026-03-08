export type ThemePreference = 'light' | 'dark' | 'system';
export type FontSizePreference = 'small' | 'default' | 'large';

export interface AppearancePreferences {
  theme: ThemePreference;
  accentColor: string;
  fontSize: FontSizePreference;
}

const STORAGE_KEY = 'docqr:appearance';

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'system',
  accentColor: '#4F46E5',
  fontSize: 'default',
};

export function loadAppearancePreferences(): AppearancePreferences {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_APPEARANCE;

  try {
    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_APPEARANCE.theme,
      accentColor: isHexColor(parsed.accentColor) ? parsed.accentColor : DEFAULT_APPEARANCE.accentColor,
      fontSize: isFontSize(parsed.fontSize) ? parsed.fontSize : DEFAULT_APPEARANCE.fontSize,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearancePreferences(preferences: AppearancePreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function applyAppearancePreferences(preferences: AppearancePreferences): void {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(preferences.theme);

  root.classList.toggle('dark', resolvedTheme === 'dark');

  const hsl = hexToHsl(preferences.accentColor);
  if (hsl) {
    root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    root.style.setProperty('--ring', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    root.style.setProperty('--primary-foreground', hsl.l > 65 ? '222.2 47.4% 11.2%' : '210 40% 98%');
  }

  const sizePx = preferences.fontSize === 'small' ? '14px' : preferences.fontSize === 'large' ? '18px' : '16px';
  root.style.fontSize = sizePx;
}

function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isFontSize(value: unknown): value is FontSizePreference {
  return value === 'small' || value === 'default' || value === 'large';
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([A-Fa-f0-9]{6})$/.test(value);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }

    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  };
}
