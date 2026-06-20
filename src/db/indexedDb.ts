import { openDB, IDBPDatabase, IDBPObjectStore, DBSchema, StoreNames } from 'idb';
import type {
  Template,
  Device,
  InspectionRecord,
  ConflictRecord,
  OperationLog,
  SyncQueueItem,
  AppState,
  StatusChangeEvent,
  SubmissionSnapshot,
  RecordMeta,
  SubmissionReceipt,
  AuditLogEntry,
  SessionState,
  RevertDraftState,
  RevertImportResult,
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
    indexes: { 'by-device-date': [string, string]; 'by-status': string; 'by-date': string };
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
  statusHistory: {
    key: string;
    value: StatusChangeEvent;
    indexes: { 'by-record': string; 'by-record-timestamp': [string, string]; 'by-device': string };
  };
  submissionSnapshots: {
    key: string;
    value: SubmissionSnapshot;
    indexes: { 'by-record': string; 'by-record-snapshot': [string, string] };
  };
  recordMeta: {
    key: string;
    value: RecordMeta;
  };
  submissionReceipts: {
    key: string;
    value: SubmissionReceipt;
    indexes: { 'by-record': string; 'by-receipt-no': string; 'by-device': string };
  };
  auditLogs: {
    key: string;
    value: AuditLogEntry;
    indexes: { 'by-record': string; 'by-record-timestamp': [string, string]; 'by-operator': string };
  };
  sessionStates: {
    key: string;
    value: SessionState;
    indexes: { 'by-user-device': [string, string] };
  };
  revertDrafts: {
    key: string;
    value: RevertDraftState;
    indexes: { 'by-device': string; 'by-createdAt': string };
  };
  revertImportHistory: {
    key: string;
    value: RevertImportResult;
    indexes: { 'by-device': string; 'by-createdAt': string };
  };
}

