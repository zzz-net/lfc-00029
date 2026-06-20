import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  RotateCcw,
  Send,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { appConfig, statusConfig, actionConfig, submissionFields } from '@/config/appConfig';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';
import TopBar from '@/components/TopBar';
import type { StatusChangeAction, RecordStatus } from '@/types';

const statusActionLabels: Record<StatusChangeAction, string> = {
  create_draft: '保存草稿',
  save_draft: '保存草稿',
  submit: '提交',
  withdraw: '撤回',
  resubmit: '重新提交',
  sync_success: '同步成功',
  sync_fail: '同步失败',
  conflict_detected: '检测到冲突',
  conflict_resolved: '冲突已解决',
  edit_after_sync: '同步后编辑',
  resume: '恢复续办',
  resubmit_after_withdraw: '撤回后重新发起',
  withdraw_audit_logged: '撤回并记录审计',
};

const statusIconMap: Record<RecordStatus, React.ReactNode> = {
  draft: <FileText size={32} />,
  submitted: <Send size={32} />,
  synced: <CheckCircle size={32} />,
  conflict: <AlertTriangle size={32} />,
  withdrawn: <RotateCcw size={32} />,
  resumed: <RefreshCw size={32} />,
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function StatusBadge({ status }: { status: RecordStatus | null }) {
  if (!status) {
    return <span className="text-xs text-primary-400">-</span>;
  }
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bgColor} ${cfg.textColor}`}>
      {cfg.shortLabel}
    </span>
  );
}

export default function SubmissionReceipt() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();

  const {
    inspections,
    devices,
    templates,
    getStatusHistory,
    getLatestSnapshot,
    getRecordMeta,
    withdrawInspection,
    currentUserId,
    currentUserName,
  } = useStore();

  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const record = useMemo(
    () => inspections.find((r) => r.id === recordId),
    [inspections, recordId]
  );

  const device = useMemo(
    () => (record ? devices.find((d) => d.id === record.deviceId) : undefined),
    [record, devices]
  );

  const template = useMemo(
    () => (record ? templates.find((t) => t.id === record.templateId) : undefined),
    [record, templates]
  );

  const statusHistory = useMemo(
    () => (recordId ? getStatusHistory(recordId) : []),
    [recordId, getStatusHistory]
  );

  const latestSnapshot = useMemo(
    () => (recordId ? getLatestSnapshot(recordId) : undefined),
    [recordId, getLatestSnapshot]
  );

  const recordMeta = useMemo(
    () => (recordId ? getRecordMeta(recordId) : undefined),
    [recordId, getRecordMeta]
  );

  const latestStatusChange = statusHistory[0] || null;

  const handleWithdraw = async () => {
    if (!recordId) return;
    setWithdrawing(true);
    try {
      await withdrawInspection(recordId);
    } catch (e) {
      console.error('Withdraw failed:', e);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleExportSnapshot = async () => {
    if (!latestSnapshot) return;
    setExporting(true);
    try {
      const json = JSON.stringify(latestSnapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot_${latestSnapshot.recordId}_${new Date(latestSnapshot.snapshotAt).getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-surface-100">
        <TopBar title={appConfig.pages.submissionReceipt.title} />
        <div className="flex flex-col items-center justify-center py-32 px-4">
          <AlertCircle size={48} className="text-primary-300 mb-4" />
          <p className="text-lg font-medium text-primary-600 mb-2">记录不存在</p>
          <p className="text-sm text-primary-400 mb-6">该巡检记录可能已被删除</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const currentStatusConfig = statusConfig[record.status];

  const conflictResolutionLabel = recordMeta?.lastConflictResolution
    ? recordMeta.lastConflictResolution === 'keep-local'
      ? '保留本地版本'
      : recordMeta.lastConflictResolution === 'keep-remote'
        ? '保留远端版本'
        : '合并版本'
    : null;

  return (
    <div className="min-h-screen bg-surface-100 pb-28">
      <div className="sticky top-0 z-40 bg-white border-b border-surface-200">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-primary-700 hover:bg-surface-50 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-bold text-primary-800">
            {appConfig.pages.submissionReceipt.title}
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className={`rounded-2xl p-5 ${currentStatusConfig.bgColor} ${currentStatusConfig.borderColor} border`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${currentStatusConfig.iconBg} flex items-center justify-center ${currentStatusConfig.textColor}`}>
              {statusIconMap[record.status]}
            </div>
            <div className="flex-1">
              <p className={`text-xl font-bold ${currentStatusConfig.textColor}`}>
                {currentStatusConfig.label}
              </p>
              <p className="text-sm text-primary-600 mt-0.5">
                {currentStatusConfig.description}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4 space-y-3">
          <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Clock size={16} className="text-primary-500" />
            提交信息
          </h2>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">{submissionFields.submittedAt}</span>
              <span className="text-sm font-medium text-primary-800">
                {record.submittedAt || record.firstSubmittedAt
                  ? formatTimestamp(record.submittedAt || record.firstSubmittedAt!)
                  : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">{submissionFields.lastStatusChange}</span>
              <span className="text-sm font-medium text-primary-800">
                {latestStatusChange
                  ? formatTimestamp(latestStatusChange.timestamp)
                  : '-'}
              </span>
            </div>

            {recordMeta?.hasConflict && conflictResolutionLabel && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-500">{submissionFields.conflictResolution}</span>
                <span className="text-sm font-medium text-primary-800">
                  {conflictResolutionLabel}
                  {recordMeta.lastConflictResolvedAt && (
                    <span className="text-xs text-primary-400 ml-1">
                      ({formatTimestamp(recordMeta.lastConflictResolvedAt)})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4 space-y-3">
          <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <FileText size={16} className="text-primary-500" />
            记录信息
          </h2>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">设备名称</span>
              <span className="text-sm font-medium text-primary-800">{device?.name || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">设备编号</span>
              <span className="text-sm font-medium text-primary-800">{device?.code || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">巡检日期</span>
              <span className="text-sm font-medium text-primary-800">{record.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">巡检模板</span>
              <span className="text-sm font-medium text-primary-800">
                {template?.name || '-'}{template ? ` v${template.version}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">巡检员</span>
              <span className="text-sm font-medium text-primary-800">{record.inspectorName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">异常等级</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getAnomalyLevelColor(record.anomalyLevel)}`}>
                {getAnomalyLevelLabel(record.anomalyLevel)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-500">照片数量</span>
              <span className="text-sm font-medium text-primary-800">{record.photos.length} 张</span>
            </div>
          </div>
        </div>

        {latestSnapshot && (
          <button
            onClick={handleExportSnapshot}
            disabled={exporting}
            className="w-full bg-white rounded-2xl shadow-card p-4 flex items-center justify-between hover:bg-surface-50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600">
                <Download size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-800">{submissionFields.snapshotExport}</p>
                <p className="text-[10px] text-primary-400">
                  快照时间：{formatTimestamp(latestSnapshot.snapshotAt)}
                </p>
              </div>
            </div>
            <Zap size={18} className="text-primary-400" />
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-card p-4">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <RotateCcw size={16} className="text-primary-500" />
              {submissionFields.changeHistory}
            </h2>
            {historyExpanded ? (
              <ChevronUp size={18} className="text-primary-400" />
            ) : (
              <ChevronDown size={18} className="text-primary-400" />
            )}
          </button>

          {historyExpanded && (
            <>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-primary-400 py-4 text-center">{appConfig.empty.submissionHistory}</p>
              ) : (
                <div className="relative pl-6">
                  {statusHistory.map((event, idx) => {
                    const isLast = idx === statusHistory.length - 1;
                    return (
                      <div key={event.id} className="relative pb-5">
                        {!isLast && (
                          <div className="absolute left-[-18px] top-6 bottom-0 w-px bg-surface-200" />
                        )}
                        <div className="absolute left-[-22px] top-1 w-[18px] h-[18px] rounded-full border-2 border-white bg-primary-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-400">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-primary-800">
                            {statusActionLabels[event.action] || event.action}
                          </p>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={event.fromStatus} />
                            <span className="text-xs text-primary-400">→</span>
                            <StatusBadge status={event.toStatus} />
                          </div>
                          {event.note && (
                            <p className="text-xs text-primary-500">{event.note}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-40">
        <div className="p-4 safe-bottom">
          <div className="max-w-md mx-auto flex gap-3">
            {record.status === 'draft' && (
              <>
                <button
                  onClick={() => navigate(`/inspections/${record.deviceId}`)}
                  className="flex-1 py-3 bg-surface-100 text-primary-700 rounded-xl font-medium hover:bg-surface-200 transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={18} />
                  编辑
                </button>
                <button
                  onClick={() => navigate(`/inspections/${record.deviceId}`)}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Send size={18} />
                  提交
                </button>
              </>
            )}

            {record.status === 'submitted' && (
              <>
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="flex-1 py-3 bg-surface-100 text-primary-700 rounded-xl font-medium hover:bg-surface-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  {withdrawing ? '撤回中...' : '撤回至草稿'}
                </button>
                <button
                  onClick={() => navigate('/sync')}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Eye size={18} />
                  查看同步中心
                </button>
              </>
            )}

            {record.status === 'conflict' && (
              <button
                onClick={() => navigate('/sync')}
                className="flex-1 py-3 bg-critical-500 text-white rounded-xl font-medium hover:bg-critical-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <AlertTriangle size={18} />
                处理冲突
              </button>
            )}

            {record.status === 'synced' && (
              <button
                onClick={() => navigate(-1)}
                className="flex-1 py-3 bg-surface-100 text-primary-700 rounded-xl font-medium hover:bg-surface-200 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={18} />
                返回
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
