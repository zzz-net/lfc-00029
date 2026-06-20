import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './useStore';
import * as indexedDb from '@/db/indexedDb';
import * as apiClient from '@/api/client';
import type {
  InspectionRecord,
  StatusChangeEvent,
  SubmissionReceipt,
  AuditLogEntry,
  SessionState,
  RecordMeta,
  RecordStatus,
  StatusChangeAction,
  AnomalyLevel,
  Template,
  Device,
} from '@/types';

vi.mock('@/db/indexedDb');

vi.mock('@/api/client', () => ({
  apiClient: {
    templates: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    devices: { list: vi.fn(), seed: vi.fn() },
    inspections: { list: vi.fn(), create: vi.fn() },
    logs: { list: vi.fn() },
    sync: { batch: vi.fn(), resolve: vi.fn() },
  },
}));

const mockApiClient = (apiClient as any).apiClient;

const mockDevice: Device = {
  id: 'dev_123',
  code: 'PUMP-001',
  name: '1号循环泵',
  location: 'A区泵房',
  category: '泵类',
  status: 'normal',
};

const mockTemplate: Template = {
  id: 'tpl_123',
  name: '通用巡检模板',
  version: 2,
  enabled: true,
  fields: [
    { id: 'f1', key: 'appearance', label: '外观检查', type: 'select', required: true, anomalyLevel: 'medium', options: ['正常', '异常'] },
    { id: 'f2', key: 'temperature', label: '运行温度', type: 'number', required: true, anomalyLevel: 'high' },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const makeDraft = (overrides: Partial<InspectionRecord> = {}): InspectionRecord => ({
  id: 'rec_123',
  deviceId: 'dev_123',
  templateId: 'tpl_123',
  templateVersion: 2,
  inspectorId: 'inspector_001',
  inspectorName: '张巡检',
  date: '2024-06-20',
  values: { appearance: '正常', temperature: 42 },
  photos: [],
  anomalyLevel: 'none',
  status: 'draft',
  createdAt: '2024-06-20T08:00:00.000Z',
  updatedAt: '2024-06-20T08:00:00.000Z',
  submissionCount: 0,
  withdrawCount: 0,
  originDeviceId: 'dev_local_test',
  ...overrides,
});

describe('useStore - 提交工作台：新建草稿', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
      isLoading: false,
      recoveredSession: null,
    } as any);
  });

  it('保存草稿时应记录 create_draft 事件，status 为 draft', async () => {
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

    expect(result.status).toBe('draft');
    expect(result.submissionCount).toBe(0);
    expect(result.withdrawCount).toBe(0);
    expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create_draft', toStatus: 'draft' })
    );
    expect(useStore.getState().inspections).toHaveLength(1);
  });

  it('validateOperation 对新建草稿的 save_draft 应返回 valid=true', () => {
    const draft = makeDraft();
    const validation = useStore.getState().validateOperation('rec_123', draft, 'save_draft');
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('validateOperation 对 draft 执行 withdraw 动作应失败（状态门禁）', () => {
    const draft = makeDraft();
    const validation = useStore.getState().validateOperation('rec_123', draft, 'withdraw');
    expect(validation.valid).toBe(false);
    const types = validation.errors.map(e => e.type);
    expect(types).toContain('status_gate');
  });
});

