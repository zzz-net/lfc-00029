export type StatusKey = 'draft' | 'submitted' | 'synced' | 'conflict' | 'withdrawn' | 'resumed';
export type ActionKey = 'save_draft' | 'submit' | 'withdraw' | 'sync' | 'resolve_conflict' | 'resubmit' | 'resume' | 'resubmit_after_withdraw';

export type WorkbenchSection = 'todo' | 'processing' | 'completed' | 'withdrawn';

export interface FeatureFlags {
  enableAutoResume: boolean;
  enableDuplicateBlocking: boolean;
  enableAuditLogOnWithdraw: boolean;
  enableTimeRangeExport: boolean;
  enableDeviceBatchExport: boolean;
  enableSnapshotRetention: boolean;
  enableAuxiliaryAsyncWrite: boolean;
  enableTimelineView: boolean;
}

export interface WorkbenchSectionMeta {
  key: WorkbenchSection;
  title: string;
  subtitle: string;
  emptyText: string;
  statuses: StatusKey[];
  badgePriority: number;
}

export interface StatusMeta {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
  iconBg: string;
  description: string;
  nextActions: ActionKey[];
  badgePriority: number;
  section: 'drafts' | 'pending' | 'synced';
}

export interface ActionMeta {
  label: string;
  shortLabel: string;
  description: string;
  confirmTitle: string;
  confirmMessage: string;
  successMessage: string;
}

export interface ExportField {
  key: string;
  label: string;
  csvOnly?: boolean;
  jsonPath?: string;
}

export interface BusinessTip {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  actions: { label: string; key: 'confirm' | 'cancel' | 'new_version' | 'overwrite' }[];
}

export const statusConfig: Record<StatusKey, StatusMeta> = {
  draft: {
    label: '本地草稿',
    shortLabel: '草稿',
    color: 'bg-warning-500',
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    dotColor: 'bg-warning-500',
    iconBg: 'bg-warning-100',
    description: '仅保存在本设备，刷新/关闭/换设备需从本地恢复',
    nextActions: ['save_draft', 'submit'],
    badgePriority: 1,
    section: 'drafts',
  },
  submitted: {
    label: '已提交待同步',
    shortLabel: '待同步',
    color: 'bg-accent-500',
    bgColor: 'bg-accent-50',
    textColor: 'text-accent-700',
    borderColor: 'border-accent-200',
    dotColor: 'bg-accent-500',
    iconBg: 'bg-accent-100',
    description: '已进入同步队列，待网络恢复后自动上传',
    nextActions: ['withdraw', 'sync'],
    badgePriority: 2,
    section: 'pending',
  },
  synced: {
    label: '已同步记录',
    shortLabel: '已同步',
    color: 'bg-success-500',
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
    dotColor: 'bg-success-500',
    iconBg: 'bg-success-100',
    description: '已上传服务器，可跨设备查看',
    nextActions: [],
    badgePriority: 4,
    section: 'synced',
  },
  conflict: {
    label: '冲突待处理',
    shortLabel: '冲突',
    color: 'bg-critical-500',
    bgColor: 'bg-critical-500/10',
    textColor: 'text-critical-600',
    borderColor: 'border-critical-500/30',
    dotColor: 'bg-critical-500',
    iconBg: 'bg-critical-500/20',
    description: '多端数据冲突，需人工选择版本',
    nextActions: ['resolve_conflict'],
    badgePriority: 3,
    section: 'pending',
  },
  withdrawn: {
    label: '已撤回待重提',
    shortLabel: '已撤回',
    color: 'bg-surface-400',
    bgColor: 'bg-surface-100',
    textColor: 'text-surface-600',
    borderColor: 'border-surface-200',
    dotColor: 'bg-surface-400',
    iconBg: 'bg-surface-200',
    description: '已从同步队列撤回，保留审计日志后可重新发起',
    nextActions: ['resubmit_after_withdraw', 'save_draft'],
    badgePriority: 5,
    section: 'drafts',
  },
  resumed: {
    label: '已恢复续办',
    shortLabel: '续办中',
    color: 'bg-info-500',
    bgColor: 'bg-info-50',
    textColor: 'text-info-700',
    borderColor: 'border-info-200',
    dotColor: 'bg-info-500',
    iconBg: 'bg-info-100',
    description: '上次会话现场已恢复，可继续编辑',
    nextActions: ['save_draft', 'submit'],
    badgePriority: 6,
    section: 'drafts',
  },
};

