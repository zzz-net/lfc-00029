import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './useStore';
import * as indexedDb from '@/db/indexedDb';
import * as apiClient from '@/api/client';
import type {
  InspectionRecord,
  StatusChangeEvent,
  SubmissionSnapshot,
  RecordMeta,
  SyncQueueItem,
  RecordStatus,
  StatusChangeAction,
  AnomalyLevel,
} from '@/types';

vi.mock('@/db/indexedDb');

vi.mock('@/api/client', () => ({
  apiClient: {
    templates: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    devices: {
      list: vi.fn(),
      seed: vi.fn(),
    },
    inspections: {
      list: vi.fn(),
      create: vi.fn(),
    },
    logs: {
      list: vi.fn(),
    },
    sync: {
      batch: vi.fn(),
      resolve: vi.fn(),
    },
  },
}));

const mockApiClient = (apiClient as any).apiClient;

const mockDevice = {
  id: 'dev_123',
  code: 'PUMP-001',
  name: '1号循环泵',
  location: 'A区泵房',
  category: '泵类',
  status: 'normal' as const,
};

const mockTemplate = {
  id: 'tpl_123',
  name: '通用巡检模板',
  version: 2,
  enabled: true,
  fields: [
    { id: 'f1', key: 'appearance', label: '外观检查', type: 'select' as const, required: true, anomalyLevel: 'medium' as const, options: ['正常', '异常'] },
    { id: 'f2', key: 'temperature', label: '运行温度', type: 'number' as const, required: true, anomalyLevel: 'high' as const },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockDraft: InspectionRecord = {
  id: 'rec_123',
  deviceId: 'dev_123',
  templateId: 'tpl_123',
  templateVersion: 1,
  inspectorId: 'inspector_001',
  inspectorName: '张巡检',
  date: '2024-06-20',
  values: { appearance: '正常' },
  photos: [],
  anomalyLevel: 'none' as AnomalyLevel,
  status: 'draft' as RecordStatus,
  createdAt: '2024-06-20T08:00:00.000Z',
  updatedAt: '2024-06-20T08:00:00.000Z',
  submissionCount: 0,
  withdrawCount: 0,
  originDeviceId: 'dev_local_001',
};

const makeSyncQueueItem = (recordId: string): SyncQueueItem => ({
  id: recordId,
  type: 'create',
  recordId,
  status: 'pending',
  createdAt: '2024-06-20T09:00:00.000Z',
  retryCount: 0,
});

describe('useStore - 初始化与草稿恢复', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
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
      sessionRecovered: false,
      lastVisitAt: null,
    } as any);
  });

  describe('loadInitialData', () => {
    it('应该从 IndexedDB 加载所有数据', async () => {
      vi.mocked(indexedDb.getAllTemplates).mockResolvedValue([mockTemplate as any]);
      vi.mocked(indexedDb.getAllDevices).mockResolvedValue([mockDevice as any]);
      vi.mocked(indexedDb.getAllInspections).mockResolvedValue([mockDraft]);
      vi.mocked(indexedDb.getAllConflicts).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllLogs).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSyncQueue).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllStatusHistory).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSubmissionSnapshots).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllRecordMeta).mockResolvedValue([]);
      vi.mocked(indexedDb.getAppState).mockResolvedValue(undefined);
      vi.mocked(indexedDb.setAppState).mockResolvedValue();
      mockApiClient.templates.list.mockRejectedValue(new Error('Server down'));
      mockApiClient.devices.list.mockRejectedValue(new Error('Server down'));
      mockApiClient.inspections.list.mockRejectedValue(new Error('Server down'));
      mockApiClient.logs.list.mockRejectedValue(new Error('Server down'));

      await useStore.getState().loadInitialData();

      expect(indexedDb.getAllTemplates).toHaveBeenCalled();
      expect(indexedDb.getAllDevices).toHaveBeenCalled();
      expect(indexedDb.getAllInspections).toHaveBeenCalled();

      const state = useStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.devices).toHaveLength(1);
      expect(state.inspections).toHaveLength(1);
      expect(state.inspections[0].id).toBe('rec_123');
      expect(state.isLoading).toBe(false);
    });

    it('离线模式下不应从服务器刷新', async () => {
      vi.mocked(indexedDb.getAllTemplates).mockResolvedValue([mockTemplate as any]);
      vi.mocked(indexedDb.getAllDevices).mockResolvedValue([mockDevice as any]);
      vi.mocked(indexedDb.getAllInspections).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllConflicts).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllLogs).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSyncQueue).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllStatusHistory).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSubmissionSnapshots).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllRecordMeta).mockResolvedValue([]);
      vi.mocked(indexedDb.getAppState).mockResolvedValue(true);
      vi.mocked(indexedDb.setAppState).mockResolvedValue();

      useStore.setState({ offlineMode: true } as any);
      await useStore.getState().loadInitialData();

      expect(mockApiClient.templates.list).not.toHaveBeenCalled();
      expect(useStore.getState().offlineMode).toBe(true);
    });
  });

  describe('seedDevices', () => {
    it('当设备列表为空时应初始化样例设备', async () => {
      vi.mocked(indexedDb.putDevices).mockResolvedValue();
      mockApiClient.devices.seed.mockResolvedValue({ seeded: true, devices: [mockDevice] });

      useStore.setState({ devices: [], offlineMode: false } as any);
      await useStore.getState().seedDevices();

      expect(mockApiClient.devices.seed).toHaveBeenCalled();
      expect(useStore.getState().devices).toHaveLength(1);
    });

    it('当已有设备时不应重复初始化', async () => {
      useStore.setState({ devices: [mockDevice] } as any);
      await useStore.getState().seedDevices();

      expect(mockApiClient.devices.seed).not.toHaveBeenCalled();
    });
  });
});