describe('useStore - 提交工作台：送审上报', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [makeDraft()],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('submitInspection 应将 draft → submitted，创建 SubmissionReceipt', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
    vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.putSubmissionReceipt).mockResolvedValue();

    const result = await useStore.getState().submitInspection(makeDraft());

    expect(result.status).toBe('submitted');
    expect(result.submissionCount).toBe(1);
    expect(result.submittedAt).toBeDefined();
    expect(result.firstSubmittedAt).toBeDefined();

    expect(indexedDb.putSubmissionReceipt).toHaveBeenCalled();
    const receiptArg = vi.mocked(indexedDb.putSubmissionReceipt).mock.calls[0][0] as SubmissionReceipt;
    expect(receiptArg.recordId).toBe('rec_123');
    expect(receiptArg.receiptNo).toMatch(/^RCP-\d{8}-\d{6}-\w{6}$/);
    expect(receiptArg.status).toBe('pending');
    expect(receiptArg.sourceDeviceId).toBe('dev_local_test');
  });

  it('validateOperation 对 draft 执行 submit 应通过', () => {
    const draft = makeDraft({ values: { appearance: '正常', temperature: 42 } });
    const validation = useStore.getState().validateOperation('rec_123', draft, 'submit');
    expect(validation.valid).toBe(true);
  });

  it('validateOperation 对 draft 提交但模板版本不匹配应返回版本错误', () => {
    const draft = makeDraft({ templateVersion: 1 });
    const validation = useStore.getState().validateOperation('rec_123', draft, 'submit');
    expect(validation.valid).toBe(false);
    const types = validation.errors.map(e => e.type);
    expect(types).toContain('version');
  });

  it('同设备同日重复提交应被拦截', () => {
    const existing = makeDraft({ id: 'rec_existing', status: 'submitted', date: '2024-06-20' });
    useStore.setState({ inspections: [existing, makeDraft()] } as any);
    const draft = makeDraft();
    const validation = useStore.getState().validateOperation('rec_123', draft, 'submit');
    expect(validation.valid).toBe(false);
    const types = validation.errors.map(e => e.type);
    expect(types).toContain('duplicate');
  });

  it('附属信息（SubmissionReceipt）写入失败不应阻塞主流程', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
    vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.putSubmissionReceipt).mockRejectedValue(new Error('DB write failed'));

    const result = await useStore.getState().submitInspection(makeDraft());
    expect(result.status).toBe('submitted');
  });
});

describe('useStore - 提交工作台：撤销回滚与审计日志', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [makeDraft({ status: 'submitted', submissionCount: 1, submittedAt: '2024-06-20T09:00:00.000Z', firstSubmittedAt: '2024-06-20T09:00:00.000Z' })],
      conflicts: [],
      logs: [],
      syncQueue: [{ id: 'rec_123', type: 'create', recordId: 'rec_123', status: 'pending', createdAt: '2024-06-20T09:00:00.000Z', retryCount: 0 }],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [{ recordId: 'rec_123', submissionCount: 1, withdrawCount: 0, exportCount: 0, hasConflict: false } as RecordMeta],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('withdrawInspection 应将 submitted → withdrawn，并创建 AuditLogEntry', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.deleteSyncQueueItem).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const result = await useStore.getState().withdrawInspection('rec_123');

    expect(result).toBeDefined();
    expect(result!.status).toBe('withdrawn');
    expect(result!.withdrawCount).toBe(1);
    expect(result!.lastWithdrawnAt).toBeDefined();

    expect(indexedDb.addAuditLog).toHaveBeenCalled();
    const auditArg = vi.mocked(indexedDb.addAuditLog).mock.calls[0][0] as AuditLogEntry;
    expect(auditArg.recordId).toBe('rec_123');
    expect(auditArg.action).toBe('withdraw');
    expect(auditArg.result).toBe('success');

    expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'withdraw_audit_logged', toStatus: 'withdrawn' })
    );
  });

  it('validateOperation 对 withdrawn 执行 withdraw 应失败（状态门禁）', () => {
    useStore.setState({
      inspections: [makeDraft({ status: 'withdrawn' })],
    } as any);
    const withdrawn = makeDraft({ status: 'withdrawn' });
    const validation = useStore.getState().validateOperation('rec_123', withdrawn, 'withdraw');
    expect(validation.valid).toBe(false);
    const types = validation.errors.map(e => e.type);
    expect(types).toContain('status_gate');
  });

  it('审计日志写入失败不应阻塞撤回主流程', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.deleteSyncQueueItem).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockRejectedValue(new Error('Audit log write failed'));

    const result = await useStore.getState().withdrawInspection('rec_123');
    expect(result!.status).toBe('withdrawn');
  });

  it('getAuditLogs 应按记录ID过滤审计日志', () => {
    const mockLogs: AuditLogEntry[] = [
      { id: 'log1', recordId: 'rec_123', timestamp: '2024-06-20T10:00:00.000Z', action: 'withdraw', operatorId: 'u1', operatorName: '张三', sourceDeviceId: 'dev_local', fromStatus: 'submitted', toStatus: 'withdrawn', detail: '撤回操作', result: 'success' },
      { id: 'log2', recordId: 'rec_456', timestamp: '2024-06-20T10:00:00.000Z', action: 'withdraw', operatorId: 'u1', operatorName: '张三', sourceDeviceId: 'dev_local', fromStatus: 'submitted', toStatus: 'withdrawn', detail: '撤回操作', result: 'success' },
    ];
    useStore.setState({ auditLogs: mockLogs } as any);
    const logs = useStore.getState().getAuditLogs('rec_123');
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('log1');
  });
});

