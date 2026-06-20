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
  detectStaleDrafts,
  validateImportData,
  parseCsvToRecords,
  computeButtonActions,
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

describe('submissionWorkbench - 旧草稿检测 detectStaleDrafts', () => {
  const updatedTemplate: Template = { ...mockTemplate, version: 5 };

  it('模板版本低于最新时应检测为旧草稿', () => {
    const records = [makeRecord({ status: 'draft', templateVersion: 3 })];
    const result = detectStaleDrafts(records, [updatedTemplate]);
    expect(result).toHaveLength(1);
    expect(result[0].recordId).toBe('rec_test');
    expect(result[0].recordTemplateVersion).toBe(3);
    expect(result[0].latestTemplateVersion).toBe(5);
    expect(result[0].templateName).toBe('测试模板');
  });

  it('模板版本一致时不应检测为旧草稿', () => {
    const records = [makeRecord({ status: 'draft', templateVersion: 5 })];
    const result = detectStaleDrafts(records, [updatedTemplate]);
    expect(result).toHaveLength(0);
  });

  it('已提交/已同步记录不应被检测', () => {
    const records = [
      makeRecord({ id: 'r1', status: 'submitted', templateVersion: 3 }),
      makeRecord({ id: 'r2', status: 'synced', templateVersion: 3 }),
    ];
    const result = detectStaleDrafts(records, [updatedTemplate]);
    expect(result).toHaveLength(0);
  });

  it('withdrawn/resumed 状态应被检测', () => {
    const records = [
      makeRecord({ id: 'r1', status: 'withdrawn', templateVersion: 3 }),
      makeRecord({ id: 'r2', status: 'resumed', templateVersion: 3 }),
    ];
    const result = detectStaleDrafts(records, [updatedTemplate]);
    expect(result).toHaveLength(2);
  });

  it('找不到模板时应跳过', () => {
    const records = [makeRecord({ status: 'draft', templateVersion: 3, templateId: 'tpl_unknown' })];
    const result = detectStaleDrafts(records, [updatedTemplate]);
    expect(result).toHaveLength(0);
  });

  it('空列表应返回空', () => {
    expect(detectStaleDrafts([], [updatedTemplate])).toEqual([]);
    expect(detectStaleDrafts([makeRecord({ status: 'draft' })], [])).toEqual([]);
  });
});

