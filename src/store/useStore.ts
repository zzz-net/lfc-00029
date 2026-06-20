import { create } from 'zustand';
import {
  getAllTemplates,
  putTemplates,
  putTemplate,
  deleteTemplate as dbDeleteTemplate,
  getAllDevices,
  putDevices,
  getAllInspections,
  putInspection,
  getAllConflicts,
  putConflict,
  getAllLogs,
  addLog as dbAddLog,
  getAllSyncQueue,
  addSyncQueueItem,
  deleteSyncQueueItem,
  getAppState,
  setAppState,
  getAllStatusHistory,
  addStatusChangeEvent as dbAddStatusEvent,
  getAllSubmissionSnapshots,
  addSubmissionSnapshot as dbAddSnapshot,
  getAllRecordMeta,
  putRecordMeta as dbPutMeta,
  deleteSyncQueueItem as dbDeleteSyncItem,
} from '@/db/indexedDb';
import { apiClient } from '@/api/client';
import { generateId, getTodayString } from '@/utils/id';
import { calculateAnomalyLevel } from '@/utils/anomaly';
import type {
  Template,
  Device,
  InspectionRecord,
  ConflictRecord,
  OperationLog,
  SyncQueueItem,
  UserRole,
  StatusChangeEvent,
  SubmissionSnapshot,
  RecordMeta,
  StatusChangeAction,
  ConflictResolution,
  RecordStatus,
} from '@/types';

interface AppStore {
  role: UserRole;
  offlineMode: boolean;
  networkStatus: 'online' | 'offline';
  currentUserId: string;
  currentUserName: string;

  templates: Template[];
  devices: Device[];
  inspections: InspectionRecord[];
  conflicts: ConflictRecord[];
  logs: OperationLog[];
  syncQueue: SyncQueueItem[];
  statusHistory: StatusChangeEvent[];
  submissionSnapshots: SubmissionSnapshot[];
  recordMetaList: RecordMeta[];

  isLoading: boolean;
  error: string | null;

  sessionRecovered: boolean;
  lastVisitAt: string | null;

  setRole: (role: UserRole) => void;
  setOfflineMode: (offline: boolean) => void;
  setNetworkStatus: (status: 'online' | 'offline') => void;

  loadInitialData: () => Promise<void>;
  refreshFromServer: () => Promise<void>;

  createTemplate: (data: Partial<Template>) => Promise<Template>;
  updateTemplate: (id: string, data: Partial<Template>) => Promise<Template>;
  deleteTemplate: (id: string) => Promise<void>;

  seedDevices: () => Promise<void>;

  saveInspectionDraft: (data: Partial<InspectionRecord>) => Promise<InspectionRecord>;
  submitInspection: (data: Partial<InspectionRecord>) => Promise<InspectionRecord>;
  withdrawInspection: (recordId: string) => Promise<InspectionRecord>;

  syncAll: () => Promise<{ success: number; conflicts: number; errors: number }>;
  resolveConflict: (
    conflictId: string,
    resolution: ConflictResolution
  ) => Promise<void>;

  addLogEntry: (log: Omit<OperationLog, 'id' | 'timestamp'>) => Promise<void>;

  getRecordMeta: (recordId: string) => RecordMeta | undefined;
  getStatusHistory: (recordId: string) => StatusChangeEvent[];
  getSubmissionSnapshots: (recordId: string) => SubmissionSnapshot[];
  getLatestSnapshot: (recordId: string) => SubmissionSnapshot | undefined;

  markRecordExported: (recordId: string) => Promise<void>;

  resetError: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  role: 'inspector',
  offlineMode: false,
  networkStatus: 'online',
  currentUserId: 'inspector_001',
  currentUserName: '张巡检',

  templates: [],
  devices: [],
  inspections: [],
  conflicts: [],
  logs: [],
  syncQueue: [],
  statusHistory: [],
  submissionSnapshots: [],
  recordMetaList: [],

  isLoading: false,
  error: null,

  sessionRecovered: false,
  lastVisitAt: null,

  setRole: (role: UserRole) => {
    set({ role });
    setAppState('role', role);
  },