describe('useStore - 提交工作台：恢复续办与重新发起', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [
        makeDraft({ status: 'withdrawn', withdrawCount: 1, lastWithdrawnAt: '2024-06-20T10:00:00.000Z' }),
      ],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [{ recordId: 'rec_123', submissionCount: 1, withdrawCount: 1, exportCount: 0, hasConflict: false } as RecordMeta],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('resumeInspection 应将 withdrawn → resumed，记录 resume 事件', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

    const result = await useStore.getState().resumeInspection('rec_123');

    expect(result).toBeDefined();
    expect(result!.status).toBe('resumed');
    expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'resume', fromStatus: 'withdrawn', toStatus: 'resumed' })
    );
  });

  it('resubmitAfterWithdraw 应将 withdrawn → submitted，凭据更新', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addSyncQueueItem).mockResolvedValue();
    vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.putSubmissionReceipt).mockResolvedValue();

    const withdrawn = makeDraft({ status: 'withdrawn', withdrawCount: 1, submissionCount: 1 });
    useStore.setState({ inspections: [withdrawn] } as any);
    const result = await useStore.getState().resubmitAfterWithdraw(withdrawn);

    expect(result.status).toBe('submitted');
    expect(result.submissionCount).toBe(2);
    expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'resubmit_after_withdraw', fromStatus: 'withdrawn', toStatus: 'submitted' })
    );
    expect(indexedDb.putSubmissionReceipt).toHaveBeenCalled();
  });

  it('validateOperation 对 resumed 执行 submit 应通过', () => {
    const resumed = makeDraft({ status: 'resumed', values: { appearance: '正常', temperature: 42 } });
    useStore.setState({ inspections: [resumed] } as any);
    const validation = useStore.getState().validateOperation('rec_123', resumed, 'submit');
    expect(validation.valid).toBe(true);
  });

  it('validateOperation 对 synced 执行 withdraw 应失败', () => {
    const synced = makeDraft({ status: 'synced' });
    const validation = useStore.getState().validateOperation('rec_123', synced, 'withdraw');
    expect(validation.valid).toBe(false);
  });
});