describe('submissionWorkbench - 导入校验 validateImportData', () => {
  it('合法数据应进入 valid 列表', () => {
    const data = [{
      id: 'rec_import_1', deviceId: 'dev_1', templateId: 'tpl_1',
      date: '2024-06-20', values: { a: 1 }, status: 'draft',
    }];
    const result = validateImportData(data, []);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].id).toBe('rec_import_1');
    expect(result.skipped).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('已有 ID 的记录应被跳过', () => {
    const data = [{
      id: 'rec_existing', deviceId: 'dev_1', templateId: 'tpl_1', date: '2024-06-20',
    }];
    const existing = [makeRecord({ id: 'rec_existing' })];
    const result = validateImportData(data, existing);
    expect(result.valid).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });

  it('缺少 id 的记录应报错', () => {
    const data = [{ deviceId: 'dev_1' }];
    const result = validateImportData(data, []);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('缺少记录ID');
  });

  it('缺少必要字段应报错', () => {
    const data = [{ id: 'rec_1' }];
    const result = validateImportData(data, []);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('缺少必要字段');
  });

  it('无效状态值应报错', () => {
    const data = [{
      id: 'rec_1', deviceId: 'dev_1', templateId: 'tpl_1', date: '2024-06-20', status: 'invalid_status',
    }];
    const result = validateImportData(data, []);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('无效的状态值');
  });

  it('非对象数据应报错', () => {
    const data = [null, 'string', 42];
    const result = validateImportData(data, []);
    expect(result.errors).toHaveLength(3);
  });

  it('混合数据应正确分类', () => {
    const data = [
      { id: 'rec_ok', deviceId: 'dev_1', templateId: 'tpl_1', date: '2024-06-20' },
      { id: 'rec_dup', deviceId: 'dev_1', templateId: 'tpl_1', date: '2024-06-20' },
      { deviceId: 'dev_1' },
      { id: 'rec_bad', status: 'weird' },
    ];
    const existing = [makeRecord({ id: 'rec_dup' })];
    const result = validateImportData(data, existing);
    expect(result.valid).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('submissionWorkbench - CSV 解析 parseCsvToRecords', () => {
  it('应解析标准 CSV', () => {
    const csv = 'id,deviceId,date\nrec_1,dev_1,2024-06-20\nrec_2,dev_2,2024-06-21';
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe('rec_1');
    expect(records[1].date).toBe('2024-06-21');
  });

  it('应处理带引号的字段', () => {
    const csv = 'id,deviceId,date\n"rec_1","dev_1","2024-06-20"';
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('rec_1');
  });

  it('应解析 JSON 字段', () => {
    const csv = 'id,values\nrec_1,"{""a"":1}"';
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(1);
    expect(records[0].values).toEqual({ a: 1 });
  });

  it('应将数值字段转为数字', () => {
    const csv = 'id,templateVersion,submissionCount,withdrawCount\nrec_1,3,2,1';
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(1);
    expect(records[0].templateVersion).toBe(3);
    expect(records[0].submissionCount).toBe(2);
    expect(records[0].withdrawCount).toBe(1);
  });

  it('空 CSV 或仅表头应返回空', () => {
    expect(parseCsvToRecords('')).toEqual([]);
    expect(parseCsvToRecords('id,deviceId')).toEqual([]);
  });

  it('列数不匹配的行应被跳过', () => {
    const csv = 'id,deviceId\nrec_1';
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(0);
  });
});

describe('submissionWorkbench - 按钮状态计算 computeButtonActions', () => {
  const templates = [mockTemplate];

  it('draft 状态应有编辑和提交按钮可用', () => {
    const record = makeRecord({ status: 'draft', values: { appearance: '正常', temperature: 42 } });
    const actions = computeButtonActions(record, templates, [], false);
    const editAction = actions.find(a => a.key === 'edit');
    const submitAction = actions.find(a => a.key === 'submit');
    expect(editAction?.disabled).toBe(false);
    expect(submitAction?.disabled).toBe(false);
  });

  it('draft 状态版本不匹配时提交应禁用', () => {
    const record = makeRecord({ status: 'draft', templateVersion: 1, values: { appearance: '正常', temperature: 42 } });
    const actions = computeButtonActions(record, templates, [], false);
    const submitAction = actions.find(a => a.key === 'submit');
    expect(submitAction?.disabled).toBe(true);
    expect(submitAction?.reason).toBeTruthy();
  });

  it('draft 缺少必填项时提交应禁用', () => {
    const record = makeRecord({ status: 'draft', values: {} });
    const actions = computeButtonActions(record, templates, [], false);
    const submitAction = actions.find(a => a.key === 'submit');
    expect(submitAction?.disabled).toBe(true);
    expect(submitAction?.reason).toContain('必填');
  });

  it('submitted 状态应只能撤回', () => {
    const record = makeRecord({ status: 'submitted' });
    const actions = computeButtonActions(record, templates, [], false);
    const editAction = actions.find(a => a.key === 'edit');
    const submitAction = actions.find(a => a.key === 'submit');
    const withdrawAction = actions.find(a => a.key === 'withdraw');
    expect(editAction?.disabled).toBe(true);
    expect(submitAction?.disabled).toBe(true);
    expect(withdrawAction?.disabled).toBe(false);
  });

  it('withdrawn 状态应有重新提交按钮', () => {
    const record = makeRecord({ status: 'withdrawn', values: { appearance: '正常', temperature: 42 } });
    const actions = computeButtonActions(record, templates, [], false);
    const resubmitAction = actions.find(a => a.key === 'resubmit');
    expect(resubmitAction?.disabled).toBe(false);
  });

  it('synced 终态所有操作应禁用', () => {
    const record = makeRecord({ status: 'synced' });
    const actions = computeButtonActions(record, templates, [], false);
    actions.forEach(a => {
      expect(a.disabled).toBe(true);
    });
  });

  it('有冲突时提交应禁用', () => {
    const record = makeRecord({ status: 'draft', values: { appearance: '正常', temperature: 42 } });
    const actions = computeButtonActions(record, templates, [], true);
    const submitAction = actions.find(a => a.key === 'submit');
    expect(submitAction?.disabled).toBe(true);
    expect(submitAction?.reason).toContain('冲突');
  });

  it('重复提交时提交应禁用', () => {
    const record = makeRecord({ status: 'draft', values: { appearance: '正常', temperature: 42 } });
    const existing = [makeRecord({ id: 'rec_dup', status: 'submitted', date: '2024-06-20', deviceId: 'dev_1' })];
    const actions = computeButtonActions(record, templates, existing, false);
    const submitAction = actions.find(a => a.key === 'submit');
    expect(submitAction?.disabled).toBe(true);
    expect(submitAction?.reason).toBeTruthy();
  });

  it('每个按钮应有 variant 属性', () => {
    const record = makeRecord({ status: 'draft', values: { appearance: '正常', temperature: 42 } });
    const actions = computeButtonActions(record, templates, [], false);
    actions.forEach(a => {
      expect(a.variant).toBeDefined();
      expect(['primary', 'warning', 'danger', 'info', 'ghost']).toContain(a.variant);
    });
  });
});
