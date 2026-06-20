import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileJson, FileSpreadsheet, Calendar, Filter, Download, Upload, AlertCircle, CheckCircle, Send, RotateCcw, RefreshCcw, ClipboardCheck, Info, ChevronDown, Plus, AlertTriangle, ListChecks } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import TodoList from '@/components/TodoList';
import RecordDetailSidebar from '@/components/RecordDetailSidebar';
import CreateSubmissionModal from '@/components/CreateSubmissionModal';
import RevertTraceModule from '@/components/RevertTraceModule';
import { useStore } from '@/store/useStore';
import { appConfig, workbenchSections, statusConfig, featureFlags, validationMessages, staleDraftConfig, importConfig, operationLogConfig } from '@/config/appConfig';
import { getMissingRequiredFields } from '@/lib/submissionWorkbench';
import { getTodayString } from '@/utils/id';
import type { InspectionRecord, ExportFilter, RecordStatus, StaleDraftInfo } from '@/types';

export default function SubmissionWorkbench() {
  const navigate = useNavigate();
  const {
    inspections,
    devices,
    templates,
    recoveredSession,
    clearRecoveredSession,
    offlineMode,
    saveInspectionDraft,
    submitInspection,
    withdrawInspection,
    resumeInspection,
    resubmitAfterWithdraw,
    validateOperation,
    exportRecords,
    markRecordExported,
    currentDeviceId,
    getStaleDrafts,
    migrateStaleDraft,
    importRecords,
    logs,
  } = useStore();

  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterDeviceId, setFilterDeviceId] = useState('');
  const [filterStatus, setFilterStatus] = useState<RecordStatus | ''>('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dismissedStaleDrafts, setDismissedStaleDrafts] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const staleDrafts = useMemo(() => {
    const all = getStaleDrafts();
    return all.filter(d => !dismissedStaleDrafts.has(d.recordId));
  }, [getStaleDrafts, dismissedStaleDrafts, inspections, templates]);

  const recentLogs = useMemo(() => {
    return logs
      .filter(l => l.action.includes('提交') || l.action.includes('撤回') || l.action.includes('迁移') || l.action.includes('导入'))
      .slice(0, operationLogConfig.maxDisplayCount);
  }, [logs]);

  const exportFilter: ExportFilter = useMemo(() => ({
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
    deviceIds: filterDeviceId ? [filterDeviceId] : undefined,
    statuses: filterStatus ? [filterStatus] : undefined,
  }), [filterStartDate, filterEndDate, filterDeviceId, filterStatus]);

  const filteredCount = useMemo(() => {
    return inspections.filter(r => {
      if (filterStartDate && r.date < filterStartDate) return false;
      if (filterEndDate && r.date > filterEndDate) return false;
      if (filterDeviceId && r.deviceId !== filterDeviceId) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    }).length;
  }, [inspections, exportFilter, filterStatus, filterDeviceId, filterStartDate, filterEndDate]);

  const runValidation = (recordId: string, action: 'submit' | 'withdraw' | 'resubmit' | 'save') => {
    const record = inspections.find(r => r.id === recordId);
    if (!record) {
      showToast('error', '记录不存在');
      return false;
    }
    const template = templates.find(t => t.id === record.templateId);
    const actionMap = { submit: 'submit' as const, withdraw: 'withdraw' as const, resubmit: 'resubmit_after_withdraw' as const, save: 'save_draft' as const };
    const validation = validateOperation(recordId, record, actionMap[action]);
    if (!validation.valid) {
      const msgs = validation.errors.map(e => e.message);
      setShowValidationErrors(msgs);
      showToast('error', msgs[0] || validationMessages.requiredMissing);
      setTimeout(() => setShowValidationErrors([]), 4000);
      return false;
    }
    if (template) {
      const missing = getMissingRequiredFields(record.values, template.fields);
      if (missing.length > 0 && (action === 'submit' || action === 'resubmit')) {
        const msg = `${validationMessages.requiredMissing}：${missing.join('、')}`;
        setShowValidationErrors([msg]);
        showToast('warning', msg);
        setTimeout(() => setShowValidationErrors([]), 4000);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = useCallback(async (recordId: string) => {
    if (!runValidation(recordId, 'submit')) return;
    setProcessingId(recordId);
    try {
      const record = inspections.find(r => r.id === recordId);
      if (!record) return;
      await submitInspection(record);
      showToast('success', featureFlags.enableSnapshotRetention ? '提交成功，凭据已留存' : '提交成功');
      setSelectedRecord(prev => prev ? { ...prev, status: offlineMode ? 'submitted' : 'synced' } : null);
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  }, [inspections, submitInspection, offlineMode, showToast]);

  const handleWithdraw = useCallback(async (recordId: string) => {
    if (!runValidation(recordId, 'withdraw')) return;
    setProcessingId(recordId);
    try {
      const updated = await withdrawInspection(recordId);
      showToast('success', featureFlags.enableAuditLogOnWithdraw ? '撤回成功，审计日志已留存' : '撤回成功');
      setSelectedRecord(updated);
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  }, [withdrawInspection, showToast]);

  const handleResume = useCallback(async (recordId: string) => {
    setProcessingId(recordId);
    try {
      const updated = await resumeInspection(recordId);
      showToast('success', '已恢复至上次编辑现场');
      setSelectedRecord(updated);
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  }, [resumeInspection, showToast]);

  const handleResubmit = useCallback(async (recordId: string) => {
    if (!runValidation(recordId, 'resubmit')) return;
    setProcessingId(recordId);
    try {
      const record = inspections.find(r => r.id === recordId);
      if (!record) return;
      const updated = await resubmitAfterWithdraw(record);
      showToast('success', '已重新发起提交');
      setSelectedRecord(updated);
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  }, [inspections, resubmitAfterWithdraw, showToast]);

  const handleEdit = useCallback((recordId: string) => {
    const record = inspections.find(r => r.id === recordId);
    if (record) {
      navigate(`/inspections/${record.deviceId}?recordId=${recordId}`);
    }
  }, [inspections, navigate]);

  const handleMigrateStale = useCallback(async (recordId: string) => {
    try {
      const updated = await migrateStaleDraft(recordId);
      showToast('success', staleDraftConfig.migrateSuccessMessage);
      if (selectedRecord?.id === recordId) {
        setSelectedRecord(updated);
      }
    } catch (e) {
      showToast('error', (e as Error).message);
    }
  }, [migrateStaleDraft, showToast, selectedRecord]);

  const handleDismissStale = useCallback((recordId: string) => {
    setDismissedStaleDrafts(prev => new Set([...prev, recordId]));
  }, []);

  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    if (filteredCount === 0) {
      showToast('warning', '没有可导出的记录');
      return;
    }
    setExporting(true);
    try {
      const data = await exportRecords(exportFilter, format);
      for (const row of data) {
        await markRecordExported(row.id);
      }
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `工作台记录_${getTodayString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = ['记录ID', '设备编号', '设备名称', '设备位置', '巡检日期', '模板名称', '模板版本', '巡检员', '状态', '异常等级', '照片数', '提交次数', '撤回次数', '创建时间', '更新时间', '提交时间', '同步时间', '来源设备', '冲突处理', '凭据编号'];
        const rows = data.map(r => [
          r.id, r.deviceCode, r.deviceName, r.deviceLocation, r.date, r.templateName,
          String(r.templateVersion), r.inspectorName, r.status, r.anomalyLevel,
          String(r.photoCount), String(r.submissionCount), String(r.withdrawCount),
          new Date(r.createdAt).toLocaleString(), new Date(r.updatedAt).toLocaleString(),
          r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '',
          r.syncedAt ? new Date(r.syncedAt).toLocaleString() : '',
          r.sourceDevice, r.conflictResolution, r.receiptNo,
        ]);
        const csv = [headers, ...rows]
          .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `工作台记录_${getTodayString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast('success', `已导出 ${data.length} 条记录`);
    } catch (e) {
      showToast('error', '导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [exportFilter, filteredCount, exportRecords, markRecordExported, showToast]);

  const handleImport = useCallback(async (format: 'json' | 'csv') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'json' ? '.json' : '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > importConfig.maxFileSize) {
        showToast('error', importConfig.oversizeMessage);
        return;
      }
      setImporting(true);
      try {
        const text = await file.text();
        let data: any[];
        if (format === 'json') {
          data = JSON.parse(text);
          if (!Array.isArray(data)) {
            showToast('error', importConfig.invalidFormatMessage);
            return;
          }
        } else {
          data = [text];
        }
        const result = await importRecords(data, format);
        if (result.successCount > 0 && result.failCount === 0 && result.skippedCount === 0) {
          showToast('success', importConfig.successMessage.replace('{count}', String(result.successCount)));
        } else if (result.successCount > 0) {
          showToast('warning', importConfig.partialSuccessMessage
            .replace('{success}', String(result.successCount))
            .replace('{skipped}', String(result.skippedCount))
            .replace('{fail}', String(result.failCount)));
        } else {
          showToast('error', importConfig.failMessage.replace('{reason}', result.errors[0]?.reason || '未知错误'));
        }
      } catch (e) {
        showToast('error', importConfig.invalidFormatMessage);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }, [importRecords, showToast]);

  const handleCreated = useCallback((recordId: string) => {
    setShowCreateModal(false);
    const record = useStore.getState().inspections.find(r => r.id === recordId);
    if (record) {
      setSelectedRecord(record);
    }
    showToast('success', '草稿已创建');
  }, [showToast]);

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar title={appConfig.pages.submissionWorkbench.title} />

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-primary-600 text-white rounded-2xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            新建提交单
          </button>
        </div>

        {recoveredSession && featureFlags.enableAutoResume && (
          <div className="bg-info-50 border border-info-200 rounded-xl p-3 flex items-start gap-2">
            <RefreshCcw size={16} className="text-info-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="text-info-800 font-medium">检测到上次未完成会话</p>
              <p className="text-info-600 text-xs mt-0.5">
                已恢复 {inspections.filter(r => r.status === 'draft' || r.status === 'resumed').length} 条草稿，可继续编辑
              </p>
            </div>
            <button
              onClick={clearRecoveredSession}
              className="text-xs text-info-600 hover:text-info-700 px-2 py-1 rounded-lg hover:bg-info-100"
            >
              知道了
            </button>
          </div>
        )}

        {staleDrafts.length > 0 && (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={16} className="text-warning-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning-800">{staleDraftConfig.bannerTitle}</p>
                <p className="text-xs text-warning-600 mt-0.5">{staleDraftConfig.bannerMessage}</p>
              </div>
            </div>
            <div className="space-y-2 mt-2">
              {staleDrafts.map(stale => {
                const record = inspections.find(r => r.id === stale.recordId);
                const device = record ? devices.find(d => d.id === record.deviceId) : null;
                return (
                  <div key={stale.recordId} className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-warning-200">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-primary-800 truncate">
                        {device?.name || stale.recordId}
                      </p>
                      <p className="text-[10px] text-warning-600 mt-0.5">
                        {staleDraftConfig.versionMismatchDetail
                          .replace('{old}', String(stale.recordTemplateVersion))
                          .replace('{latest}', String(stale.latestTemplateVersion))}
                      </p>
                    </div>
                    <div className="flex gap-1.5 ml-2 flex-shrink-0">
                      <button
                        onClick={() => handleMigrateStale(stale.recordId)}
                        className="px-2.5 py-1.5 bg-primary-600 text-white rounded-lg text-[11px] font-medium hover:bg-primary-700 transition-colors"
                      >
                        {staleDraftConfig.actionLabel}
                      </button>
                      <button
                        onClick={() => handleDismissStale(stale.recordId)}
                        className="px-2.5 py-1.5 bg-surface-100 text-primary-600 rounded-lg text-[11px] font-medium hover:bg-surface-200 transition-colors"
                      >
                        {staleDraftConfig.dismissLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Filter size={16} className="text-primary-500" />
            筛选与导入导出
            <span className="text-xs font-normal text-primary-400 ml-auto">
              共 {filteredCount} 条
            </span>
          </h2>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="relative">
              <button
                onClick={() => { setShowDatePicker(!showDatePicker); setShowDevicePicker(false); setShowStatusPicker(false); }}
                className="w-full flex items-center justify-between px-3 py-2 bg-surface-50 rounded-xl text-xs text-primary-700 hover:bg-surface-100 transition-colors"
              >
                <span className="flex items-center gap-1 truncate">
                  <Calendar size={12} className="text-primary-400 flex-shrink-0" />
                  {filterStartDate || filterEndDate ? `${filterStartDate || '起'} ~ ${filterEndDate || '止'}` : '时间段'}
                </span>
                <ChevronDown size={12} className={`text-primary-400 flex-shrink-0 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
              </button>
              {showDatePicker && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-20 p-2 space-y-2">
                  <div>
                    <label className="text-[10px] text-primary-500 block mb-1">开始日期</label>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] text-primary-500 block mb-1">结束日期</label>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded-lg" />
                  </div>
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setShowDatePicker(false); }} className="flex-1 py-1.5 text-xs bg-surface-100 text-primary-600 rounded-lg hover:bg-surface-200">清除</button>
                    <button onClick={() => setShowDatePicker(false)} className="flex-1 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">确定</button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowDevicePicker(!showDevicePicker); setShowDatePicker(false); setShowStatusPicker(false); }}
                className="w-full flex items-center justify-between px-3 py-2 bg-surface-50 rounded-xl text-xs text-primary-700 hover:bg-surface-100 transition-colors"
              >
                <span className="truncate">{filterDeviceId ? devices.find(d => d.id === filterDeviceId)?.code || '设备' : '按设备'}</span>
                <ChevronDown size={12} className={`text-primary-400 flex-shrink-0 transition-transform ${showDevicePicker ? 'rotate-180' : ''}`} />
              </button>
              {showDevicePicker && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-20 max-h-48 overflow-y-auto">
                  <button onClick={() => { setFilterDeviceId(''); setShowDevicePicker(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-50 ${!filterDeviceId ? 'bg-primary-50 text-primary-600 font-medium' : 'text-primary-700'}`}>全部设备</button>
                  {devices.map(d => (
                    <button key={d.id} onClick={() => { setFilterDeviceId(d.id); setShowDevicePicker(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-50 ${filterDeviceId === d.id ? 'bg-primary-50 text-primary-600 font-medium' : 'text-primary-700'}`}>
                      {d.code} {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <div className="relative">
              <button
                onClick={() => { setShowStatusPicker(!showStatusPicker); setShowDatePicker(false); setShowDevicePicker(false); }}
                className="w-full flex items-center justify-between px-3 py-2 bg-surface-50 rounded-xl text-xs text-primary-700 hover:bg-surface-100 transition-colors"
              >
                <span>{filterStatus ? statusConfig[filterStatus as keyof typeof statusConfig]?.label : '按状态'}</span>
                <ChevronDown size={12} className={`text-primary-400 flex-shrink-0 transition-transform ${showStatusPicker ? 'rotate-180' : ''}`} />
              </button>
              {showStatusPicker && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-20">
                  <button onClick={() => { setFilterStatus(''); setShowStatusPicker(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-50 ${!filterStatus ? 'bg-primary-50 text-primary-600 font-medium' : 'text-primary-700'}`}>全部状态</button>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <button key={key} onClick={() => { setFilterStatus(key as RecordStatus); setShowStatusPicker(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-50 ${filterStatus === key ? 'bg-primary-50 text-primary-600 font-medium' : 'text-primary-700'}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => handleExport('json')}
              disabled={exporting || filteredCount === 0}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-medium hover:bg-primary-100 disabled:opacity-50 transition-colors"
            >
              <FileJson size={14} />
              {importConfig.jsonLabel.replace('导入', '导出')}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting || filteredCount === 0}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-success-50 text-success-700 rounded-xl text-xs font-medium hover:bg-success-100 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet size={14} />
              {importConfig.csvLabel.replace('导入', '导出')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleImport('json')}
              disabled={importing}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-accent-50 text-accent-700 rounded-xl text-xs font-medium hover:bg-accent-100 disabled:opacity-50 transition-colors"
            >
              <Upload size={14} />
              {importConfig.jsonLabel}
            </button>
            <button
              onClick={() => handleImport('csv')}
              disabled={importing}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-warning-50 text-warning-700 rounded-xl text-xs font-medium hover:bg-warning-100 disabled:opacity-50 transition-colors"
            >
              <Upload size={14} />
              {importConfig.csvLabel}
            </button>
          </div>
        </div>

        {showValidationErrors.length > 0 && (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-warning-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {showValidationErrors.map((msg, i) => (
                  <p key={i} className="text-xs text-warning-800">{msg}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <RevertTraceModule />

        <TodoList
          section="todo"
          selectedId={selectedRecord?.id || null}
          onSelect={setSelectedRecord}
        />

        <TodoList
          section="processing"
          selectedId={selectedRecord?.id || null}
          onSelect={setSelectedRecord}
        />

        <TodoList
          section="withdrawn"
          selectedId={selectedRecord?.id || null}
          onSelect={setSelectedRecord}
        />

        <TodoList
          section="completed"
          selectedId={selectedRecord?.id || null}
          onSelect={setSelectedRecord}
        />

        {recentLogs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
              <ListChecks size={16} className="text-primary-500" />
              {operationLogConfig.sectionTitle}
            </h3>
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-surface-50 last:border-b-0">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    log.result === 'success' ? 'bg-success-500' :
                    log.result === 'conflict' ? 'bg-warning-500' :
                    'bg-critical-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary-700 truncate">{log.action} - {log.detail}</p>
                    <p className="text-[10px] text-primary-400 mt-0.5">{log.userName} · {new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Info size={16} className="text-primary-500" />
            工作台功能说明
          </h3>
          <ul className="space-y-2 text-xs text-primary-600">
            <li className="flex items-start gap-2">
              <ClipboardCheck size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
              <span>每次保存、上报、撤销前自动校验：必填补齐、版本核对、状态门禁、冲突判断</span>
            </li>
            <li className="flex items-start gap-2">
              <Send size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
              <span>上报成功后自动留存凭据，可回看操作时间、来源设备、关键快照</span>
            </li>
            <li className="flex items-start gap-2">
              <RotateCcw size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
              <span>撤销操作保留审计日志，可重新发起提交</span>
            </li>
            <li className="flex items-start gap-2">
              <Download size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
              <span>支持按时间段、设备、状态批量导出和导入 JSON/CSV</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
              <span>模板版本更新后旧草稿可一键迁移，新字段自动补默认值</span>
            </li>
          </ul>
        </div>
      </div>

      <RecordDetailSidebar
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onSubmit={handleSubmit}
        onWithdraw={handleWithdraw}
        onResume={handleResume}
        onResubmit={handleResubmit}
        onEdit={handleEdit}
      />

      <CreateSubmissionModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-[fadeIn_0.2s_ease-out]">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-success-600 text-white' :
            toast.type === 'error' ? 'bg-critical-600 text-white' :
            'bg-warning-500 text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