describe('useStore - 提交工作台：结果导出', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [
        makeDraft({ id: 'rec_a', status: 'draft', date: '2024-06-20' }),
        makeDraft({ id: 'rec_b', status: 'submitted', date: '2024-06-19', submittedAt: '2024-06-19T09:00:00.000Z', submissionCount: 1 }),
        makeDraft({ id: 'rec_c', status: 'withdrawn', date: '2024-06-18', withdrawCount: 1 }),
      ],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [
        { id: 'rcp_1', recordId: 'rec_b', receiptNo: 'RCP-20240619-090000-ABCDEF', status: 'pending', snapshotId: 'snap_1', recordValuesHash: 'h1', operatorId: 'u1', operatorName: '张三', sourceDeviceId: 'dev_local_test', sourceDeviceInfo: 'Chrome', submittedAt: '2024-06-19T09:00:00.000Z' } as SubmissionReceipt,
      ],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [
        { recordId: 'rec_a', submissionCount: 0, withdrawCount: 0, exportCount: 0, hasConflict: false } as RecordMeta,
        { recordId: 'rec_b', submissionCount: 1, withdrawCount: 0, exportCount: 0, hasConflict: false } as RecordMeta,
        { recordId: 'rec_c', submissionCount: 1, withdrawCount: 1, exportCount: 0, hasConflict: false } as RecordMeta,
      ],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('exportRecords 无过滤应返回全部记录', async () => {
    const records = await useStore.getState().exportRecords({}, 'json');
    expect(records).toHaveLength(3);
  });

  it('exportRecords 按 status 过滤应仅返回匹配记录', async () => {
    const records = await useStore.getState().exportRecords({ statuses: ['submitted'] }, 'json');
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('submitted');
  });

  it('exportRecords 按 date 范围过滤', async () => {
    const records = await useStore.getState().exportRecords({ startDate: '2024-06-19', endDate: '2024-06-20' }, 'json');
    expect(records).toHaveLength(2);
    const dates = records.map(r => r.date);
    expect(dates).toContain('2024-06-19');
    expect(dates).toContain('2024-06-20');
    expect(dates).not.toContain('2024-06-18');
  });

  it('exportRecords 按 deviceIds 过滤', async () => {
    const records = await useStore.getState().exportRecords({ deviceIds: ['dev_123'] }, 'json');
    expect(records).toHaveLength(3);
    const noMatch = await useStore.getState().exportRecords({ deviceIds: ['dev_nonexistent'] }, 'json');
    expect(noMatch).toHaveLength(0);
  });

  it('exportRecords 导出列应包含工作台扩展字段', async () => {
    const records = await useStore.getState().exportRecords({ statuses: ['submitted'] }, 'json');
    expect(records[0]).toHaveProperty('receiptNo');
    expect(records[0]).toHaveProperty('submissionCount');
    expect(records[0]).toHaveProperty('withdrawCount');
    expect(records[0]).toHaveProperty('sourceDevice');
    expect(records[0]).toHaveProperty('deviceCategory');
    expect(records[0].receiptNo).toBe('RCP-20240619-090000-ABCDEF');
    expect(records[0].submissionCount).toBe(1);
  });

  it('exportRecords CSV 格式也应工作（返回相同数据）', async () => {
    const jsonRecords = await useStore.getState().exportRecords({}, 'json');
    const csvRecords = await useStore.getState().exportRecords({}, 'csv');
    expect(csvRecords).toHaveLength(jsonRecords.length);
    expect(csvRecords[0].id).toBe(jsonRecords[0].id);
  });
});