const DB_NAME = 'inspection-db';
const DB_VERSION = 4;

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
          store.createIndex('by-status', 'status');
          store.createIndex('by-date', 'date');
        } else {
          const tx = db.transaction('inspections', 'versionchange');
          const inspStore = tx.store;
          if (!inspStore.indexNames.contains('by-status')) {
            inspStore.createIndex('by-status', 'status');
          }
          if (!inspStore.indexNames.contains('by-date')) {
            inspStore.createIndex('by-date', 'date');
          }
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
        if (!db.objectStoreNames.contains('statusHistory')) {
          const sh = db.createObjectStore('statusHistory', { keyPath: 'id' });
          sh.createIndex('by-record', 'recordId');
          sh.createIndex('by-record-timestamp', ['recordId', 'timestamp']);
          sh.createIndex('by-device', 'deviceId');
        }
        if (!db.objectStoreNames.contains('submissionSnapshots')) {
          const ss = db.createObjectStore('submissionSnapshots', { keyPath: 'id' });
          ss.createIndex('by-record', 'recordId');
          ss.createIndex('by-record-snapshot', ['recordId', 'snapshotAt']);
        }
        if (!db.objectStoreNames.contains('recordMeta')) {
          db.createObjectStore('recordMeta', { keyPath: 'recordId' });
        }
        if (!db.objectStoreNames.contains('submissionReceipts')) {
          const sr = db.createObjectStore('submissionReceipts', { keyPath: 'id' });
          sr.createIndex('by-record', 'recordId');
          sr.createIndex('by-receipt-no', 'receiptNo', { unique: true });
          sr.createIndex('by-device', 'sourceDeviceId');
        }
        if (!db.objectStoreNames.contains('auditLogs')) {
          const al = db.createObjectStore('auditLogs', { keyPath: 'id' });
          al.createIndex('by-record', 'recordId');
          al.createIndex('by-record-timestamp', ['recordId', 'timestamp']);
          al.createIndex('by-operator', 'operatorId');
        }
        if (!db.objectStoreNames.contains('sessionStates')) {
          const ss = db.createObjectStore('sessionStates', { keyPath: 'id' });
          ss.createIndex('by-user-device', ['userId', 'deviceId']);
        }
        if (!db.objectStoreNames.contains('revertDrafts')) {
          const rd = db.createObjectStore('revertDrafts', { keyPath: 'id' });
          rd.createIndex('by-device', 'deviceFingerprint');
          rd.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('revertImportHistory')) {
          const rh = db.createObjectStore('revertImportHistory', { keyPath: 'batchId' });
          rh.createIndex('by-device', 'deviceId');
          rh.createIndex('by-createdAt', 'createdAt');
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

export async function getAllStatusHistory(): Promise<StatusChangeEvent[]> {
  const db = await getDB();
  return db.getAll('statusHistory');
}

export async function getStatusHistoryByRecord(recordId: string): Promise<StatusChangeEvent[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('statusHistory', 'by-record', recordId);
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getLastStatusChange(recordId: string): Promise<StatusChangeEvent | undefined> {
  const history = await getStatusHistoryByRecord(recordId);
  return history[0];
}

export async function addStatusChangeEvent(event: StatusChangeEvent): Promise<void> {
  const db = await getDB();
  await db.add('statusHistory', event);
}

export async function addStatusChangeEvents(events: StatusChangeEvent[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('statusHistory', 'readwrite');
  for (const e of events) {
    await tx.store.add(e);
  }
  await tx.done;
}

export async function deleteStatusHistoryByRecord(recordId: string): Promise<void> {
  const db = await getDB();
  const items = await db.getAllFromIndex('statusHistory', 'by-record', recordId);
  const tx = db.transaction('statusHistory', 'readwrite');
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

export async function getAllSubmissionSnapshots(): Promise<SubmissionSnapshot[]> {
  const db = await getDB();
  return db.getAll('submissionSnapshots');
}

export async function getSubmissionSnapshotsByRecord(recordId: string): Promise<SubmissionSnapshot[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('submissionSnapshots', 'by-record', recordId);
  return all.sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt));
}

export async function getLatestSubmissionSnapshot(recordId: string): Promise<SubmissionSnapshot | undefined> {
  const list = await getSubmissionSnapshotsByRecord(recordId);
  return list[0];
}

export async function addSubmissionSnapshot(snapshot: SubmissionSnapshot): Promise<void> {
  const db = await getDB();
  await db.add('submissionSnapshots', snapshot);
}

export async function deleteSubmissionSnapshotsByRecord(recordId: string): Promise<void> {
  const db = await getDB();
  const items = await db.getAllFromIndex('submissionSnapshots', 'by-record', recordId);
  const tx = db.transaction('submissionSnapshots', 'readwrite');
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

export async function getAllRecordMeta(): Promise<RecordMeta[]> {
  const db = await getDB();
  return db.getAll('recordMeta');
}

export async function getRecordMeta(recordId: string): Promise<RecordMeta | undefined> {
  const db = await getDB();
  return db.get('recordMeta', recordId);
}

export async function putRecordMeta(meta: RecordMeta): Promise<void> {
  const db = await getDB();
  await db.put('recordMeta', meta);
}

export async function deleteRecordMeta(recordId: string): Promise<void> {
  const db = await getDB();
  await db.delete('recordMeta', recordId);
}

export async function getAllSubmissionReceipts(): Promise<SubmissionReceipt[]> {
  const db = await getDB();
  return db.getAll('submissionReceipts');
}

export async function getReceiptsByRecord(recordId: string): Promise<SubmissionReceipt[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('submissionReceipts', 'by-record', recordId);
  return all.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function getReceiptById(id: string): Promise<SubmissionReceipt | undefined> {
  const db = await getDB();
  return db.get('submissionReceipts', id);
}

export async function getReceiptByNo(receiptNo: string): Promise<SubmissionReceipt | undefined> {
  const db = await getDB();
  return db.getFromIndex('submissionReceipts', 'by-receipt-no', receiptNo);
}

export async function putSubmissionReceipt(receipt: SubmissionReceipt): Promise<void> {
  const db = await getDB();
  await db.put('submissionReceipts', receipt);
}

export async function deleteReceiptsByRecord(recordId: string): Promise<void> {
  const db = await getDB();
  const items = await db.getAllFromIndex('submissionReceipts', 'by-record', recordId);
  const tx = db.transaction('submissionReceipts', 'readwrite');
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

export async function getAllAuditLogs(): Promise<AuditLogEntry[]> {
  const db = await getDB();
  return db.getAll('auditLogs');
}

export async function getAuditLogsByRecord(recordId: string): Promise<AuditLogEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('auditLogs', 'by-record', recordId);
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getAuditLogById(id: string): Promise<AuditLogEntry | undefined> {
  const db = await getDB();
  return db.get('auditLogs', id);
}

export async function addAuditLog(log: AuditLogEntry): Promise<void> {
  const db = await getDB();
  await db.add('auditLogs', log);
}

export async function addAuditLogs(logs: AuditLogEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('auditLogs', 'readwrite');
  for (const log of logs) {
    await tx.store.add(log);
  }
  await tx.done;
}

export async function deleteAuditLogsByRecord(recordId: string): Promise<void> {
  const db = await getDB();
  const items = await db.getAllFromIndex('auditLogs', 'by-record', recordId);
  const tx = db.transaction('auditLogs', 'readwrite');
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

export async function getAllSessionStates(): Promise<SessionState[]> {
  const db = await getDB();
  return db.getAll('sessionStates');
}

export async function getSessionState(id: string): Promise<SessionState | undefined> {
  const db = await getDB();
  return db.get('sessionStates', id);
}

export async function getSessionByUserDevice(userId: string, deviceId: string): Promise<SessionState | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessionStates', 'by-user-device', [userId, deviceId]);
  return all.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))[0];
}

export async function putSessionState(session: SessionState): Promise<void> {
  const db = await getDB();
  await db.put('sessionStates', session);
}

export async function deleteSessionState(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessionStates', id);
}

export async function getAllRevertDrafts(): Promise<RevertDraftState[]> {
  const db = await getDB();
  return db.getAll('revertDrafts');
}

export async function getRevertDraft(id: string): Promise<RevertDraftState | undefined> {
  const db = await getDB();
  return db.get('revertDrafts', id);
}

export async function getLatestRevertDraftByDevice(deviceFingerprint: string): Promise<RevertDraftState | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex('revertDrafts', 'by-device', deviceFingerprint);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function putRevertDraft(draft: RevertDraftState): Promise<void> {
  const db = await getDB();
  await db.put('revertDrafts', draft);
}

export async function deleteRevertDraft(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('revertDrafts', id);
}

export async function getAllRevertImportHistory(): Promise<RevertImportResult[]> {
  const db = await getDB();
  const all = await db.getAll('revertImportHistory');
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRevertImportHistory(batchId: string): Promise<RevertImportResult | undefined> {
  const db = await getDB();
  return db.get('revertImportHistory', batchId);
}

export async function putRevertImportHistory(history: RevertImportResult): Promise<void> {
  const db = await getDB();
  await db.put('revertImportHistory', history);
}

export async function deleteRevertImportHistory(batchId: string): Promise<void> {
  const db = await getDB();
  await db.delete('revertImportHistory', batchId);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['templates', 'devices', 'inspections', 'conflicts', 'logs', 'syncQueue', 'statusHistory', 'submissionSnapshots', 'recordMeta', 'submissionReceipts', 'auditLogs', 'sessionStates', 'revertDrafts', 'revertImportHistory'],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore('templates').clear(),
    tx.objectStore('devices').clear(),
    tx.objectStore('inspections').clear(),
    tx.objectStore('conflicts').clear(),
    tx.objectStore('logs').clear(),
    tx.objectStore('syncQueue').clear(),
    tx.objectStore('statusHistory').clear(),
    tx.objectStore('submissionSnapshots').clear(),
    tx.objectStore('recordMeta').clear(),
    tx.objectStore('submissionReceipts').clear(),
    tx.objectStore('auditLogs').clear(),
    tx.objectStore('sessionStates').clear(),
    tx.objectStore('revertDrafts').clear(),
    tx.objectStore('revertImportHistory').clear(),
  ]);
  await tx.done;
}