export const actionConfig: Record<ActionKey, ActionMeta> = {
  save_draft: {
    label: '保存草稿',
    shortLabel: '保存',
    description: '将当前巡检内容保存到本地',
    confirmTitle: '',
    confirmMessage: '',
    successMessage: '草稿已保存',
  },
  submit: {
    label: '提交巡检',
    shortLabel: '提交',
    description: '提交后将进入同步队列，无法再随意修改',
    confirmTitle: '确认提交？',
    confirmMessage: '提交后记录将进入同步队列。如需修改可撤回至草稿区。',
    successMessage: '已提交，等待同步',
  },
  withdraw: {
    label: '撤回至草稿',
    shortLabel: '撤回',
    description: '从同步队列撤回，返回草稿区可继续编辑，保留审计日志',
    confirmTitle: '确认撤回？',
    confirmMessage: '撤回后该记录将从同步队列移除，回到草稿区。操作将被记录到审计日志，重新编辑后需再次提交。',
    successMessage: '已撤回至草稿区，审计日志已留存',
  },
  sync: {
    label: '立即同步',
    shortLabel: '同步',
    description: '将待同步记录上传至服务器',
    confirmTitle: '',
    confirmMessage: '',
    successMessage: '同步完成',
  },
  resolve_conflict: {
    label: '处理冲突',
    shortLabel: '处理',
    description: '选择保留本地或远端版本',
    confirmTitle: '',
    confirmMessage: '',
    successMessage: '冲突已解决',
  },
  resubmit: {
    label: '重新提交',
    shortLabel: '再提交',
    description: '撤回修改后再次提交',
    confirmTitle: '重新提交？',
    confirmMessage: '该记录之前已提交过一次，再次提交将覆盖同步队列中的版本。',
    successMessage: '已重新提交',
  },
  resume: {
    label: '恢复续办',
    shortLabel: '续办',
    description: '恢复上次会话现场，继续未完成的编辑',
    confirmTitle: '恢复上次现场？',
    confirmMessage: '检测到上次会话有未完成的记录，是否恢复到上次编辑的现场？',
    successMessage: '已恢复至上次编辑现场',
  },
  resubmit_after_withdraw: {
    label: '撤回后重新发起',
    shortLabel: '重新发起',
    description: '撤回后已保留审计日志，可重新发起提交流程',
    confirmTitle: '重新发起提交流程？',
    confirmMessage: '撤回操作已记录审计日志，确认重新发起提交？',
    successMessage: '已重新发起提交，审计日志已留存',
  },
};

export const exportFields: ExportField[] = [
  { key: 'recordId', label: '记录ID', jsonPath: 'id' },
  { key: 'deviceCode', label: '设备编号', csvOnly: false },
  { key: 'deviceName', label: '设备名称', csvOnly: false },
  { key: 'deviceLocation', label: '设备位置', csvOnly: true },
  { key: 'deviceCategory', label: '设备分类', csvOnly: true },
  { key: 'date', label: '巡检日期' },
  { key: 'templateName', label: '巡检模板' },
  { key: 'templateVersion', label: '模板版本', csvOnly: true },
  { key: 'inspectorName', label: '巡检员' },
  { key: 'inspectorId', label: '巡检员ID', csvOnly: true },
  { key: 'statusLabel', label: '状态' },
  { key: 'anomalyLabel', label: '异常等级' },
  { key: 'values', label: '巡检内容(JSON)', csvOnly: true, jsonPath: 'values' },
  { key: 'photoCount', label: '照片数量' },
  { key: 'submissionCount', label: '提交次数', csvOnly: true },
  { key: 'withdrawCount', label: '撤回次数', csvOnly: true },
  { key: 'createdAt', label: '创建时间' },
  { key: 'updatedAt', label: '最后更新' },
  { key: 'submittedAt', label: '提交时间' },
  { key: 'firstSubmittedAt', label: '首次提交时间', csvOnly: true },
  { key: 'lastWithdrawnAt', label: '最后撤回时间', csvOnly: true },
  { key: 'syncedAt', label: '同步时间' },
  { key: 'originDeviceId', label: '来源设备ID', csvOnly: true },
  { key: 'hasConflict', label: '是否有冲突', csvOnly: true },
  { key: 'conflictResolution', label: '冲突处理结论', csvOnly: true },
  { key: 'lastStatusChange', label: '最近状态变更', csvOnly: true },
];

