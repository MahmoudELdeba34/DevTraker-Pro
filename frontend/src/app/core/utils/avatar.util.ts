import { environment } from '../../../environments/environment';

export function getInitials(name: string, max = 2): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.substring(0, max).toUpperCase();
}

export function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl?.trim()) return null;
  const url = avatarUrl.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const origin = environment.apiUrl.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}
