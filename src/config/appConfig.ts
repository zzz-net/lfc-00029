export const appConfig = {
  productName: '离线巡检工具',
  productShortName: '巡检工具',
  productDescription: '面向现场巡检人员的离线巡检记录与同步工具',
  productFullDescription: '支持离线巡检、本地缓存、一键同步、数据导出的移动端巡检工具',
  version: '1.0.0',

  pages: {
    home: {
      title: '设备巡检',
      subtitle: '离线巡检 · 数据安全',
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
  },

  empty: {
    defaultText: '暂无数据',
    inspections: '暂无巡检记录',
    templates: '暂无巡检模板',
    devices: '暂无设备数据',
    logs: '暂无操作日志',
    sync: '暂无待同步记录',
    export: '暂无记录可导出',
  },

  status: {
    draft: '草稿',
    submitted: '待同步',
    synced: '已同步',
    conflict: '冲突',
    pending: '待巡检',
  },

  offline: {
    enabledText: '离线模式 - 数据将在恢复网络后同步',
    disabledText: '在线模式 - 数据实时同步',
    noticeTitle: '离线巡检提示',
    noticeContent: '在弱网环境下可正常填写巡检记录，所有数据将保存在本地。恢复网络后进入同步中心一键上传。',
  },

  export: {
    jsonLabel: '导出 JSON',
    jsonDesc: '完整数据格式',
    csvLabel: '导出 CSV',
    csvDesc: 'Excel 兼容格式',
    fileNamePrefix: '巡检记录_',
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
  },
};

export type AppConfig = typeof appConfig;