export const businessTips: Record<string, BusinessTip> = {
  duplicateSubmit: {
    title: '重复提交提醒',
    message: '该记录已在同步队列中，是否重新提交并覆盖现有版本？',
    severity: 'warning',
    actions: [
      { label: '覆盖并重新提交', key: 'overwrite' },
      { label: '取消', key: 'cancel' },
    ],
  },
  resubmitAfterWithdraw: {
    title: '撤回后再提交',
    message: '您之前撤回过该记录，本次提交将重新进入同步队列。',
    severity: 'info',
    actions: [
      { label: '确认提交', key: 'confirm' },
      { label: '取消', key: 'cancel' },
    ],
  },
  sameDayMultiRecord: {
    title: '同日同设备多记录',
    message: '该设备今日已有 {count} 条记录，是否创建新版本？',
    severity: 'warning',
    actions: [
      { label: '创建新版本', key: 'new_version' },
      { label: '覆盖最新草稿', key: 'overwrite' },
      { label: '取消', key: 'cancel' },
    ],
  },
};

export const sectionsConfig = {
  drafts: {
    key: 'drafts' as const,
    title: '本地草稿区',
    subtitle: '仅保存在本设备，换设备不可见',
    emptyText: '暂无本地草稿',
    iconLabel: '仅本地',
  },
  pending: {
    key: 'pending' as const,
    title: '待同步队列',
    subtitle: '已提交，等待网络同步',
    emptyText: '暂无待同步记录',
    iconLabel: '待同步',
  },
  synced: {
    key: 'synced' as const,
    title: '已同步记录',
    subtitle: '已上传服务器，跨设备可见',
    emptyText: '暂无已同步记录',
    iconLabel: '已同步',
  },
};

export const submissionFields = {
  submittedAt: '提交时间',
  snapshotExport: '导出快照',
  lastStatusChange: '最近状态变更',
  conflictResolution: '冲突处理结果',
  changeHistory: '状态变更历史',
  sourceDevice: '来源设备',
  operationTime: '操作时间',
  keySnapshot: '关键快照',
  statusTrajectory: '状态变更轨迹',
  auditTrail: '审计日志',
  receiptInfo: '提交凭据',
};

export const featureFlags: FeatureFlags = {
  enableAutoResume: true,
  enableDuplicateBlocking: true,
  enableAuditLogOnWithdraw: true,
  enableTimeRangeExport: true,
  enableDeviceBatchExport: true,
  enableSnapshotRetention: true,
  enableAuxiliaryAsyncWrite: true,
  enableTimelineView: true,
};

export const workbenchSections: Record<WorkbenchSection, WorkbenchSectionMeta> = {
  todo: {
    key: 'todo',
    title: '待办列表',
    subtitle: '需要处理的巡检任务',
    emptyText: '暂无待办任务',
    statuses: ['draft', 'resumed'],
    badgePriority: 1,
  },
  processing: {
    key: 'processing',
    title: '进行中',
    subtitle: '已提交待同步或处理冲突',
    emptyText: '暂无进行中的任务',
    statuses: ['submitted', 'conflict'],
    badgePriority: 2,
  },
  completed: {
    key: 'completed',
    title: '已完成',
    subtitle: '已成功同步的记录',
    emptyText: '暂无已完成记录',
    statuses: ['synced'],
    badgePriority: 3,
  },
  withdrawn: {
    key: 'withdrawn',
    title: '已撤回',
    subtitle: '已撤回待重新发起',
    emptyText: '暂无已撤回记录',
    statuses: ['withdrawn'],
    badgePriority: 4,
  },
};