  setOfflineMode: (offline: boolean) => {
    set({ offlineMode: offline, networkStatus: offline ? 'offline' : 'online' });
    setAppState('offlineMode', offline);
  },

  setNetworkStatus: (status: 'online' | 'offline') => {
    set({ networkStatus: status });
  },

  loadInitialData: async () => {
    set({ isLoading: true });
    try {
      const [
        templates,
        devices,
        inspections,
        conflicts,
        logs,
        syncQueue,
        statusHistory,
        submissionSnapshots,
        recordMetaList,
        savedRole,
        savedOffline,
        lastVisit,
      ] = await Promise.all([
        getAllTemplates(),
        getAllDevices(),
        getAllInspections(),
        getAllConflicts(),
        getAllLogs(),
        getAllSyncQueue(),
        getAllStatusHistory(),
        getAllSubmissionSnapshots(),
        getAllRecordMeta(),
        getAppState('role'),
        getAppState('offlineMode'),
        getAppState('lastVisitAt'),
      ]);

      const now = new Date().toISOString();
      await setAppState('lastVisitAt', now);

      const drafts = inspections.filter((r) => r.status === 'draft').length;
      const pending = inspections.filter((r) => r.status === 'submitted').length;

      set({
        templates,
        devices,
        inspections,
        conflicts,
        logs,
        syncQueue,
        statusHistory,
        submissionSnapshots,
        recordMetaList,
        role: savedRole || 'inspector',
        offlineMode: savedOffline || false,
        networkStatus: savedOffline ? 'offline' : 'online',
        lastVisitAt: lastVisit || null,
        sessionRecovered: true,
      });

      if (!savedOffline) {
        try {
          await get().refreshFromServer();
        } catch (e) {
          console.warn('Failed to refresh from server, using local data');
        }
      }
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshFromServer: async () => {
    if (get().offlineMode) return;

    try {
      const [templates, devices, inspections, logs] = await Promise.all([
        apiClient.templates.list(),
        apiClient.devices.list(),
        apiClient.inspections.list(),
        apiClient.logs.list(),
      ]);

      await Promise.all([
        putTemplates(templates),
        putDevices(devices),
        ...inspections.map((r) => putInspection(r)),
        ...logs.slice(0, 100).map((l) => dbAddLog(l)),
      ]);

      set({ templates, devices, inspections, logs });
    } catch (e) {
      console.error('Refresh failed:', e);
      throw e;
    }
  },

  createTemplate: async (data: Partial<Template>) => {
    const { offlineMode, currentUserId, currentUserName } = get();

    if (offlineMode) {
      const now = new Date().toISOString();
      const tpl: Template = {
        id: generateId('tpl'),
        name: data.name || '新模板',
        version: 1,
        enabled: data.enabled ?? true,
        fields: data.fields || [],
        createdAt: now,
        updatedAt: now,
      };
      await putTemplate(tpl);
      set((state) => ({ templates: [...state.templates, tpl] }));
      await get().addLogEntry({
        userId: currentUserId,
        userName: currentUserName,
        action: '创建模板',
        target: tpl.id,
        detail: `创建了模板：${tpl.name}`,
        result: 'success',
      });
      return tpl;
    }

    const tpl = await apiClient.templates.create(data);
    await putTemplate(tpl);
    set((state) => ({ templates: [...state.templates, tpl] }));
    return tpl;
  },

  updateTemplate: async (id: string, data: Partial<Template>) => {
    const { offlineMode, templates, currentUserId, currentUserName } = get();
    const existing = templates.find((t) => t.id === id);
    if (!existing) throw new Error('模板不存在');

    if (offlineMode) {
      const versionIncrement = data.fields && JSON.stringify(existing.fields) !== JSON.stringify(data.fields);
      const updated: Template = {
        ...existing,
        ...data,
        version: versionIncrement ? existing.version + 1 : existing.version,
        updatedAt: new Date().toISOString(),
      };
      await putTemplate(updated);
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? updated : t)),
      }));
      await get().addLogEntry({
        userId: currentUserId,
        userName: currentUserName,
        action: '更新模板',
        target: id,
        detail: `更新了模板：${updated.name}`,
        result: 'success',
      });
      return updated;
    }

    const updated = await apiClient.templates.update(id, data);
    await putTemplate(updated);
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? updated : t)),
    }));
    return updated;
  },

  deleteTemplate: async (id: string) => {
    const { offlineMode } = get();

    if (offlineMode) {
      await dbDeleteTemplate(id);
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }));
      return;
    }

    await apiClient.templates.remove(id);
    await dbDeleteTemplate(id);
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },

  seedDevices: async () => {
    const { offlineMode, devices } = get();
    if (devices.length > 0) return;

    if (offlineMode) {
      const sampleDevices: Device[] = [
        { id: generateId('dev'), code: 'PUMP-001', name: '1号循环泵', location: 'A区泵房', category: '泵类', status: 'normal' },
        { id: generateId('dev'), code: 'PUMP-002', name: '2号循环泵', location: 'A区泵房', category: '泵类', status: 'normal' },
        { id: generateId('dev'), code: 'VALVE-101', name: '主管道阀门', location: 'B区管廊', category: '阀门', status: 'normal' },
        { id: generateId('dev'), code: 'MOTOR-201', name: '送风机电机', location: 'C区车间', category: '电机', status: 'maintenance' },
        { id: generateId('dev'), code: 'SENSOR-301', name: '温度传感器组', location: 'D区控制室', category: '仪表', status: 'normal' },
        { id: generateId('dev'), code: 'COMP-401', name: '空压机', location: 'E区动力房', category: '压缩机', status: 'normal' },
        { id: generateId('dev'), code: 'TRANS-501', name: '主变压器', location: 'F区变电站', category: '电气', status: 'normal' },
        { id: generateId('dev'), code: 'BOILER-601', name: '蒸汽锅炉', location: 'G区锅炉房', category: '锅炉', status: 'offline' },
      ];
      await putDevices(sampleDevices);
      set({ devices: sampleDevices });
      return;
    }

    const result = await apiClient.devices.seed();
    if (result.seeded) {
      set({ devices: result.devices });
      await putDevices(result.devices);
    }
  },

  getRecordMeta: (recordId: string) => {
    return get().recordMetaList.find((m) => m.recordId === recordId);
  },

  getStatusHistory: (recordId: string) => {
    return get().statusHistory
      .filter((e) => e.recordId === recordId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  getSubmissionSnapshots: (recordId: string) => {
    return get().submissionSnapshots
      .filter((s) => s.recordId === recordId)
      .sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt));
  },

  getLatestSnapshot: (recordId: string) => {
    const list = get().getSubmissionSnapshots(recordId);
    return list[0];
  },

  saveInspectionDraft: async (data: Partial<InspectionRecord>) => {
    const { inspections, templates, currentUserId, currentUserName } = get();

    const template = templates.find((t) => t.id === data.templateId);
    if (!template && data.templateId) {
      throw new Error('模板不存在');
    }

    const anomalyLevel = template && data.values
      ? calculateAnomalyLevel(data.values, template.fields)
      : 'none';

    const now = new Date().toISOString();
    let record: InspectionRecord;
    let isNew = false;
    let prevStatus: RecordStatus | null = null;
    let action: StatusChangeAction = 'save_draft';

    if (data.id) {
      const existing = inspections.find((r) => r.id === data.id);
      if (existing) {
        prevStatus = existing.status;
        record = {
          ...existing,
          ...data,
          anomalyLevel,
          status: 'draft',
          updatedAt: now,
          originDeviceId: existing.originDeviceId || 'local',
        };
      } else {
        isNew = true;
        action = 'create_draft';
        record = {
          id: data.id,
          deviceId: data.deviceId || '',
          templateId: data.templateId || '',
          templateVersion: template?.version || 1,
          inspectorId: currentUserId,
          inspectorName: currentUserName,
          date: data.date || getTodayString(),
          values: data.values || {},
          photos: data.photos || [],
          anomalyLevel,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          submissionCount: 0,
          withdrawCount: 0,
          originDeviceId: 'local',
        };
      }
    } else {
      isNew = true;
      action = 'create_draft';
      record = {
        id: generateId('rec'),
        deviceId: data.deviceId || '',
        templateId: data.templateId || '',
        templateVersion: template?.version || 1,
        inspectorId: currentUserId,
        inspectorName: currentUserName,
        date: data.date || getTodayString(),
        values: data.values || {},
        photos: data.photos || [],
        anomalyLevel,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        submissionCount: 0,
        withdrawCount: 0,
        originDeviceId: 'local',
      };
    }

    await putInspection(record);

    if (isNew) {
      const meta: RecordMeta = {
        recordId: record.id,
        submissionCount: 0,
        withdrawCount: 0,
        hasConflict: false,
        exportCount: 0,
      };
      await dbPutMeta(meta);
      set((state) => ({ recordMetaList: [...state.recordMetaList, meta] }));

      const event: StatusChangeEvent = {
        id: generateId('evt'),
        recordId: record.id,
        fromStatus: null,
        toStatus: 'draft',
        action: 'create_draft',
        actorId: currentUserId,
        actorName: currentUserName,
        timestamp: now,
        note: '创建新草稿',
        deviceId: record.deviceId,
        date: record.date,
      };
      await dbAddStatusEvent(event);
      set((state) => ({ statusHistory: [...state.statusHistory, event] }));
    } else if (prevStatus && prevStatus !== 'draft') {
      const event: StatusChangeEvent = {
        id: generateId('evt'),
        recordId: record.id,
        fromStatus: prevStatus,
        toStatus: 'draft',
        action: 'save_draft',
        actorId: currentUserId,
        actorName: currentUserName,
        timestamp: now,
        note: '编辑后保存为草稿',
        deviceId: record.deviceId,
        date: record.date,
      };
      await dbAddStatusEvent(event);
      set((state) => ({ statusHistory: [...state.statusHistory, event] }));
    }

    const existingSameDay = inspections.filter(
      (r) => r.deviceId === record.deviceId && r.date === record.date && r.id !== record.id
    );
    if (existingSameDay.length > 0 && isNew) {
      await get().addLogEntry({
        userId: currentUserId,
        userName: currentUserName,
        action: '保存草稿（同日多版本）',
        target: record.deviceId,
        detail: `${record.date} 该设备已有 ${existingSameDay.length + 1} 个草稿版本`,
        result: 'success',
      });
    }

    set((state) => {
      const exists = state.inspections.some((r) => r.id === record.id);
      return {
        inspections: exists
          ? state.inspections.map((r) => (r.id === record.id ? record : r))
          : [...state.inspections, record],
      };
    });
    return record;
  },

  submitInspection: async (data: Partial<InspectionRecord>) => {
    const { offlineMode, inspections, templates, currentUserId, currentUserName, recordMetaList, statusHistory } = get();

    const template = templates.find((t) => t.id === data.templateId);
    if (!template) throw new Error('模板不存在');

    const anomalyLevel = data.values
      ? calculateAnomalyLevel(data.values, template.fields)
      : 'none';

    const now = new Date().toISOString();
    let record: InspectionRecord;
    let isNew = false;
    let prevStatus: RecordStatus | null = null;

    if (data.id) {
      const existing = inspections.find((r) => r.id === data.id);
      if (existing) {
        prevStatus = existing.status;
        const newSubCount = (existing.submissionCount || 0) + 1;
        record = {
          ...existing,
          ...data,
          anomalyLevel,
          status: offlineMode ? 'submitted' : 'synced',
          updatedAt: now,
          submittedAt: now,
          firstSubmittedAt: existing.firstSubmittedAt || now,
          submissionCount: newSubCount,
          syncedAt: offlineMode ? undefined : now,
          originDeviceId: existing.originDeviceId || 'local',
        };
      } else {
        isNew = true;
        record = {
          id: data.id,
          deviceId: data.deviceId || '',
          templateId: data.templateId || '',
          templateVersion: template.version,
          inspectorId: currentUserId,
          inspectorName: currentUserName,
          date: data.date || getTodayString(),
          values: data.values || {},
          photos: data.photos || [],
          anomalyLevel,
          status: offlineMode ? 'submitted' : 'synced',
          createdAt: now,
          updatedAt: now,
          submittedAt: now,
          firstSubmittedAt: now,
          submissionCount: 1,
          withdrawCount: 0,
          syncedAt: offlineMode ? undefined : now,
          originDeviceId: 'local',
        };
      }
    } else {
      isNew = true;
      record = {
        id: generateId('rec'),
        deviceId: data.deviceId || '',
        templateId: data.templateId || '',
        templateVersion: template.version,
        inspectorId: currentUserId,
        inspectorName: currentUserName,
        date: data.date || getTodayString(),
        values: data.values || {},
        photos: data.photos || [],
        anomalyLevel,
        status: offlineMode ? 'submitted' : 'synced',
        createdAt: now,
        updatedAt: now,
        submittedAt: now,
        firstSubmittedAt: now,
        submissionCount: 1,
        withdrawCount: 0,
        syncedAt: offlineMode ? undefined : now,
        originDeviceId: 'local',
      };
    }

    await putInspection(record);

    if (isNew) {
      const meta: RecordMeta = {
        recordId: record.id,
        submissionCount: 1,
        withdrawCount: 0,
        firstSubmittedAt: now,
        lastSubmittedAt: now,
        hasConflict: false,
        exportCount: 0,
      };
      await dbPutMeta(meta);
      set((state) => ({ recordMetaList: [...state.recordMetaList, meta] }));

      const evt: StatusChangeEvent = {
        id: generateId('evt'),
        recordId: record.id,
        fromStatus: null,
        toStatus: record.status,
        action: 'submit',
        actorId: currentUserId,
        actorName: currentUserName,
        timestamp: now,
        note: '首次提交',
        deviceId: record.deviceId,
        date: record.date,
      };
      await dbAddStatusEvent(evt);
      set((state) => ({ statusHistory: [...state.statusHistory, evt] }));
    } else {
      const meta = recordMetaList.find((m) => m.recordId === record.id);
      const isWithdrawnBefore = prevStatus === 'draft' && (meta?.withdrawCount || 0) > 0;
      const isDuplicate = prevStatus === 'submitted';

      const newMeta: RecordMeta = {
        ...(meta || { recordId: record.id, submissionCount: 0, withdrawCount: 0, hasConflict: false, exportCount: 0 }),
        submissionCount: record.submissionCount || 1,
        lastSubmittedAt: now,
        firstSubmittedAt: meta?.firstSubmittedAt || now,
      };
      await dbPutMeta(newMeta);
      set((state) => ({
        recordMetaList: state.recordMetaList.some((m) => m.recordId === record.id)
          ? state.recordMetaList.map((m) => (m.recordId === record.id ? newMeta : m))
          : [...state.recordMetaList, newMeta],
      }));

      const action: StatusChangeAction = isDuplicate ? 'submit' : isWithdrawnBefore ? 'resubmit' : 'submit';
      const note = isDuplicate
        ? '重复提交：覆盖同步队列中的版本'
        : isWithdrawnBefore
          ? `撤回后第${newMeta.withdrawCount}次重新提交`
          : prevStatus === 'draft'
            ? '草稿提交至同步队列'
            : '提交';

      if (prevStatus !== record.status || isWithdrawnBefore || isDuplicate) {
        const evt: StatusChangeEvent = {
          id: generateId('evt'),
          recordId: record.id,
          fromStatus: prevStatus,
          toStatus: record.status,
          action,
          actorId: currentUserId,
          actorName: currentUserName,
          timestamp: now,
          note,
          deviceId: record.deviceId,
          date: record.date,
        };
        await dbAddStatusEvent(evt);
        set((state) => ({ statusHistory: [...state.statusHistory, evt] }));
      }
    }

    const device = get().devices.find((d) => d.id === record.deviceId);
    const snapshot: SubmissionSnapshot = {
      id: generateId('snap'),
      recordId: record.id,
      snapshotAt: now,
      submittedAt: record.submittedAt || now,
      recordValues: JSON.parse(JSON.stringify(record.values)),
      recordPhotos: JSON.parse(JSON.stringify(record.photos)),
      anomalyLevel: record.anomalyLevel,
      templateName: template.name,
      templateVersion: template.version,
      deviceCode: device?.code || '',
      deviceName: device?.name || '',
      inspectorId: record.inspectorId,
      inspectorName: record.inspectorName,
      date: record.date,
      submissionCount: record.submissionCount || 1,
      withdrawCount: record.withdrawCount || 0,
    };
    await dbAddSnapshot(snapshot);
    set((state) => ({ submissionSnapshots: [...state.submissionSnapshots, snapshot] }));

    if (offlineMode) {
      const queueItem: SyncQueueItem = {
        id: generateId('sq'),
        type: 'create',
        recordId: record.id,
        status: 'pending',
        createdAt: now,
        retryCount: 0,
      };
      await addSyncQueueItem(queueItem);
      set((state) => ({ syncQueue: [...state.syncQueue, queueItem] }));
    } else {
      try {
        await apiClient.inspections.create(record);
      } catch (e) {
        console.error('Failed to submit inspection:', e);
      }
    }

    set((state) => {
      const exists = state.inspections.some((r) => r.id === record.id);
      return {
        inspections: exists
          ? state.inspections.map((r) => (r.id === record.id ? record : r))
          : [...state.inspections, record],
      };
    });

    await get().addLogEntry({
      userId: currentUserId,
      userName: currentUserName,
      action: '提交巡检记录',
      target: record.deviceId,
      detail: `${record.date} 巡检记录已${offlineMode ? '本地保存待同步（第' + (record.submissionCount || 1) + '次提交）' : '同步'}`,
      result: 'success',
    });

    return record;
  },

  withdrawInspection: async (recordId: string) => {
    const { inspections, currentUserId, currentUserName, recordMetaList, syncQueue } = get();
    const existing = inspections.find((r) => r.id === recordId);
    if (!existing) throw new Error('记录不存在');
    if (existing.status !== 'submitted') throw new Error('仅待同步状态可以撤回');

    const now = new Date().toISOString();
    const newWithdrawCount = (existing.withdrawCount || 0) + 1;

    const updated: InspectionRecord = {
      ...existing,
      status: 'draft',
      updatedAt: now,
      withdrawCount: newWithdrawCount,
      lastWithdrawnAt: now,
    };

    await putInspection(updated);

    const queueItem = syncQueue.find((q) => q.recordId === recordId);
    if (queueItem) {
      await deleteSyncQueueItem(queueItem.id);
      set((state) => ({
        syncQueue: state.syncQueue.filter((q) => q.id !== queueItem.id),
      }));
    }

    const meta = recordMetaList.find((m) => m.recordId === recordId);
    const newMeta: RecordMeta = {
      ...(meta || { recordId, submissionCount: 0, withdrawCount: 0, hasConflict: false, exportCount: 0 }),
      withdrawCount: newWithdrawCount,
      lastWithdrawnAt: now,
    };
    await dbPutMeta(newMeta);
    set((state) => ({
      recordMetaList: state.recordMetaList.some((m) => m.recordId === recordId)
        ? state.recordMetaList.map((m) => (m.recordId === recordId ? newMeta : m))
        : [...state.recordMetaList, newMeta],
    }));

    const evt: StatusChangeEvent = {
      id: generateId('evt'),
      recordId,
      fromStatus: 'submitted',
      toStatus: 'draft',
      action: 'withdraw',
      actorId: currentUserId,
      actorName: currentUserName,
      timestamp: now,
      note: `第${newWithdrawCount}次撤回，回到草稿区`,
      deviceId: existing.deviceId,
      date: existing.date,
    };
    await dbAddStatusEvent(evt);
    set((state) => ({ statusHistory: [...state.statusHistory, evt] }));

    set((state) => ({
      inspections: state.inspections.map((r) => (r.id === recordId ? updated : r)),
    }));

    await get().addLogEntry({
      userId: currentUserId,
      userName: currentUserName,
      action: '撤回至草稿',
      target: recordId,
      detail: `从同步队列撤回，回到草稿区（第${newWithdrawCount}次撤回）`,
      result: 'success',
    });

    return updated;
  },

  syncAll: async () => {
    const { inspections, currentUserId, currentUserName } = get();
    let successCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    const pendingRecords = inspections.filter(
      (r) => r.status === 'submitted'
    );

    if (pendingRecords.length === 0) {
      return { success: 0, conflicts: 0, errors: 0 };
    }

    try {
      const result = await apiClient.sync.batch(
        pendingRecords,
        currentUserId,
        currentUserName
      );

      const newInspections = [...inspections];
      const newConflicts: ConflictRecord[] = [...get().conflicts];
      const now = new Date().toISOString();

      for (const item of result.results) {
        const idx = newInspections.findIndex((r) => r.id === item.recordId);
        if (idx < 0) continue;

        if (item.status === 'success') {
          newInspections[idx] = {
            ...newInspections[idx],
            status: 'synced',
            syncedAt: now,
          };
          await putInspection(newInspections[idx]);

          const evt: StatusChangeEvent = {
            id: generateId('evt'),
            recordId: item.recordId,
            fromStatus: 'submitted',
            toStatus: 'synced',
            action: 'sync_success',
            actorId: currentUserId,
            actorName: currentUserName,
            timestamp: now,
            note: '同步成功',
            deviceId: newInspections[idx].deviceId,
            date: newInspections[idx].date,
          };
          await dbAddStatusEvent(evt);
          set((state) => ({ statusHistory: [...state.statusHistory, evt] }));

          const queueIdx = get().syncQueue.findIndex((q) => q.recordId === item.recordId);
          if (queueIdx >= 0) {
            await dbDeleteSyncItem(get().syncQueue[queueIdx].id);
          }

          successCount++;
        } else if (item.status === 'conflict' && item.conflictId) {
          newInspections[idx] = {
            ...newInspections[idx],
            status: 'conflict',
            conflictId: item.conflictId,
          };
          await putInspection(newInspections[idx]);

          const evt: StatusChangeEvent = {
            id: generateId('evt'),
            recordId: item.recordId,
            fromStatus: 'submitted',
            toStatus: 'conflict',
            action: 'conflict_detected',
            actorId: currentUserId,
            actorName: currentUserName,
            timestamp: now,
            note: `同步检测到冲突：${item.conflictId}`,
            deviceId: newInspections[idx].deviceId,
            date: newInspections[idx].date,
          };
          await dbAddStatusEvent(evt);
          set((state) => ({ statusHistory: [...state.statusHistory, evt] }));

          const meta = get().recordMetaList.find((m) => m.recordId === item.recordId);
          if (meta) {
            const updatedMeta: RecordMeta = { ...meta, hasConflict: true };
            await dbPutMeta(updatedMeta);
          }

          conflictCount++;
        } else {
          const evt: StatusChangeEvent = {
            id: generateId('evt'),
            recordId: item.recordId,
            fromStatus: 'submitted',
            toStatus: 'submitted',
            action: 'sync_fail',
            actorId: currentUserId,
            actorName: currentUserName,
            timestamp: now,
            note: '同步失败，保留待同步状态',
            deviceId: newInspections[idx].deviceId,
            date: newInspections[idx].date,
          };
          await dbAddStatusEvent(evt);
          set((state) => ({ statusHistory: [...state.statusHistory, evt] }));
          errorCount++;
        }
      }

      for (const conflict of result.conflicts) {
        await putConflict(conflict);
        if (!newConflicts.some((c) => c.id === conflict.id)) {
          newConflicts.push(conflict);
        }
      }

      set({
        inspections: newInspections,
        conflicts: newConflicts.filter((c) => !c.resolved),
        syncQueue: get().syncQueue.filter((q) => !pendingRecords.some((r) => r.id === q.recordId)),
        recordMetaList: get().recordMetaList.map((m) => {
          const r = newInspections.find((i) => i.id === m.recordId);
          if (!r) return m;
          return { ...m, hasConflict: r.status === 'conflict' || m.hasConflict };
        }),
      });

      await get().addLogEntry({
        userId: currentUserId,
        userName: currentUserName,
        action: '批量同步',
        target: 'sync',
        detail: `同步 ${pendingRecords.length} 条记录：成功 ${successCount}，冲突 ${conflictCount}，失败 ${errorCount}`,
        result: conflictCount > 0 ? 'conflict' : 'success',
      });
    } catch (e) {
      errorCount = pendingRecords.length;
      set({ error: (e as Error).message });
    }

    return { success: successCount, conflicts: conflictCount, errors: errorCount };
  },

  resolveConflict: async (
    conflictId: string,
    resolution: ConflictResolution
  ) => {
    const { conflicts, inspections, currentUserId, currentUserName, recordMetaList } = get();
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) throw new Error('冲突不存在');

    const result = await apiClient.sync.resolve(
      conflictId,
      resolution,
      currentUserId,
      currentUserName
    );

    result.conflict.resolvedBy = currentUserId;
    result.conflict.resolvedByName = currentUserName;

    await putInspection(result.record);
    await putConflict(result.conflict);

    const now = new Date().toISOString();
    const evt: StatusChangeEvent = {
      id: generateId('evt'),
      recordId: result.record.id,
      fromStatus: 'conflict',
      toStatus: 'synced',
      action: 'conflict_resolved',
      actorId: currentUserId,
      actorName: currentUserName,
      timestamp: now,
      note: `冲突已解决，采用：${resolution === 'keep-local' ? '本地版本' : resolution === 'keep-remote' ? '远端版本' : '合并版本'}`,
      deviceId: result.record.deviceId,
      date: result.record.date,
    };
    await dbAddStatusEvent(evt);

    const meta = recordMetaList.find((m) => m.recordId === result.record.id);
    if (meta) {
      const updatedMeta: RecordMeta = {
        ...meta,
        hasConflict: false,
        lastConflictResolution: resolution,
        lastConflictResolvedAt: now,
      };
      await dbPutMeta(updatedMeta);
    }

    const device = get().devices.find((d) => d.id === result.record.deviceId);
    const tpl = get().templates.find((t) => t.id === result.record.templateId);
    const snapshot: SubmissionSnapshot = {
      id: generateId('snap'),
      recordId: result.record.id,
      snapshotAt: now,
      submittedAt: result.record.submittedAt || result.record.createdAt,
      recordValues: JSON.parse(JSON.stringify(result.record.values)),
      recordPhotos: JSON.parse(JSON.stringify(result.record.photos)),
      anomalyLevel: result.record.anomalyLevel,
      templateName: tpl?.name || '',
      templateVersion: result.record.templateVersion,
      deviceCode: device?.code || '',
      deviceName: device?.name || '',
      inspectorId: result.record.inspectorId,
      inspectorName: result.record.inspectorName,
      date: result.record.date,
      submissionCount: result.record.submissionCount || 1,
      withdrawCount: result.record.withdrawCount || 0,
      conflictResolution: resolution,
      conflictResolvedAt: now,
    };
    await dbAddSnapshot(snapshot);

    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId ? result.conflict : c
      ).filter((c) => !c.resolved),
      inspections: state.inspections.map((r) =>
        r.id === conflict.localVersion.id || r.id === conflict.remoteVersion.id
          ? result.record
          : r
      ),
      statusHistory: [...state.statusHistory, evt],
      submissionSnapshots: [...state.submissionSnapshots, snapshot],
      recordMetaList: state.recordMetaList.map((m) =>
        m.recordId === result.record.id
          ? {
              ...m,
              hasConflict: false,
              lastConflictResolution: resolution,
              lastConflictResolvedAt: now,
            }
          : m
      ),
    }));
  },

  addLogEntry: async (log: Omit<OperationLog, 'id' | 'timestamp'>) => {
    const newLog: OperationLog = {
      id: generateId('log'),
      timestamp: new Date().toISOString(),
      ...log,
    };
    await dbAddLog(newLog);
    set((state) => ({ logs: [newLog, ...state.logs].slice(0, 500) }));
  },

  markRecordExported: async (recordId: string) => {
    const meta = get().recordMetaList.find((m) => m.recordId === recordId);
    if (!meta) return;
    const updated: RecordMeta = { ...meta, exportCount: meta.exportCount + 1 };
    await dbPutMeta(updated);
    set((state) => ({
      recordMetaList: state.recordMetaList.map((m) =>
        m.recordId === recordId ? updated : m
      ),
    }));
  },

  resetError: () => set({ error: null }),
}));
