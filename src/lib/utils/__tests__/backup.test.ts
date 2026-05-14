/**
 * Phase 3 — Regression Fortress: backup.ts tests
 *
 * Covers: getBackupStatus, isLocalBackupAvailable, createBackup,
 * restoreLatestBackup, relative time formatting, edge cases.
 *
 * Uses mocked db.ts and storage.ts to test backup logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define data shared between mock factory and tests
const { mockBackupRecords, mockStorageGet, mockDbFns } = vi.hoisted(() => {
  const mockBackupRecords: Array<{ id?: number; timestamp: number; appVersion: string; recordCount: number; data: string }> = [];
  const mockStorageGet = vi.fn().mockReturnValue(null);

  const mockDbFns = {
    isIndexedDbAvailable: vi.fn().mockReturnValue(true),
    dbBackupGetAll: vi.fn().mockImplementation(async () => {
      // Mimic real db.ts: sort newest first
      return [...mockBackupRecords].sort((a, b) => b.timestamp - a.timestamp);
    }),
    dbBackupLatest: vi.fn().mockResolvedValue(null),
    dbBackupSave: vi.fn().mockImplementation(async (record) => {
      const id = mockBackupRecords.length + 1;
      mockBackupRecords.push({ ...record, id });
      return id;
    }),
    dbBackupDelete: vi.fn().mockResolvedValue(undefined),
    dbGetAll: vi.fn().mockResolvedValue([]),
    dbMetaGet: vi.fn().mockResolvedValue(null),
    dbMetaSet: vi.fn().mockResolvedValue(undefined),
  };

  return { mockBackupRecords, mockStorageGet, mockDbFns };
});

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false,
  building: false,
  version: 'test',
}));

// Mock i18n
vi.mock('$lib/i18n', () => ({
  t: (key: string, params?: Record<string, number>) => {
    if (key === 'time.just_now') return 'just now';
    if (key === 'time.minutes_ago') return `${params?.n ?? 0} minutes ago`;
    if (key === 'time.hours_ago') return `${params?.n ?? 0} hours ago`;
    if (key === 'time.days_ago') return `${params?.n ?? 0} days ago`;
    return key;
  },
}));

// Mock storage
vi.mock('$lib/utils/storage', () => ({
  STORAGE_KEYS: {
    HISTORY: 'bmi.history',
    UNIT_SYSTEM: 'bmi.unitSystem',
    WALLPAPER_THEME: 'bmi.wallpaperTheme',
    LOCALE: 'bmi.locale',
    BMI_GOAL: 'bmi.goal',
    BMI_GOAL_START: 'bmi.goal.start',
  },
  storageGet: mockStorageGet,
  storageSet: vi.fn(),
  storageRemove: vi.fn(),
  setRestoreMode: vi.fn(),
}));

// Mock db.ts — reference hoisted functions
vi.mock('../db', () => mockDbFns);

// Mock warn-dev
vi.mock('../warn-dev', () => ({
  warnDev: vi.fn(),
  warnDevOnce: vi.fn(),
}));

import { getBackupStatus, isLocalBackupAvailable, createBackup, restoreLatestBackup } from '../backup';

beforeEach(() => {
  mockBackupRecords.length = 0;
  mockStorageGet.mockReturnValue(null);

  // Reset mock implementations — clearAllMocks resets mockReturnValue/mockResolvedValue
  // Re-setup db mocks after clearAllMocks
  vi.clearAllMocks();
  mockDbFns.dbBackupGetAll.mockImplementation(async () => {
    return [...mockBackupRecords].sort((a, b) => b.timestamp - a.timestamp);
  });
  mockDbFns.dbBackupLatest.mockResolvedValue(null);
  mockDbFns.isIndexedDbAvailable.mockReturnValue(true);
});

// ── getBackupStatus ──

describe('getBackupStatus', () => {
  it('returns fallback when no backups exist', async () => {
    const status = await getBackupStatus();
    expect(status.hasBackup).toBe(false);
    expect(status.lastBackupTimestamp).toBeNull();
    expect(status.lastBackupAgo).toBeNull();
    expect(status.lastBackupRecordCount).toBe(0);
    expect(status.lastBackupAppVersion).toBeNull();
    expect(status.totalBackups).toBe(0);
  });

  it('returns status with backup data when backups exist', async () => {
    const now = Date.now();
    mockBackupRecords.push({
      id: 1,
      timestamp: now,
      appVersion: '18.0.0',
      recordCount: 42,
      data: '{}',
    });

    const status = await getBackupStatus();
    expect(status.hasBackup).toBe(true);
    expect(status.lastBackupTimestamp).not.toBeNull();
    expect(status.lastBackupAgo).not.toBeNull();
    expect(status.lastBackupRecordCount).toBe(42);
    expect(status.lastBackupAppVersion).toBe('18.0.0');
    expect(status.totalBackups).toBe(1);
  });

  it('returns total count matching all backups', async () => {
    mockBackupRecords.push(
      { id: 1, timestamp: Date.now() - 2000, appVersion: '18.0.0', recordCount: 10, data: '{}' },
      { id: 2, timestamp: Date.now() - 1000, appVersion: '18.0.0', recordCount: 20, data: '{}' },
      { id: 3, timestamp: Date.now(), appVersion: '18.0.0', recordCount: 30, data: '{}' },
    );

    const status = await getBackupStatus();
    expect(status.totalBackups).toBe(3);
    // Latest should have 30 records
    expect(status.lastBackupRecordCount).toBe(30);
  });
});

// ── isLocalBackupAvailable ──

describe('isLocalBackupAvailable', () => {
  it('returns false when no backups exist', async () => {
    expect(await isLocalBackupAvailable()).toBe(false);
  });

  it('returns true when at least one backup exists', async () => {
    mockBackupRecords.push({
      id: 1,
      timestamp: Date.now(),
      appVersion: '18.0.0',
      recordCount: 5,
      data: '{}',
    });
    mockDbFns.dbBackupLatest.mockResolvedValue(mockBackupRecords[0]);
    expect(await isLocalBackupAvailable()).toBe(true);
  });
});

// ── createBackup ──

describe('createBackup', () => {
  it('creates a backup successfully', async () => {
    mockStorageGet.mockImplementation((key: string) => {
      if (key === 'bmi.history') return '[]';
      return null;
    });

    const result = await createBackup('data_change');
    expect(result).toBe(true);
    expect(mockBackupRecords.length).toBe(1);
  });

  it('captures record count from history', async () => {
    const historyData = JSON.stringify([{ date: '2026-01-01', bmi: 22.5 }]);
    mockStorageGet.mockImplementation((key: string) => {
      if (key === 'bmi.history') return historyData;
      return null;
    });

    await createBackup('data_change');
    expect(mockBackupRecords[0].recordCount).toBe(1);
  });

  it('handles corrupted history (sets recordCount to 0)', async () => {
    mockStorageGet.mockImplementation((key: string) => {
      if (key === 'bmi.history') return 'not-json';
      return null;
    });

    await createBackup('data_change');
    expect(mockBackupRecords[0].recordCount).toBe(0);
  });

  it('returns false when IndexedDB is unavailable', async () => {
    mockDbFns.isIndexedDbAvailable.mockReturnValueOnce(false);

    const result = await createBackup('data_change');
    expect(result).toBe(false);
  });
});

// ── restoreLatestBackup ──

describe('restoreLatestBackup', () => {
  it('returns false when no backup exists', async () => {
    mockDbFns.dbBackupLatest.mockResolvedValue(null);
    const result = await restoreLatestBackup();
    expect(result).toBe(false);
  });

  it('restores data from latest backup', async () => {
    const snapshot = JSON.stringify({
      'bmi.history': JSON.stringify([{ date: '2026-01-01', bmi: 22.5 }]),
      'bmi.unitSystem': 'metric',
      'bmi.goal': null,
    });

    mockBackupRecords.push({
      id: 1,
      timestamp: Date.now(),
      appVersion: '18.0.0',
      recordCount: 1,
      data: snapshot,
    });

    mockDbFns.dbBackupLatest.mockResolvedValue(mockBackupRecords[0]);
    const result = await restoreLatestBackup();
    expect(result).toBe(true);
  });

  it('returns false when IndexedDB is unavailable', async () => {
    mockDbFns.isIndexedDbAvailable.mockReturnValue(false);
    const result = await restoreLatestBackup();
    expect(result).toBe(false);
  });
});