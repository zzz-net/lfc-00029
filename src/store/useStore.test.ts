import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './useStore';
import * as indexedDb from '@/db/indexedDb';
import * as apiClient from '@/api/client';

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

const mockDraft = {
  id: 'rec_123',
  deviceId: 'dev_123',
  templateId: 'tpl_123',
  templateVersion: 1,
  inspectorId: 'inspector_001',
  inspectorName: '张巡检',
  date: '2024-06-20',
  values: { appearance: '正常' },
  photos: [],
  anomalyLevel: 'none' as const,
  status: 'draft' as const,
  createdAt: '2024-06-20T08:00:00.000Z',
  updatedAt: '2024-06-20T08:00:00.000Z',
};

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
      isLoading: false,
    });
  });

  describe('loadInitialData', () => {
    it('应该从 IndexedDB 加载所有数据', async () => {
      vi.mocked(indexedDb.getAllTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(indexedDb.getAllDevices).mockResolvedValue([mockDevice]);
      vi.mocked(indexedDb.getAllInspections).mockResolvedValue([mockDraft]);
      vi.mocked(indexedDb.getAllConflicts).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllLogs).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSyncQueue).mockResolvedValue([]);
      vi.mocked(indexedDb.getAppState).mockResolvedValue(undefined);
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
      vi.mocked(indexedDb.getAllTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(indexedDb.getAllDevices).mockResolvedValue([mockDevice]);
      vi.mocked(indexedDb.getAllInspections).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllConflicts).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllLogs).mockResolvedValue([]);
      vi.mocked(indexedDb.getAllSyncQueue).mockResolvedValue([]);
      vi.mocked(indexedDb.getAppState).mockResolvedValue(true);

      useStore.setState({ offlineMode: true });
      await useStore.getState().loadInitialData();

      expect(mockApiClient.templates.list).not.toHaveBeenCalled();
      expect(useStore.getState().offlineMode).toBe(true);
    });
  });

  describe('seedDevices', () => {
    it('当设备列表为空时应初始化样例设备', async () => {
      vi.mocked(indexedDb.putDevices).mockResolvedValue();
      mockApiClient.devices.seed.mockResolvedValue({ seeded: true, devices: [mockDevice] });

      useStore.setState({ devices: [], offlineMode: false });
      await useStore.getState().seedDevices();

      expect(mockApiClient.devices.seed).toHaveBeenCalled();
      expect(useStore.getState().devices).toHaveLength(1);
    });

    it('当已有设备时不应重复初始化', async () => {
      useStore.setState({ devices: [mockDevice] });
      await useStore.getState().seedDevices();

      expect(mockApiClient.devices.seed).not.toHaveBeenCalled();
    });
  });
});

describe('useStore - 草稿保存与版本校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [],
      offlineMode: true,
    });
  });

  describe('saveInspectionDraft', () => {
    it('应该保存新草稿并记录正确的模板版本', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();

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
      useStore.setState({ inspections: [mockDraft] });

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

  describe('submitInspection - 旧模板版本拦截', () => {
    it('离线模式下提交时应将状态设为 submitted 并加入同步队列', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();

      useStore.setState({ offlineMode: true });
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
      expect(result.syncedAt).toBeUndefined();
    });

    it('在线模式下提交时应将状态设为 synced 并同步到服务器', async () => {
      vi.mocked(indexedDb.putInspection).mockResolvedValue();
      mockApiClient.inspections.create.mockResolvedValue({} as any);

      useStore.setState({ offlineMode: false });
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
      expect(result.syncedAt).toBeDefined();
    });
  });
});
