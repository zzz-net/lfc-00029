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

  isLoading: boolean;
  error: string | null;

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

  syncAll: () => Promise<{ success: number; conflicts: number; errors: number }>;
  resolveConflict: (
    conflictId: string,
    resolution: 'keep-local' | 'keep-remote' | 'merge'
  ) => Promise<void>;

  addLogEntry: (log: Omit<OperationLog, 'id' | 'timestamp'>) => Promise<void>;

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

  isLoading: false,
  error: null,

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
        savedRole,
        savedOffline,
      ] = await Promise.all([
        getAllTemplates(),
        getAllDevices(),
        getAllInspections(),
        getAllConflicts(),
        getAllLogs(),
        getAllSyncQueue(),
        getAppState('role'),
        getAppState('offlineMode'),
      ]);

      set({
        templates,
        devices,
        inspections,
        conflicts,
        logs,
        syncQueue,
        role: savedRole || 'inspector',
        offlineMode: savedOffline || false,
        networkStatus: savedOffline ? 'offline' : 'online',
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

    if (data.id) {
      const existing = inspections.find((r) => r.id === data.id);
      if (existing) {
        const updated: InspectionRecord = {
          ...existing,
          ...data,
          anomalyLevel,
          status: 'draft',
          updatedAt: now,
        };
        await putInspection(updated);
        set((state) => ({
          inspections: state.inspections.map((r) =>
            r.id === data.id ? updated : r
          ),
        }));
        return updated;
      }
    }

    const newRecord: InspectionRecord = {
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
    };

    await putInspection(newRecord);

    const existingSameDay = inspections.filter(
      (r) => r.deviceId === newRecord.deviceId && r.date === newRecord.date && r.id !== newRecord.id
    );
    if (existingSameDay.length > 0) {
      await get().addLogEntry({
        userId: currentUserId,
        userName: currentUserName,
        action: '保存草稿（同日多版本）',
        target: newRecord.deviceId,
        detail: `${newRecord.date} 该设备已有 ${existingSameDay.length + 1} 个草稿版本`,
        result: 'success',
      });
    }

    set((state) => ({ inspections: [...state.inspections, newRecord] }));
    return newRecord;
  },

  submitInspection: async (data: Partial<InspectionRecord>) => {
    const { offlineMode, inspections, templates, currentUserId, currentUserName } = get();

    const template = templates.find((t) => t.id === data.templateId);
    if (!template) throw new Error('模板不存在');

    const anomalyLevel = data.values
      ? calculateAnomalyLevel(data.values, template.fields)
      : 'none';

    const now = new Date().toISOString();
    let record: InspectionRecord;

    if (data.id) {
      const existing = inspections.find((r) => r.id === data.id);
      if (existing) {
        record = {
          ...existing,
          ...data,
          anomalyLevel,
          status: offlineMode ? 'submitted' : 'synced',
          updatedAt: now,
          syncedAt: offlineMode ? undefined : now,
        };
      } else {
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
          syncedAt: offlineMode ? undefined : now,
        };
      }
    } else {
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
        syncedAt: offlineMode ? undefined : now,
      };
    }

    await putInspection(record);

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
      detail: `${record.date} 巡检记录已${offlineMode ? '本地保存待同步' : '同步'}`,
      result: 'success',
    });

    return record;
  },

  syncAll: async () => {
    const { inspections, currentUserId, currentUserName } = get();
    let successCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    const pendingRecords = inspections.filter(
      (r) => r.status === 'submitted' || r.status === 'draft'
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

      for (const item of result.results) {
        const idx = newInspections.findIndex((r) => r.id === item.recordId);
        if (idx < 0) continue;

        if (item.status === 'success') {
          newInspections[idx] = {
            ...newInspections[idx],
            status: 'synced',
            syncedAt: new Date().toISOString(),
          };
          await putInspection(newInspections[idx]);
          successCount++;
        } else if (item.status === 'conflict' && item.conflictId) {
          newInspections[idx] = {
            ...newInspections[idx],
            status: 'conflict',
            conflictId: item.conflictId,
          };
          await putInspection(newInspections[idx]);
          conflictCount++;
        } else {
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
        syncQueue: [],
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
    resolution: 'keep-local' | 'keep-remote' | 'merge'
  ) => {
    const { conflicts, inspections, currentUserId, currentUserName } = get();
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) throw new Error('冲突不存在');

    const result = await apiClient.sync.resolve(
      conflictId,
      resolution,
      currentUserId,
      currentUserName
    );

    await putInspection(result.record);
    await putConflict(result.conflict);

    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId ? result.conflict : c
      ),
      inspections: state.inspections.map((r) =>
        r.id === conflict.localVersion.id || r.id === conflict.remoteVersion.id
          ? result.record
          : r
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

  resetError: () => set({ error: null }),
}));
