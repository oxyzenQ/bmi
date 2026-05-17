// Copyright (c) 2025 - 2026 rezky_nightky
import pkg from '../../../package.json';

export function getAppVersionRaw(): string {
  return typeof pkg.version === 'string' ? pkg.version.trim() : '';
}

export function getAppVersionShort(): string {
  const raw = getAppVersionRaw();
  if (!raw) return '0.0';

  const [major = '0', minor = '0'] = raw.split('.');
  return `${major}.${minor}`;
}

export function getStellarVersionLabel(): string {
  return `Stellar v${getAppVersionShort()}`;
}
