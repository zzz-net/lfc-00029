import { describe, it, expect } from 'vitest';
import {
  canTransition,
  canPerformAction,
  validateRequiredFields,
  validateVersionMatch,
  validateStatusGate,
  checkDuplicateSubmission,
  buildFullValidation,
  buildTimelineEvents,
  getMissingRequiredFields,
  generateReceiptNo,
  computeValuesHash,
  STATUS_TRANSITIONS,
} from '@/lib/submissionWorkbench';
import type {
  RecordStatus,
  StatusChangeAction,
  TemplateField,
  InspectionRecord,
  AnomalyLevel,
  Template,
} from '@/types';

const mockFields: TemplateField[] = [
  { id: 'f1', key: 'appearance', label: '外观检查', type: 'select', required: true, anomalyLevel: 'medium', options: ['正常', '异常'] },
  { id: 'f2', key: 'temperature', label: '运行温度', type: 'number', required: true, anomalyLevel: 'high' },
  { id: 'f3', key: 'notes', label: '备注', type: 'text', required: false },
];

const mockTemplate: Template = {
  id: 'tpl_1',
  name: '测试模板',
  version: 3,
  enabled: true,
  fields: mockFields,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const makeRecord = (overrides: Partial<InspectionRecord> = {}): InspectionRecord => ({
  id: 'rec_test',
  deviceId: 'dev_1',
  templateId: 'tpl_1',
  templateVersion: 3,
  inspectorId: 'u1',
  inspectorName: '测试员',
  date: '2024-06-20',
  values: { appearance: '正常', temperature: 42 },
  photos: [],
  anomalyLevel: 'none',
  status: 'draft',
  createdAt: '2024-06-20T08:00:00.000Z',
  updatedAt: '2024-06-20T08:00:00.000Z',
  ...overrides,
});

describe('submissionWorkbench - 状态门禁', () => {
  it('STATUS_TRANSITIONS 应包含所有状态', () => {
    const expectedStatuses: RecordStatus[] = ['draft', 'submitted', 'synced', 'conflict', 'withdrawn', 'resumed'];
    expectedStatuses.forEach(s => {
      expect(STATUS_TRANSITIONS).toHaveProperty(s);
    });
  });

  it('draft 应能流转到 submitted、withdrawn', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('draft', 'withdrawn')).toBe(true);
  });

  it('draft 不能直接流转到 synced', () => {
    expect(canTransition('draft', 'synced')).toBe(false);
  });

  it('submitted 应能流转到 synced、withdrawn、conflict、draft', () => {
    expect(canTransition('submitted', 'synced')).toBe(true);
    expect(canTransition('submitted', 'withdrawn')).toBe(true);
    expect(canTransition('submitted', 'conflict')).toBe(true);
    expect(canTransition('submitted', 'draft')).toBe(true);
  });

  it('withdrawn 应能流转到 submitted、draft', () => {
    expect(canTransition('withdrawn', 'submitted')).toBe(true);
    expect(canTransition('withdrawn', 'draft')).toBe(true);
  });

  it('resumed 应能流转到 submitted', () => {
    expect(canTransition('resumed', 'submitted')).toBe(true);
  });

  it('synced 不应流转到任何其他状态（终态）', () => {
    expect(canTransition('synced', 'draft')).toBe(false);
    expect(canTransition('synced', 'withdrawn')).toBe(false);
    expect(canTransition('synced', 'submitted')).toBe(false);
  });
});

