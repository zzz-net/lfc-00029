import { useState, useMemo, useCallback, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Eye,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  History,
  Info,
  Table2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { revertModuleConfig, csvColumnMappings, statusConfig } from '@/config/appConfig';
import { getTodayString } from '@/utils/id';
import type {
  RevertPreviewItem,
  RevertDraftState,
  RevertImportResult,
  InspectionRecord,
} from '@/types';

type TabKey = 'import' | 'history' | 'mapping';

export default function RevertTraceModule() {
  const {
    inspections,
    devices,
    templates,
    currentDeviceId,
    latestRevertDraft,
    clearRevertDraft,
    isCurrentRevertDraftStale,
    saveRevertDraft,
    getColumnMappings,
    exportCsvTemplate,
    parseRevertCsv,
    previewRevertImport,
    revertImportWithHistory,
    rollbackRevertImport,
    getRevertHistory,
    validateSameDeviceDayDuplicates,
    addLogEntry,
    currentUserId,
    currentUserName,
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabKey>('import');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);
  const [isReverting, setIsReverting] = useState(false);

  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileFormat, setFileFormat] = useState<'csv' | 'json'>('csv');
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [unknownColumns, setUnknownColumns] = useState<string[]>([]);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<any[]>([]);
  const [previewItems, setPreviewItems] = useState<RevertPreviewItem[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const draftIsStale = useMemo(() => {
    return latestRevertDraft ? isCurrentRevertDraftStale(latestRevertDraft) : false;
  }, [latestRevertDraft, isCurrentRevertDraftStale]);

  const history = useMemo(() => getRevertHistory(), [getRevertHistory]);

  const stats = useMemo(() => {
    const insertCount = previewItems.filter(p => p.action === 'insert').length;
    const skipCount = previewItems.filter(p => p.action === 'skip').length;
    const conflictCount = previewItems.filter(p => p.action === 'conflict').length;
    return { insertCount, skipCount, conflictCount, total: previewItems.length };
  }, [previewItems]);

  const handleDownloadTemplate = useCallback(() => {
    const csv = exportCsvTemplate();
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `回灌导入模板_${getTodayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', '模板已下载，请按格式填写后回灌');
  }, [exportCsvTemplate, showToast]);

  const resetImportState = useCallback(() => {
    setFileName('');
    setFileContent('');
    setParsedRecords([]);
    setUnknownColumns([]);
    setMissingRequired([]);
    setParseErrors([]);
    setPreviewItems([]);
    setConflicts([]);
    setBlockedCount(0);
    setShowPreview(false);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetImportState();
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const format: 'csv' | 'json' = isCsv ? 'csv' : 'json';
    setFileFormat(format);
    setFileName(file.name);

    try {
      const text = await file.text();
      setFileContent(text);

      if (format === 'csv') {
        const { records, unknownColumns: unknown, missingRequired: missing } = parseRevertCsv(text);
        setParsedRecords(records);
        setUnknownColumns(unknown);
        setMissingRequired(missing);

        if (missing.length > 0) {
          showToast('warning', `缺少必填列：${missing.join('、')}`);
        }
        if (unknown.length > 0) {
          showToast('info', `检测到 ${unknown.length} 个未识别的列，已忽略`);
        }
        if (records.length === 0) {
          showToast('error', '未解析到有效数据行');
          return;
        }
      } else {
        try {
          const data = JSON.parse(text);
          const records = Array.isArray(data) ? data : [data];
          setParsedRecords(records);
          if (records.length === 0) {
            showToast('error', 'JSON 文件中没有有效数据');
            return;
          }
        } catch {
          showToast('error', 'JSON 格式解析失败');
          return;
        }
      }

      try {
        await saveRevertDraft({
          fileName: file.name,
          fileSize: file.size,
          fileContent: text,
          format,
          parsedData: parsedRecords,
        });
      } catch (e) {
        console.warn('Failed to save revert draft:', e);
      }

      showToast('success', `已读取 ${format.toUpperCase()} 文件，共 ${format === 'csv' ? parsedRecords.length : (JSON.parse(text).length || 0)} 条记录，可预览后导入`);
    } catch (e) {
      showToast('error', '文件读取失败：' + (e as Error).message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [parseRevertCsv, resetImportState, saveRevertDraft, showToast, parsedRecords]);

  const handleRestoreDraft = useCallback(async (draft: RevertDraftState) => {
    setFileName(draft.fileName);
    setFileContent(draft.fileContent);
    setFileFormat(draft.format);
    if (draft.format === 'csv') {
      const { records, unknownColumns: unknown, missingRequired: missing } = parseRevertCsv(draft.fileContent);
      setParsedRecords(records);
      setUnknownColumns(unknown);
      setMissingRequired(missing);
    } else {
      try {
        const data = JSON.parse(draft.fileContent);
        setParsedRecords(Array.isArray(data) ? data : [data]);
      } catch {
        setParsedRecords([]);
      }
    }
    showToast('info', '已恢复上次回灌草稿');
  }, [parseRevertCsv, showToast]);

  const handlePreview = useCallback(async () => {
    if (parsedRecords.length === 0) {
      showToast('warning', '请先选择文件');
      return;
    }
    try {
      const preview = await previewRevertImport(parsedRecords, fileFormat);
      setPreviewItems(preview.previewItems);
      setConflicts(preview.conflicts);
      setParseErrors(preview.errors);
      setBlockedCount(preview.blockedCount);

      if (preview.blockedCount > 0) {
        showToast('warning', `检测到 ${preview.blockedCount} 条与今日已提交记录重复的数据，已拦截`);
      }
      setShowPreview(true);
    } catch (e) {
      showToast('error', '预览失败：' + (e as Error).message);
    }
  }, [parsedRecords, fileFormat, previewRevertImport, showToast]);

  const handleConfirmImport = useCallback(async () => {
    setShowConfirmDialog(false);
    try {
      const result = await revertImportWithHistory(parsedRecords, fileFormat);
      setProcessingBatchId(result.batchId);
      await clearRevertDraft();

      const msg = result.successCount > 0
        ? `回灌完成：成功 ${result.successCount} 条，跳过 ${result.skippedCount} 条，失败 ${result.failCount} 条`
        : '回灌未成功导入任何记录';
      showToast(result.successCount > 0 ? 'success' : 'warning', msg);

      resetImportState();
      setActiveTab('history');
    } catch (e) {
      showToast('error', '导入失败：' + (e as Error).message);
    } finally {
      setProcessingBatchId(null);
    }
  }, [parsedRecords, fileFormat, revertImportWithHistory, clearRevertDraft, resetImportState, showToast]);

  const handleRollback = useCallback(async (batchId: string) => {
    setShowRevertConfirm(null);
    setIsReverting(true);
    try {
      await rollbackRevertImport(batchId);
      showToast('success', '已撤销本次回灌导入，数据已恢复');
    } catch (e) {
      showToast('error', '撤销失败：' + (e as Error).message);
    } finally {
      setIsReverting(false);
    }
  }, [rollbackRevertImport, showToast]);

  const actionLabel = (action: RevertPreviewItem['action']) => {
    switch (action) {
      case 'insert': return { text: '新增', color: 'bg-success-100 text-success-700 border-success-200' };
      case 'update': return { text: '更新', color: 'bg-info-100 text-info-700 border-info-200' };
      case 'skip': return { text: '跳过', color: 'bg-surface-100 text-surface-600 border-surface-200' };
      case 'conflict': return { text: '冲突', color: 'bg-warning-100 text-warning-700 border-warning-200' };
    }
  };

  const getStatusLabel = (status: string) => {
    const cfg = statusConfig[status as keyof typeof statusConfig];
    return cfg?.shortLabel || status;
  };

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-surface-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-primary-800 flex items-center gap-2">
            <Sparkles size={16} className="text-accent-500" />
            {revertModuleConfig.sectionTitle}
          </h2>
        </div>
        <p className="text-[11px] text-primary-500">
          {revertModuleConfig.description}
        </p>
      </div>

      <div className="flex border-b border-surface-100 px-2">
        {(['import', 'history', 'mapping'] as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === key
                ? 'text-primary-700'
                : 'text-primary-400 hover:text-primary-600'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              {key === 'import' && <Upload size={13} />}
              {key === 'history' && <History size={13} />}
              {key === 'mapping' && <Table2 size={13} />}
              <span>
                {key === 'import' ? '回灌导入' : key === 'history' ? '操作历史' : '列名映射'}
              </span>
              {key === 'history' && history.length > 0 && (
                <span className="bg-accent-100 text-accent-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {history.length}
                </span>
              )}
            </div>
            {activeTab === key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'import' && (
          <div className="space-y-3">
            {latestRevertDraft && !fileName && (
              <div className={`rounded-xl p-3 border flex items-start gap-2 ${
                draftIsStale
                  ? 'bg-warning-50 border-warning-200'
                  : 'bg-info-50 border-info-200'
              }`}>
                {draftIsStale ? (
                  <AlertTriangle size={16} className="text-warning-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <RefreshCw size={16} className="text-info-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${draftIsStale ? 'text-warning-800' : 'text-info-800'}`}>
                    {draftIsStale ? revertModuleConfig.draftRecoveryTitle : revertModuleConfig.draftRecoveryTitle}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${draftIsStale ? 'text-warning-600' : 'text-info-600'}`}>
                    {draftIsStale
                      ? `${revertModuleConfig.staleDraftMessage}（文件：${latestRevertDraft.fileName}）`
                      : `${revertModuleConfig.draftRecoveryMessage}（文件：${latestRevertDraft.fileName}）`
                    }
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRestoreDraft(latestRevertDraft)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                        draftIsStale
                          ? 'bg-warning-100 text-warning-700 hover:bg-warning-200'
                          : 'bg-info-600 text-white hover:bg-info-700'
                      }`}
                    >
                      {draftIsStale ? revertModuleConfig.staleDraftDismissLabel : '恢复草稿'}
                    </button>
                    <button
                      onClick={() => {
                        clearRevertDraft();
                        showToast('info', '已丢弃草稿');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-surface-100 text-primary-600 hover:bg-surface-200"
                    >
                      {draftIsStale ? revertModuleConfig.staleDraftActionLabel : '丢弃草稿'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-medium hover:bg-primary-100 transition-colors"
              >
                <Download size={14} />
                {revertModuleConfig.exportTemplateButton}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-accent-50 text-accent-700 rounded-xl text-xs font-medium hover:bg-accent-100 transition-colors"
              >
                <Upload size={14} />
                {revertModuleConfig.importButton}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {fileName && (
              <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet size={14} className="text-success-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-primary-700 truncate">{fileName}</span>
                  </div>
                  <button
                    onClick={() => { resetImportState(); clearRevertDraft(); }}
                    className="text-primary-400 hover:text-primary-600 flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] bg-info-100 text-info-700 px-2 py-0.5 rounded-full">
                    {fileFormat.toUpperCase()} 格式
                  </span>
                  <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                    {parsedRecords.length} 条记录
                  </span>
                  {unknownColumns.length > 0 && (
                    <span className="text-[10px] bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full">
                      {unknownColumns.length} 个未知列
                    </span>
                  )}
                  {missingRequired.length > 0 && (
                    <span className="text-[10px] bg-critical-100 text-critical-700 px-2 py-0.5 rounded-full">
                      缺少 {missingRequired.length} 个必填列
                    </span>
                  )}
                </div>
                <button
                  onClick={handlePreview}
                  disabled={parsedRecords.length === 0 || missingRequired.length > 0}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Eye size={13} />
                  {revertModuleConfig.previewButton}
                </button>
              </div>
            )}

            {showPreview && previewItems.length > 0 && (
              <div className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
                <div className="px-3 py-2 bg-surface-100/50 border-b border-surface-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-primary-700">
                    {revertModuleConfig.resultPreviewTitle}
                  </span>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] bg-success-100 text-success-700 px-2 py-0.5 rounded-full">
                      新增 {stats.insertCount}
                    </span>
                    <span className="text-[10px] bg-surface-200 text-surface-700 px-2 py-0.5 rounded-full">
                      跳过 {stats.skipCount}
                    </span>
                    {stats.conflictCount > 0 && (
                      <span className="text-[10px] bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full">
                        冲突 {stats.conflictCount}
                      </span>
                    )}
                    {blockedCount > 0 && (
                      <span className="text-[10px] bg-critical-100 text-critical-700 px-2 py-0.5 rounded-full">
                        拦截 {blockedCount}
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {previewItems.slice(0, 20).map((item, idx) => {
                    const label = actionLabel(item.action);
                    return (
                      <div
                        key={idx}
                        className="px-3 py-2 border-b border-surface-100 last:border-b-0 flex items-center gap-2 hover:bg-surface-100/50"
                      >
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${label.color}`}>
                          {label.text}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-primary-700 truncate">
                            {item.deviceCode || '未知设备'} · {item.deviceName}
                          </p>
                          <p className="text-[10px] text-primary-400 truncate">
                            {item.date} · {getStatusLabel(item.status)}
                            {item.detail && ` · ${item.detail}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {previewItems.length > 20 && (
                    <div className="px-3 py-2 text-center text-[10px] text-primary-400">
                      还有 {previewItems.length - 20} 条未展示
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 border-t border-surface-100">
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={stats.insertCount === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-success-600 text-white rounded-lg text-xs font-medium hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle size={13} />
                    {revertModuleConfig.confirmButton}（{stats.insertCount} 条）
                  </button>
                </div>
              </div>
            )}

            {blockedCount > 0 && (
              <div className="bg-critical-50 border border-critical-200 rounded-xl p-3 flex items-start gap-2">
                <ShieldAlert size={16} className="text-critical-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-critical-800">
                    {revertModuleConfig.duplicateBlockTitle}
                  </p>
                  <p className="text-[11px] text-critical-600 mt-0.5">
                    {revertModuleConfig.duplicateBlockMessage.replace('{count}', String(blockedCount))}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <History size={32} className="text-primary-200 mx-auto mb-2" />
                <p className="text-xs text-primary-400">{revertModuleConfig.emptyHistoryText}</p>
              </div>
            ) : (
              history.map((h) => (
                <div
                  key={h.batchId}
                  className={`rounded-xl border p-3 ${
                    h.reverted
                      ? 'bg-surface-50 border-surface-200 opacity-70'
                      : 'bg-white border-surface-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-primary-700">
                          {h.batchId.slice(-12)}
                        </span>
                        {h.reverted ? (
                          <span className="text-[10px] bg-surface-200 text-surface-600 px-1.5 py-0.5 rounded-full">
                            已撤销
                          </span>
                        ) : (
                          <span className="text-[10px] bg-success-100 text-success-700 px-1.5 py-0.5 rounded-full">
                            已生效
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-primary-400">
                        <Clock size={10} />
                        {new Date(h.createdAt).toLocaleString()}
                        {h.revertedAt && (
                          <span className="ml-2">
                            · 撤销于 {new Date(h.revertedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {!h.reverted && revertModuleConfig.enableRevert && (
                      <button
                        onClick={() => setShowRevertConfirm(h.batchId)}
                        disabled={isReverting && processingBatchId === h.batchId}
                        className="px-2 py-1 bg-warning-50 text-warning-700 rounded-lg text-[11px] font-medium hover:bg-warning-100 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                      >
                        <RotateCcw size={11} />
                        {revertModuleConfig.revertButton}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-success-100 text-success-700 px-2 py-0.5 rounded-full">
                      成功 {h.successCount}
                    </span>
                    <span className="text-[10px] bg-surface-200 text-surface-700 px-2 py-0.5 rounded-full">
                      跳过 {h.skippedCount}
                    </span>
                    {h.failCount > 0 && (
                      <span className="text-[10px] bg-critical-100 text-critical-700 px-2 py-0.5 rounded-full">
                        失败 {h.failCount}
                      </span>
                    )}
                  </div>
                  {h.errors && h.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-surface-100">
                      <p className="text-[10px] text-primary-500 mb-1">错误详情：</p>
                      {h.errors.slice(0, 3).map((e, i) => (
                        <p key={i} className="text-[10px] text-critical-600">
                          行 {e.row}：{e.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'mapping' && (
          <div className="space-y-2">
            <div className="bg-info-50 border border-info-200 rounded-xl p-3 flex items-start gap-2">
              <Info size={16} className="text-info-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-info-800">
                  {revertModuleConfig.columnMappingTitle}
                </p>
                <p className="text-[11px] text-info-600 mt-0.5">
                  导出的 CSV 使用中文列名，导入时系统会自动映射到内部字段，无需手动修改。
                </p>
              </div>
            </div>
            <div className="border border-surface-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-primary-600 w-[35%]">CSV 列名（中文）</th>
                    <th className="px-3 py-2 text-left font-medium text-primary-600 w-[35%]">内部字段</th>
                    <th className="px-3 py-2 text-left font-medium text-primary-600">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {getColumnMappings().map((col, idx) => (
                    <tr key={idx} className="border-t border-surface-100">
                      <td className="px-3 py-2">
                        <span className="text-primary-800 font-medium">{col.displayName}</span>
                        {col.required && (
                          <span className="text-critical-500 ml-1">*</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <code className="text-[10px] bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">
                          {col.fieldName}
                        </code>
                      </td>
                      <td className="px-3 py-2 text-primary-500">
                        {col.required ? '必填。' : ''}{col.description || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-base font-bold text-primary-800 mb-2">确认导入？</h3>
            <p className="text-xs text-primary-600 mb-1">
              将导入 <span className="font-semibold text-success-600">{stats.insertCount}</span> 条记录，
              跳过 <span className="font-semibold text-primary-500">{stats.skipCount + blockedCount}</span> 条。
            </p>
            <p className="text-[11px] text-primary-400 mb-4">
              导入完成后可在「操作历史」中撤销本次导入。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2.5 bg-surface-100 text-primary-700 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!!processingBatchId}
                className="flex-1 py-2.5 bg-success-600 text-white rounded-xl text-sm font-medium hover:bg-success-700 disabled:opacity-50 transition-colors"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevertConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={20} className="text-warning-500" />
              <h3 className="text-base font-bold text-primary-800">
                {revertModuleConfig.revertConfirmTitle}
              </h3>
            </div>
            <p className="text-xs text-primary-600 mb-4">
              {revertModuleConfig.revertConfirmMessage}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRevertConfirm(null)}
                className="flex-1 py-2.5 bg-surface-100 text-primary-700 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleRollback(showRevertConfirm)}
                disabled={isReverting}
                className="flex-1 py-2.5 bg-warning-600 text-white rounded-xl text-sm font-medium hover:bg-warning-700 disabled:opacity-50 transition-colors"
              >
                {isReverting ? '撤销中...' : '确认撤销'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] animate-[fadeIn_0.2s_ease-out]">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-success-600 text-white' :
            toast.type === 'error' ? 'bg-critical-600 text-white' :
            toast.type === 'warning' ? 'bg-warning-500 text-white' :
            'bg-info-600 text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> :
             toast.type === 'error' ? <AlertCircle size={16} /> :
             toast.type === 'warning' ? <AlertTriangle size={16} /> :
             <Info size={16} />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