describe('useStore - 草稿保存与版本校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate as any],
      devices: [mockDevice],
      inspections: [],
      offlineMode: true,
      statusHistory: [],
      submissionSnapshots: [],
      recordMetaList: [],
    } as any);
  });

  describe('saveInspectionDraft', () => {
    it('应该保存新草稿并记录正确的模板版本', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      const result = await useStore.getState().saveInspectionDraft({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常' },
        photos: [],
      });

      expect(result.templateVersion).toBe(2);
      expect(result.status).toBe('draft');
      expect(result.deviceId).toBe('dev_123');
      expect(useStore.getState().inspections).toHaveLength(1);
    });

    it('应该更新已有草稿的内容', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
      useStore.setState({ inspections: [mockDraft] } as any);

      const result = await useStore.getState().saveInspectionDraft({
        id: 'rec_123',
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '异常', temperature: 45 },
        photos: [],
      });

      expect(result.id).toBe('rec_123');
      expect(result.values.appearance).toBe('异常');
      expect(result.values.temperature).toBe(45);
      expect(result.templateVersion).toBe(2);
    });
  });

  describe('submitInspection', () => {
    it('离线模式下提交时应将状态设为 submitted 并加入同步队列', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      useStore.setState({ offlineMode: true } as any);
      const result = await useStore.getState().submitInspection({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常', temperature: 45 },
        photos: [],
      });

      expect(result.status).toBe('submitted');
      expect(indexedDb.addSyncQueueItem).toHaveBeenCalled();
      expect(indexedDb.addSubmissionSnapshot).toHaveBeenCalled();
      expect(indexedDb.addStatusChangeEvent).toHaveBeenCalled();
      expect(indexedDb.putRecordMeta).toHaveBeenCalled();
      expect(result.syncedAt).toBeUndefined();
    });

    it('在线模式下提交时应将状态设为 synced 并同步到服务器', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
      mockApiClient.inspections.create.mockResolvedValue({} as any);

      useStore.setState({ offlineMode: false } as any);
      const result = await useStore.getState().submitInspection({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常', temperature: 45 },
        photos: [],
      });

      expect(result.status).toBe('synced');
      expect(mockApiClient.inspections.create).toHaveBeenCalled();
      expect(indexedDb.addSubmissionSnapshot).toHaveBeenCalled();
      expect(result.syncedAt).toBeDefined();
    });
  });
});