describe('useStore - 提交工作台：会话恢复与凭据查询', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [
        { id: 'rcp_1', recordId: 'rec_123', receiptNo: 'RCP-20240620-090000-AAAAAA', status: 'acknowledged', snapshotId: 'snap_1', recordValuesHash: 'h1', operatorId: 'u1', operatorName: '张三', sourceDeviceId: 'dev_local_test', sourceDeviceInfo: 'Chrome/Windows', submittedAt: '2024-06-20T09:00:00.000Z', receivedAt: '2024-06-20T09:01:00.000Z' } as SubmissionReceipt,
        { id: 'rcp_2', recordId: 'rec_123', receiptNo: 'RCP-20240620-100000-BBBBBB', status: 'pending', snapshotId: 'snap_2', recordValuesHash: 'h2', operatorId: 'u1', operatorName: '张三', sourceDeviceId: 'dev_local_test', sourceDeviceInfo: 'Chrome/Windows', submittedAt: '2024-06-20T10:00:00.000Z' } as SubmissionReceipt,
      ],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
      recoveredSession: null,
    } as any);
  });

  it('getSubmissionReceipts 应按记录ID排序，最新在前', () => {
    const receipts = useStore.getState().getSubmissionReceipts('rec_123');
    expect(receipts).toHaveLength(2);
    expect(receipts[0].receiptNo).toBe('RCP-20240620-100000-BBBBBB');
    expect(receipts[1].receiptNo).toBe('RCP-20240620-090000-AAAAAA');
  });

  it('getLatestReceipt 应返回最新的凭据', () => {
    const latest = useStore.getState().getLatestReceipt('rec_123');
    expect(latest?.receiptNo).toBe('RCP-20240620-100000-BBBBBB');
  });

  it('getTimelineEvents 应将状态历史转换为时间线事件', () => {
    useStore.setState({
      statusHistory: [
        { id: 'h1', recordId: 'rec_123', fromStatus: null, toStatus: 'draft', action: 'create_draft' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T08:00:00.000Z', deviceId: 'dev_local' },
        { id: 'h2', recordId: 'rec_123', fromStatus: 'draft', toStatus: 'submitted', action: 'submit' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T09:00:00.000Z', deviceId: 'dev_local' },
        { id: 'h3', recordId: 'rec_123', fromStatus: 'submitted', toStatus: 'withdrawn', action: 'withdraw_audit_logged' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T10:00:00.000Z', deviceId: 'dev_local', note: '撤回：发现温度数据异常' },
      ] as StatusChangeEvent[],
    } as any);

    const timeline = useStore.getState().getTimelineEvents('rec_123');
    expect(timeline).toHaveLength(3);
    expect(timeline[2].actionLabel).toBeTruthy();
    expect(timeline[0].note).toBe('撤回：发现温度数据异常');
    expect(timeline[0].operatorName).toBe('张三');
    expect(timeline[0].sourceDeviceId).toBe('dev_local');
    expect(timeline[0].fromStatus).toBe('submitted');
    expect(timeline[0].toStatus).toBe('withdrawn');
  });

  it('saveSession / restoreSession 应能持久化和恢复会话', async () => {
    vi.mocked(indexedDb.putSessionState).mockResolvedValue();
    vi.mocked(indexedDb.getSessionByUserDevice).mockResolvedValue(
      { id: 'sess_1', userId: 'inspector_001', deviceId: 'dev_local_test', startedAt: '2024-06-20T07:00:00.000Z', lastActiveAt: '2024-06-20T08:00:00.000Z', lastEditingRecordId: 'rec_123', unsavedChanges: true } as SessionState
    );

    await useStore.getState().saveSession({
      userId: 'inspector_001',
      deviceId: 'dev_local_test',
      startedAt: '2024-06-20T07:00:00.000Z',
      lastActiveAt: '2024-06-20T08:00:00.000Z',
      lastEditingRecordId: 'rec_123',
      unsavedChanges: true,
    });
    expect(indexedDb.putSessionState).toHaveBeenCalled();

    const restored = await useStore.getState().restoreSession();
    expect(restored).toBeDefined();
    expect(restored?.userId).toBe('inspector_001');
    expect(restored?.lastEditingRecordId).toBe('rec_123');
    expect(useStore.getState().recoveredSession).toBeDefined();
  });
});

describe('useStore - 提交工作台：旧草稿检测与迁移', () => {
  const updatedTemplate: Template = { ...mockTemplate, version: 5, fields: [...mockTemplate.fields, { id: 'f_new', key: 'newField', label: '新字段', type: 'text', required: false }] };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [updatedTemplate],
      devices: [mockDevice],
      inspections: [
        makeDraft({ id: 'rec_stale', status: 'draft', templateVersion: 2 }),
        makeDraft({ id: 'rec_fresh', status: 'draft', templateVersion: 5 }),
        makeDraft({ id: 'rec_submitted', status: 'submitted', templateVersion: 2, submissionCount: 1 }),
      ],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('getStaleDrafts 应检测出版本落后的草稿', () => {
    const stale = useStore.getState().getStaleDrafts();
    expect(stale).toHaveLength(1);
    expect(stale[0].recordId).toBe('rec_stale');
    expect(stale[0].recordTemplateVersion).toBe(2);
    expect(stale[0].latestTemplateVersion).toBe(5);
  });

  it('migrateStaleDraft 应将草稿升级到最新模板版本', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

    const result = await useStore.getState().migrateStaleDraft('rec_stale');

    expect(result).toBeDefined();
    expect(result!.templateVersion).toBe(5);
    expect(result!.status).toBe('draft');
    expect(indexedDb.addStatusChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'save_draft' })
    );

    const updated = useStore.getState().inspections.find(r => r.id === 'rec_stale');
    expect(updated?.templateVersion).toBe(5);
  });

  it('migrateStaleDraft 对不存在的记录应抛出错误', async () => {
    await expect(useStore.getState().migrateStaleDraft('rec_nonexistent')).rejects.toThrow();
  });
});

