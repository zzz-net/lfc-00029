import { openDB, IDBPDatabase, DBSchema } from 'idb';
import type {
  Template,
  Device,
  InspectionRecord,
  ConflictRecord,
  OperationLog,
  SyncQueueItem,
  AppState,
} from '@/types';

interface InspectionDB extends DBSchema {
  templates: {
    key: string;
    value: Template;
  };
  devices: {
    key: string;
    value: Device;
  };
  inspections: {
    key: string;
    value: InspectionRecord;
    indexes: { 'by-device-date': [string, string] };
  };
  conflicts: {
    key: string;
    value: ConflictRecord;
  };
  logs: {
    key: string;
    value: OperationLog;
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
  };
  appState: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'inspection-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<InspectionDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<InspectionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<InspectionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('devices')) {
          db.createObjectStore('devices', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('inspections')) {
          const store = db.createObjectStore('inspections', { keyPath: 'id' });
          store.createIndex('by-device-date', ['deviceId', 'date']);
        }
        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('appState')) {
          db.createObjectStore('appState', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllTemplates(): Promise<Template[]> {
  const db = await getDB();
  return db.getAll('templates');
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const db = await getDB();
  return db.get('templates', id);
}

export async function putTemplates(templates: Template[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('templates', 'readwrite');
  for (const tpl of templates) {
    await tx.store.put(tpl);
  }
  await tx.done;
}

export async function putTemplate(tpl: Template): Promise<void> {
  const db = await getDB();
  await db.put('templates', tpl);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', id);
}

export async function getAllDevices(): Promise<Device[]> {
  const db = await getDB();
  return db.getAll('devices');
}

export async function getDevice(id: string): Promise<Device | undefined> {
  const db = await getDB();
  return db.get('devices', id);
}

export async function putDevices(devices: Device[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('devices', 'readwrite');
  for (const dev of devices) {
    await tx.store.put(dev);
  }
  await tx.done;
}

export async function getAllInspections(): Promise<InspectionRecord[]> {
  const db = await getDB();
  return db.getAll('inspections');
}

export async function getInspection(id: string): Promise<InspectionRecord | undefined> {
  const db = await getDB();
  return db.get('inspections', id);
}

export async function getInspectionsByDeviceAndDate(
  deviceId: string,
  date: string
): Promise<InspectionRecord[]> {
  const db = await getDB();
  const all = await db.getAll('inspections');
  return all.filter((r) => r.deviceId === deviceId && r.date === date);
}

export async function putInspection(record: InspectionRecord): Promise<void> {
  const db = await getDB();
  await db.put('inspections', record);
}

export async function deleteInspection(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('inspections', id);
}

export async function getAllConflicts(): Promise<ConflictRecord[]> {
  const db = await getDB();
  return db.getAll('conflicts');
}

export async function getConflict(id: string): Promise<ConflictRecord | undefined> {
  const db = await getDB();
  return db.get('conflicts', id);
}

export async function putConflict(conflict: ConflictRecord): Promise<void> {
  const db = await getDB();
  await db.put('conflicts', conflict);
}

export async function deleteConflict(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('conflicts', id);
}

export async function getAllLogs(): Promise<OperationLog[]> {
  const db = await getDB();
  return db.getAll('logs');
}

export async function addLog(log: OperationLog): Promise<void> {
  const db = await getDB();
  await db.add('logs', log);
}

export async function addLogs(logs: OperationLog[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('logs', 'readwrite');
  for (const log of logs) {
    await tx.store.add(log);
  }
  await tx.done;
}

export async function getAllSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function addSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function getAppState(key: string): Promise<any> {
  const db = await getDB();
  const result = await db.get('appState', key);
  return result?.value;
}

export async function setAppState(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('appState', { key, value });
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['templates', 'devices', 'inspections', 'conflicts', 'logs', 'syncQueue'],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore('templates').clear(),
    tx.objectStore('devices').clear(),
    tx.objectStore('inspections').clear(),
    tx.objectStore('conflicts').clear(),
    tx.objectStore('logs').clear(),
    tx.objectStore('syncQueue').clear(),
  ]);
  await tx.done;
}