export const validationMessages = {
  requiredMissing: '存在必填项未填写，请先补全后再操作',
  versionMismatch: '模板版本已更新，请刷新后重新填写',
  statusGateFailed: '当前状态不允许执行该操作',
  duplicateSubmit: '该设备今日已有相同记录正在同步队列中，请先处理',
  conflictDetected: '检测到数据冲突，请先处理后再操作',
  auxiliaryWriteSkipped: '附属信息写入失败，但主流程已完成',
};

export const appConfig = {
  productName: '离线巡检工具',
  productShortName: '巡检工具',
  productDescription: '面向现场巡检人员的离线巡检记录与同步工具',
  productFullDescription: '支持离线巡检、本地缓存、一键同步、数据导出的移动端巡检工具',
  version: '2.0.0',

  pages: {
    home: {
      title: '设备巡检',
      subtitle: '离线巡检 · 数据安全',
    },
    statusDesk: {
      title: '巡检状态台',
      emptyText: '暂无记录',
    },
    templates: {
      title: '模板配置',
      emptyText: '暂无巡检模板',
    },
    devices: {
      title: '设备管理',
      emptyText: '暂无设备数据',
    },
    inspections: {
      title: '今日巡检',
      emptyText: '今日暂无巡检记录',
    },
    inspectionForm: {
      title: '巡检记录',
      draftSavedText: '草稿已保存',
      submittedText: '提交成功',
    },
    sync: {
      title: '同步中心',
      emptyText: '暂无待同步记录',
    },
    export: {
      title: '导出记录',
      emptyText: '暂无记录可导出',
    },
    logs: {
      title: '操作日志',
      emptyText: '暂无操作日志',
    },
    recordDetail: {
      title: '记录详情',
    },
    submissionReceipt: {
      title: '提交凭证',
    },
    submissionWorkbench: {
      title: '提交工作台',
      subtitle: '草稿整理 · 送审上报 · 撤销回滚 · 恢复续办 · 结果导出',
      emptyText: '暂无巡检记录',
    },
  },

  empty: {
    defaultText: '暂无数据',
    inspections: '暂无巡检记录',
    templates: '暂无巡检模板',
    devices: '暂无设备数据',
    logs: '暂无操作日志',
    sync: '暂无待同步记录',
    export: '暂无记录可导出',
    statusDesk: '暂无记录',
    drafts: '暂无本地草稿',
    pending: '暂无待同步记录',
    synced: '暂无已同步记录',
    submissionHistory: '暂无变更历史',
  },

  status: {
    draft: '草稿',
    submitted: '待同步',
    synced: '已同步',
    conflict: '冲突',
    pending: '待巡检',
    draftFull: '本地草稿',
    submittedFull: '已提交待同步',
    syncedFull: '已同步记录',
    conflictFull: '冲突待处理',
  },

  offline: {
    enabledText: '离线模式 - 数据将在恢复网络后同步',
    disabledText: '在线模式 - 数据实时同步',
    noticeTitle: '离线巡检提示',
    noticeContent: '在弱网环境下可正常填写巡检记录，所有数据将保存在本地。恢复网络后进入同步中心一键上传。',
  },

  export: {
    jsonLabel: '导出 JSON',
    jsonDesc: '完整数据格式，含所有字段和变更历史',
    csvLabel: '导出 CSV',
    csvDesc: 'Excel 兼容格式，便于汇总分析',
    fileNamePrefix: '巡检记录_',
    fields: exportFields,
  },

  logs: {
    maxCount: 500,
    notice: '所有操作均会被记录，包括模板配置、巡检提交、同步操作等。日志保存在本地，最多保留 500 条。',
  },

  recovery: {
    hasDrafts: '您有 {count} 条草稿待处理',
    hasPendingSync: '您有 {count} 条记录待同步',
    lastVisit: '上次访问：{time}',
    autoSaveNotice: '内容已自动保存，刷新或关闭页面后可继续编辑',
    recoveredFromDevice: '已从本设备恢复 {count} 条本地数据',
    restoredSession: '会话已恢复，{draftCount} 条草稿 · {pendingCount} 条待同步',
  },

  sections: sectionsConfig,
  statusMeta: statusConfig,
  actionMeta: actionConfig,
  businessTips,
  submission: submissionFields,
  workbench: workbenchSections,
  features: featureFlags,
  validation: validationMessages,
};

export type AppConfig = typeof appConfig;