describe('useStore - 撤回与状态流转', () => {
  const mockSubmitted: InspectionRecord = {
    ...mockDraft,
    status: 'submitted' as RecordStatus,
    submittedAt: '2024-06-20T09:00:00.000Z',
    firstSubmittedAt: '2024-06-20T09:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate as any],
      devices: [mockDevice],
      inspections: [mockSubmitted],
      syncQueue: [makeSyncQueueItem('rec_123')],
      offlineMode: true,
      statusHistory: [],
      submissionSnapshots: [],
      recordMetaList: [],
    } as any);
  });

  describe('withdrawInspection', () => {
    it('应该将 submitted 状态撤回到 draft，并从同步队列移除', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.deleteSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      const result = await useStore.getState().withdrawInspection('rec_123');

      expect(result).toBeDefined();
      expect(result!.status).toBe('withdrawn');
      expect(result!.lastWithdrawnAt).toBeDefined();
      expect(indexedDb.deleteSyncQueueItem).toHaveBeenCalledWith('rec_123');
      expect(indexedDb.addStatusChangeEvent).toHaveBeenCalled();
      expect(indexedDb.putRecordMeta).toHaveBeenCalled();

      const state = useStore.getState();
      const inQueue = state.syncQueue.some((q) => q.recordId === 'rec_123');
      expect(inQueue).toBe(false);
    });

    it('非 submitted 状态不应该执行撤回', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      useStore.setState({ inspections: [mockDraft] } as any);

      const result = await useStore.getState().withdrawInspection('rec_123');

      expect(result).toBeNull();
      expect(indexedDb.putInspection).not.toHaveBeenCalled();
    });

    it('不存在的记录应该返回 null', async () => {
      const result = await useStore.getState().withdrawInspection('rec_nonexistent');
      expect(result).toBeNull();
    });

    it('撤回后提交次数和撤回次数应该记录在 meta 中', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.deleteSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      await useStore.getState().withdrawInspection('rec_123');

      expect(indexedDb.putRecordMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 'rec_123',
          withdrawCount: 1,
        })
      );
    });
  });

  describe('提交次数与重新提交', () => {
    it('首次提交 submissionCount 应该为 1', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      useStore.setState({ inspections: [] } as any);
      await useStore.getState().submitInspection({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常' },
        photos: [],
      });

      expect(indexedDb.putRecordMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionCount: 1,
        })
      );
    });

    it('撤回后再提交 submissionCount 应该累加', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.deleteSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      useStore.setState({
        recordMetaList: [{ recordId: 'rec_123', submissionCount: 1, withdrawCount: 1, exportCount: 0, hasConflict: false } as RecordMeta],
      } as any);

      await useStore.getState().submitInspection({
        id: 'rec_123',
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常' },
        photos: [],
      });

      expect(indexedDb.putRecordMeta).toHaveBeenLastCalledWith(
        expect.objectContaining({
          submissionCount: 2,
          withdrawCount: 1,
        })
      );
    });
  });
});