describe('submissionWorkbench - 必填项校验', () => {
  it('validateRequiredFields 所有必填项有值时应返回空数组', () => {
    const result = validateRequiredFields(
      { appearance: '正常', temperature: 42 },
      mockFields
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('validateRequiredFields 缺失必填项时应返回具体字段错误', () => {
    const result = validateRequiredFields(
      { appearance: '正常' },
      mockFields
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe('required');
  });

  it('validateRequiredFields 值为 undefined、null、空字符串均视为缺失', () => {
    const r1 = validateRequiredFields({ appearance: '', temperature: 42 }, mockFields);
    expect(r1.length).toBeGreaterThan(0);

    const r2 = validateRequiredFields({ appearance: null as any, temperature: 42 }, mockFields);
    expect(r2.length).toBeGreaterThan(0);
  });

  it('getMissingRequiredFields 应返回缺失字段的 label 列表', () => {
    const missing = getMissingRequiredFields({ appearance: '正常' }, mockFields);
    expect(missing).toContain('运行温度');
  });

  it('非必填项缺失不应影响校验', () => {
    const result = validateRequiredFields({ appearance: '正常', temperature: 42 }, mockFields);
    expect(result).toHaveLength(0);
  });
});

describe('submissionWorkbench - 模板版本校验', () => {
  it('validateVersionMatch 版本号一致时返回 null', () => {
    expect(validateVersionMatch(3, mockTemplate)).toBeNull();
  });

  it('validateVersionMatch 版本号不一致时返回错误项', () => {
    const result = validateVersionMatch(2, mockTemplate);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('version');
  });

  it('validateVersionMatch 模板为 undefined 时返回错误', () => {
    const result = validateVersionMatch(3, undefined);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('version');
  });
});

describe('submissionWorkbench - 状态门禁校验', () => {
  it('validateStatusGate 合法动作返回 null', () => {
    const result = validateStatusGate('draft', 'submit');
    expect(result).toBeNull();
  });

  it('validateStatusGate 非法动作返回 status_gate 错误', () => {
    const result = validateStatusGate('synced', 'withdraw');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('status_gate');
  });
});

describe('submissionWorkbench - 重复上报检测', () => {
  it('同设备同日存在 submitted 记录时应检测为重复', () => {
    const existing = [
      makeRecord({ id: 'rec_old', status: 'submitted', date: '2024-06-20', deviceId: 'dev_1' }),
    ];
    const result = checkDuplicateSubmission('dev_1', '2024-06-20', existing, 'rec_new');
    expect(result.isDuplicate).toBe(true);
    expect(result.existingRecordId).toBe('rec_old');
  });

  it('同设备同日存在 synced 记录时应检测为重复', () => {
    const existing = [
      makeRecord({ id: 'rec_old', status: 'synced', date: '2024-06-20', deviceId: 'dev_1' }),
    ];
    const result = checkDuplicateSubmission('dev_1', '2024-06-20', existing, 'rec_new');
    expect(result.isDuplicate).toBe(true);
  });

  it('排除自身 ID 时不应误判', () => {
    const existing = [
      makeRecord({ id: 'rec_123', status: 'submitted', date: '2024-06-20', deviceId: 'dev_1' }),
    ];
    const result = checkDuplicateSubmission('dev_1', '2024-06-20', existing, 'rec_123');
    expect(result.isDuplicate).toBe(false);
  });

  it('不同日期不应判定为重复', () => {
    const existing = [
      makeRecord({ id: 'rec_old', status: 'submitted', date: '2024-06-19', deviceId: 'dev_1' }),
    ];
    const result = checkDuplicateSubmission('dev_1', '2024-06-20', existing, 'rec_new');
    expect(result.isDuplicate).toBe(false);
  });

  it('不同设备不应判定为重复', () => {
    const existing = [
      makeRecord({ id: 'rec_old', status: 'submitted', date: '2024-06-20', deviceId: 'dev_2' }),
    ];
    const result = checkDuplicateSubmission('dev_1', '2024-06-20', existing, 'rec_new');
    expect(result.isDuplicate).toBe(false);
  });

  it('draft/withdrawn/resumed 状态不应被视为重复', () => {
    const existing = [
      makeRecord({ id: 'rec_old', status: 'draft', date: '2024-06-20', deviceId: 'dev_1' }),
      makeRecord({ id: 'rec_old2', status: 'withdrawn', date: '2024-06-20', deviceId: 'dev_1' }),
    ];
    const result = checkDuplicateSubmission('dev_1', '2024-06-20', existing, 'rec_new');
    expect(result.isDuplicate).toBe(false);
  });
});

describe('submissionWorkbench - 四层校验聚合 buildFullValidation', () => {
  it('全通过时 valid=true 无错误无警告', () => {
    const record = makeRecord();
    const result = buildFullValidation({
      values: record.values,
      templateFields: mockFields,
      recordVersion: 3,
      currentTemplate: mockTemplate,
      currentStatus: 'draft',
      targetAction: 'submit',
      deviceId: 'dev_1',
      date: '2024-06-20',
      existingRecords: [],
      excludeRecordId: 'rec_test',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('缺失必填 + 版本不匹配 + 状态门禁错误 + 重复应全部被检测到', () => {
    const record = makeRecord({ values: { appearance: '正常' } });
    const existing = [makeRecord({ id: 'rec_dup', status: 'submitted' })];

    const result = buildFullValidation({
      values: record.values,
      templateFields: mockFields,
      recordVersion: 1,
      currentTemplate: mockTemplate,
      currentStatus: 'synced',
      targetAction: 'submit',
      deviceId: 'dev_1',
      date: '2024-06-20',
      existingRecords: existing,
      excludeRecordId: 'rec_test',
    });

    expect(result.valid).toBe(false);
    const types = result.errors.map(e => e.type);
    expect(types).toContain('required');
    expect(types).toContain('version');
    expect(types).toContain('status_gate');
    expect(types).toContain('duplicate');
  });

  it('hasConflict=true 应检测冲突错误', () => {
    const result = buildFullValidation({
      values: { appearance: '正常', temperature: 42 },
      templateFields: mockFields,
      recordVersion: 3,
      currentTemplate: mockTemplate,
      currentStatus: 'conflict',
      targetAction: 'submit',
      deviceId: 'dev_1',
      date: '2024-06-20',
      existingRecords: [],
      excludeRecordId: 'rec_test',
      hasConflict: true,
    });
    const types = result.errors.map(e => e.type);
    expect(types).toContain('conflict');
  });
});

describe('submissionWorkbench - 时间线构建', () => {
  it('buildTimelineEvents 应按时间倒序排列，并填充中文标签', () => {
    const events: Array<{
      id: string; recordId: string; fromStatus: RecordStatus | null; toStatus: RecordStatus | null;
      action: StatusChangeAction; operatorName: string; timestamp: string; deviceId?: string; note?: string;
    }> = [
      { id: 'h1', recordId: 'rec_1', fromStatus: null, toStatus: 'draft', action: 'create_draft', operatorName: '张三', timestamp: '2024-06-20T08:00:00.000Z', deviceId: 'dev_local' },
      { id: 'h2', recordId: 'rec_1', fromStatus: 'draft', toStatus: 'submitted', action: 'submit', operatorName: '张三', timestamp: '2024-06-20T09:00:00.000Z', deviceId: 'dev_local' },
      { id: 'h3', recordId: 'rec_1', fromStatus: 'submitted', toStatus: 'withdrawn', action: 'withdraw_audit_logged', operatorName: '张三', timestamp: '2024-06-20T10:00:00.000Z', deviceId: 'dev_local', note: '撤回：发现温度数据异常' },
      { id: 'h4', recordId: 'rec_1', fromStatus: 'withdrawn', toStatus: 'resumed', action: 'resume', operatorName: '张三', timestamp: '2024-06-20T11:00:00.000Z', deviceId: 'dev_local' },
    ];

    const timeline = buildTimelineEvents(events);
    expect(timeline).toHaveLength(4);
    expect(timeline[0].timestamp).toBe('2024-06-20T11:00:00.000Z');
    expect(timeline[0].actionLabel).toBeTruthy();
    expect(timeline[1].note).toBe('撤回：发现温度数据异常');
    expect(timeline[3].operatorName).toBe('张三');
    expect(timeline[3].sourceDeviceId).toBe('dev_local');
  });

  it('空事件数组应返回空时间线', () => {
    expect(buildTimelineEvents([])).toEqual([]);
  });

  it('事件包含 note 应透传', () => {
    const events: Array<{
      id: string; recordId: string; fromStatus: RecordStatus | null; toStatus: RecordStatus | null;
      action: StatusChangeAction; operatorName: string; timestamp: string; deviceId?: string; note?: string;
    }> = [
      { id: 'h1', recordId: 'rec_1', fromStatus: 'submitted', toStatus: 'withdrawn', action: 'withdraw', operatorName: '张三', timestamp: '2024-06-20T09:00:00.000Z', deviceId: 'dev_local', note: '数据有误需要修改' },
    ];
    const timeline = buildTimelineEvents(events);
    expect(timeline[0].note).toBe('数据有误需要修改');
  });
});

describe('submissionWorkbench - 凭据号与哈希', () => {
  it('generateReceiptNo 格式应符合 RCP-YYYYMMDD-HHMMSS-XXXXXX', () => {
    const ts = '2024-06-20T09:15:30.000Z';
    const no = generateReceiptNo('rec_123_abcdef', ts);
    expect(no).toMatch(/^RCP-\d{8}-\d{6}-[A-Z0-9]{6}$/);
    expect(no).toContain('ABCDEF');
  });

  it('computeValuesHash 相同内容应产生相同哈希', () => {
    const v1 = { appearance: '正常', temperature: 42 };
    const v2 = { appearance: '正常', temperature: 42 };
    expect(computeValuesHash(v1)).toBe(computeValuesHash(v2));
  });

  it('computeValuesHash 不同内容应产生不同哈希', () => {
    const v1 = { appearance: '正常', temperature: 42 };
    const v2 = { appearance: '异常', temperature: 42 };
    expect(computeValuesHash(v1)).not.toBe(computeValuesHash(v2));
  });
});