describe('useStore - 提交工作台：导入记录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [makeDraft({ id: 'rec_existing' })],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      sessionStates: [],
      recordMetaList: [],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('importRecords JSON 格式应导入合法记录', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const data = [{
      id: 'rec_new', deviceId: 'dev_123', templateId: 'tpl_123',
      date: '2024-06-20', values: { a: 1 }, status: 'draft',
    }];

    const result = await useStore.getState().importRecords(data, 'json');

    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.importedIds).toContain('rec_new');
    expect(indexedDb.putInspection).toHaveBeenCalled();
  });

  it('importRecords 重复 ID 应被跳过', async () => {
    const data = [{
      id: 'rec_existing', deviceId: 'dev_123', templateId: 'tpl_123', date: '2024-06-20',
    }];

    const result = await useStore.getState().importRecords(data, 'json');

    expect(result.successCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('importRecords 非法数据应计入错误', async () => {
    const data = [{ bad: 'data' }, { id: 'rec_new', deviceId: 'dev_123', templateId: 'tpl_123', date: '2024-06-20' }];

    const result = await useStore.getState().importRecords(data, 'json');

    expect(result.failCount).toBeGreaterThan(0);
    expect(result.successCount).toBe(1);
  });

  it('importRecords CSV 格式应通过 parseCsvToRecords 解析后导入', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const csvText = 'id,deviceId,templateId,date,status\nrec_csv_new,dev_123,tpl_123,2024-06-20,draft';

    const result = await useStore.getState().importRecords([csvText], 'csv');

    expect(result.successCount).toBe(1);
    expect(result.importedIds).toContain('rec_csv_new');
  });

  it('importRecords 应返回 conflicts 冲突检测结果', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const data = [{
      id: 'rec_conflict_test', deviceId: 'dev_123', templateId: 'tpl_123',
      date: '2024-06-20', values: { temperature: '25' }, status: 'submitted',
      submissionCount: 1,
    }];

    const result = await useStore.getState().importRecords(data, 'json');
    expect(result.successCount).toBe(1);
    expect(result.conflicts).toBeDefined();
  });

  it('importRecords 应返回 compatibilityReports 字段兼容性报告', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const data = [{
      id: 'rec_compat_test', deviceId: 'dev_123', templateId: 'tpl_123',
      date: '2024-06-20', values: {}, status: 'draft',
    }];

    const result = await useStore.getState().importRecords(data, 'json');
    expect(result.successCount).toBe(1);
    expect(result.compatibilityReports).toBeDefined();
    expect(result.compatibilityReports.length).toBe(1);
  });
});