describe('useStore - 状态变更历史与提交快照', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate as any],
      devices: [mockDevice],
      inspections: [],
      statusHistory: [],
      submissionSnapshots: [],
      recordMetaList: [],
      offlineMode: true,
    } as any);
  });

  describe('saveInspectionDraft 状态事件', () => {
    it('新建草稿应该生成 create_draft 事件', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      await useStore.getState().saveInspectionDraft({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常' },
        photos: [],
      });

      expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          toStatus: 'draft',
          action: 'create_draft',
        })
      );
    });

    it('编辑已有草稿应该生成 save_draft 事件', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
      useStore.setState({ inspections: [mockDraft] } as any);

      await useStore.getState().saveInspectionDraft({
        id: 'rec_123',
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '异常' },
        photos: [],
      });

      expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'save_draft',
          recordId: 'rec_123',
        })
      );
    });
  });

  describe('submitInspection 快照与事件', () => {
    it('提交应该创建 SubmissionSnapshot', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      await useStore.getState().submitInspection({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常', temperature: 45 },
        photos: [],
      });

      expect(indexedDb.addSubmissionSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          templateVersion: 2,
        })
      );
    });

    it('首次提交事件 action 应为 submit', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
      vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

      await useStore.getState().submitInspection({
        deviceId: 'dev_123',
        templateId: 'tpl_123',
        templateVersion: 2,
        date: '2024-06-20',
        values: { appearance: '正常' },
        photos: [],
      });

      expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: 'draft',
          toStatus: 'submitted',
          action: 'submit',
        })
      );
    });
  });

  describe('getStatusHistory / getLatestSnapshot', () => {
    it('getStatusHistory 应该按记录ID过滤并排序', () => {
      useStore.setState({
        statusHistory: [
          { id: 'h1', recordId: 'rec_123', fromStatus: 'draft', toStatus: 'submitted', action: 'submit' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T09:00:00.000Z', deviceId: 'dev_123' },
          { id: 'h2', recordId: 'rec_456', fromStatus: 'draft', toStatus: 'submitted', action: 'submit' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T10:00:00.000Z', deviceId: 'dev_123' },
          { id: 'h3', recordId: 'rec_123', fromStatus: 'submitted', toStatus: 'draft', action: 'withdraw' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T09:30:00.000Z', deviceId: 'dev_123' },
        ] as StatusChangeEvent[],
      } as any);

      const history = useStore.getState().getStatusHistory('rec_123');
      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBe('2024-06-20T09:30:00.000Z');
      expect(history[1].timestamp).toBe('2024-06-20T09:00:00.000Z');
    });
  });
});

describe('useStore - 会话恢复与导出标记', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [],
      devices: [],
      inspections: [],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      recordMetaList: [],
      sessionRecovered: false,
      lastVisitAt: null,
    } as any);
  });

  describe('loadInitialData - 会话恢复', () => {
    it('应该加载新的数据表并设置 sessionRecovered', async () => {
      const mockHistory = [{ id: 'h1', recordId: 'rec_1', fromStatus: 'draft', toStatus: 'submitted', action: 'submit' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T09:00:00.000Z' }] as StatusChangeEvent[];
      const mockMeta = [{ recordId: 'rec_1', submissionCount: 1, withdrawCount: 0, hasConflict: false, exportCount: 0 }] as RecordMeta[];

      vi.mocked(indexedDb.getAllTemplates).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllDevices).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllInspections).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllConflicts).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllLogs).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSyncQueue).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllStatusHistory).mockResolvedValue(mockHistory);
      vi.mocked(indexedDb.getAllSubmissionSnapshots).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllRecordMeta).mockResolvedValue(mockMeta);
      vi.mocked(indexedDb.getAppState).mockResolvedValue(true);
      vi.mocked(indexedDb.setAppState).mockResolvedValue();

      await useStore.getState().loadInitialData();

      const state = useStore.getState();
      expect(state.statusHistory).toEqual(mockHistory);
      expect(state.recordMetaList).toEqual(mockMeta);
      expect(state.sessionRecovered).toBe(true);
      expect(state.lastVisitAt).toBeDefined();
      expect(indexedDb.setAppState).toHaveBeenCalledWith('lastVisitAt', expect.any(String));
    });
  });

  describe('markRecordExported', () => {
    it('应该增加 exportCount', async () => {
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
      useStore.setState({
        recordMetaList: [{ recordId: 'rec_123', submissionCount: 1, withdrawCount: 0, hasConflict: false, exportCount: 2 } as RecordMeta],
      } as any);

      await useStore.getState().markRecordExported('rec_123');

      expect(indexedDb.putRecordMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 'rec_123',
          exportCount: 3,
        })
      );

      const meta = useStore.getState().getRecordMeta('rec_123');
      expect(meta?.exportCount).toBe(3);
    });

    it('无 meta 时应该创建新的 meta 记录', async () => {
      vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
      useStore.setState({ recordMetaList: [] } as any);

      await useStore.getState().markRecordExported('rec_new');

      expect(indexedDb.putRecordMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 'rec_new',
          exportCount: 1,
          submissionCount: 0,
          withdrawCount: 0,
          hasConflict: false,
        })
      );
    });
  });

  describe('syncAll - 只同步 submitted 状态', () => {
    it('应该只同步 submitted 状态的记录，忽略 draft', async () => {
      const draftRecord = { ...mockDraft, id: 'rec_draft', status: 'draft' as RecordStatus };
      const submittedRecord = { ...mockDraft, id: 'rec_sub', status: 'submitted' as RecordStatus };

      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addStatusChangeEvents).mockResolvedValue();
      mockApiClient.sync.batch.mockResolvedValue({});

      useStore.setState({
        inspections: [draftRecord, submittedRecord],
        syncQueue: [makeSyncQueueItem('rec_draft'), makeSyncQueueItem('rec_sub')],
        offlineMode: false,
      } as any);

      await useStore.getState().syncAll();

      expect(mockApiClient.sync.batch).toHaveBeenCalled();
      const callArg = mockApiClient.sync.batch.mock.calls[0][0];
      expect(callArg.some((r: any) => r.id === 'rec_draft')).toBe(false);
      expect(callArg.some((r: any) => r.id === 'rec_sub')).toBe(true);
    });
  });
});