describe('useStore - 提交工作台：CSV 导出导入闭环验证', () => {
  const testRecord: InspectionRecord = {
    id: 'rec_circular_test',
    deviceId: 'dev_123',
    templateId: 'tpl_123',
    templateVersion: 1,
    inspectorId: 'inspector_001',
    inspectorName: '张三',
    date: '2024-06-20',
    values: { temperature: '25.5', pressure: '101.3', notes: '正常' },
    photos: [
      { id: 'ph1', placeholderName: 'photo1.jpg', size: 102400, createdAt: '2024-06-20T08:00:00.000Z' },
      { id: 'ph2', placeholderName: 'photo2.jpg', size: 204800, createdAt: '2024-06-20T08:05:00.000Z' },
    ],
    anomalyLevel: 'none' as AnomalyLevel,
    status: 'submitted',
    createdAt: '2024-06-20T08:00:00.000Z',
    updatedAt: '2024-06-20T09:00:00.000Z',
    submittedAt: '2024-06-20T09:00:00.000Z',
    firstSubmittedAt: '2024-06-20T09:00:00.000Z',
    submissionCount: 1,
    withdrawCount: 0,
    originDeviceId: 'dev_local_test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      templates: [mockTemplate],
      devices: [mockDevice],
      inspections: [testRecord],
      conflicts: [],
      logs: [],
      syncQueue: [],
      statusHistory: [
        { id: 'h1', recordId: 'rec_circular_test', fromStatus: null as any, toStatus: 'draft', action: 'create_draft' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T08:00:00.000Z', deviceId: 'dev_123', date: '2024-06-20' },
        { id: 'h2', recordId: 'rec_circular_test', fromStatus: 'draft', toStatus: 'submitted', action: 'submit' as StatusChangeAction, actorId: 'u1', actorName: '张三', timestamp: '2024-06-20T09:00:00.000Z', deviceId: 'dev_123', date: '2024-06-20' },
      ],
      submissionSnapshots: [
        { id: 'snap_1', recordId: 'rec_circular_test', snapshotAt: '2024-06-20T09:00:00.000Z', values: testRecord.values, photos: testRecord.photos, anomalyLevel: 'none', templateVersion: 1 },
      ],
      submissionReceipts: [
        { id: 'rcp_1', recordId: 'rec_circular_test', receiptNo: 'RCP-20240620-090000-AAAAAA', status: 'acknowledged', snapshotId: 'snap_1', recordValuesHash: 'hash123', operatorId: 'u1', operatorName: '张三', sourceDeviceId: 'dev_local_test', sourceDeviceInfo: 'Chrome/Windows', submittedAt: '2024-06-20T09:00:00.000Z' },
      ],
      auditLogs: [
        { id: 'audit_1', recordId: 'rec_circular_test', action: 'submit', operatorId: 'u1', operatorName: '张三', timestamp: '2024-06-20T09:00:00.000Z', detail: '提交巡检记录', result: 'success' },
      ],
      sessionStates: [],
      recordMetaList: [
        { recordId: 'rec_circular_test', submissionCount: 1, withdrawCount: 0, hasConflict: false, exportCount: 0 },
      ],
      offlineMode: true,
      currentDeviceId: 'dev_local_test',
    } as any);
  });

  it('导出的扁平化数据应包含所有核心字段', async () => {
    const exported = await useStore.getState().exportRecords({}, 'json');

    expect(exported).toHaveLength(1);
    const record = exported[0];
    expect(record.id).toBe('rec_circular_test');
    expect(record.deviceId).toBe('dev_123');
    expect(record.templateId).toBe('tpl_123');
    expect(record.status).toBe('submitted');
    expect(record.submissionCount).toBe(1);
    expect(record.values).toBeDefined();
    expect(record.photos).toBeDefined();
    expect(record.receiptNo).toBe('RCP-20240620-090000-AAAAAA');
  });

  it('导出的记录 ID 应在导入时被保留', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
    vi.mocked(indexedDb.putSubmissionReceipt).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const exported = await useStore.getState().exportRecords({}, 'json');
    expect(exported[0].id).toBe('rec_circular_test');

    const newState = useStore.getState();
    useStore.setState({ inspections: [] });

    const importResult = await useStore.getState().importRecords(exported, 'json');

    expect(importResult.successCount).toBe(1);
    expect(importResult.importedIds).toContain('rec_circular_test');

    const importedRecord = useStore.getState().inspections.find(r => r.id === 'rec_circular_test');
    expect(importedRecord).toBeDefined();
    expect(importedRecord?.deviceId).toBe('dev_123');
    expect(importedRecord?.status).toBe('submitted');
    expect(importedRecord?.submissionCount).toBe(1);

    useStore.setState(newState as any);
  });

  it('导入时应检测 ID 重复冲突', async () => {
    const exported = await useStore.getState().exportRecords({}, 'json');

    const importResult = await useStore.getState().importRecords(exported, 'json');

    expect(importResult.successCount).toBe(0);
    expect(importResult.skippedCount).toBe(1);
  });

  it('完整数据导出应包含状态历史、快照、凭据、审计日志', async () => {
    const fullData = await useStore.getState().exportRecords({}, 'json', { fullData: true });

    expect(fullData).toHaveLength(1);
    const item = fullData[0];
    expect(item.record).toBeDefined();
    expect(item.statusHistory).toBeDefined();
    expect(item.snapshots).toBeDefined();
    expect(item.receipts).toBeDefined();
    expect(item.auditLogs).toBeDefined();
    expect(item.meta).toBeDefined();

    expect(item.record.id).toBe('rec_circular_test');
    expect(item.statusHistory.length).toBeGreaterThan(0);
    expect(item.snapshots.length).toBeGreaterThan(0);
    expect(item.receipts.length).toBeGreaterThan(0);
    expect(item.auditLogs.length).toBeGreaterThan(0);
  });

  it('完整数据导入应回灌所有关联数据', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
    vi.mocked(indexedDb.putSubmissionReceipt).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const fullData = await useStore.getState().exportRecords({}, 'json', { fullData: true });

    const newState = useStore.getState();
    useStore.setState({
      inspections: [],
      statusHistory: [],
      submissionSnapshots: [],
      submissionReceipts: [],
      auditLogs: [],
      recordMetaList: [],
    });

    const importResult = await useStore.getState().importRecords(fullData, 'json');

    expect(importResult.successCount).toBe(1);
    expect(useStore.getState().statusHistory.length).toBeGreaterThan(0);
    expect(useStore.getState().submissionSnapshots.length).toBeGreaterThan(0);
    expect(useStore.getState().submissionReceipts.length).toBeGreaterThan(0);
    expect(useStore.getState().auditLogs.length).toBeGreaterThan(0);

    useStore.setState(newState as any);
  });

  it('冲突检测应识别同设备同日记录', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.addStatusChangeEvent).mockResolvedValue();
    vi.mocked(indexedDb.addSubmissionSnapshot).mockResolvedValue();
    vi.mocked(indexedDb.putSubmissionReceipt).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const newRecord = {
      id: 'rec_duplicate_test',
      deviceId: 'dev_123',
      templateId: 'tpl_123',
      date: '2024-06-20',
      values: { temperature: '25.5' },
      status: 'submitted',
      submissionCount: 1,
    };

    const importResult = await useStore.getState().importRecords([newRecord], 'json');

    expect(importResult.successCount).toBe(1);
    expect(importResult.conflicts).toBeDefined();
    expect(importResult.conflicts.length).toBeGreaterThan(0);
  });

  it('字段兼容性报告应正确识别缺失字段', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();

    const recordWithMissingFields = {
      id: 'rec_missing_fields',
      deviceId: 'dev_123',
      templateId: 'tpl_123',
      date: '2024-06-20',
      values: {},
      status: 'draft',
    };

    const importResult = await useStore.getState().importRecords([recordWithMissingFields], 'json');

    expect(importResult.successCount).toBe(1);
    expect(importResult.compatibilityReports).toBeDefined();
    expect(importResult.compatibilityReports.length).toBe(1);
    expect(importResult.compatibilityReports[0].missingFields.length).toBeGreaterThan(0);
  });

  it('导出的 CSV 格式数据应能被正确解析和导入', async () => {
    vi.mocked(indexedDb.putInspection).mockResolvedValue();
    vi.mocked(indexedDb.putRecordMeta).mockResolvedValue();
    vi.mocked(indexedDb.addAuditLog).mockResolvedValue();

    const exported = await useStore.getState().exportRecords({}, 'csv');

    const headers = Object.keys(exported[0]);
    const values = Object.values(exported[0]).map(v =>
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
    );
    const csvText = [headers.join(','), values.join(',')].join('\n');

    const newState = useStore.getState();
    useStore.setState({ inspections: [] });

    const importResult = await useStore.getState().importRecords([csvText], 'csv');

    expect(importResult.successCount).toBe(1);
    expect(importResult.importedIds).toContain('rec_circular_test');

    useStore.setState(newState as any);
  });
});
