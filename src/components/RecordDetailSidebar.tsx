import { useMemo, useState } from 'react';
import { X, Clock, User, Cpu, FileCheck, AlertCircle, Download, History, ShieldCheck, Camera, Send, RotateCcw, RefreshCcw } from 'lucide-react';
import type { InspectionRecord, SubmissionReceipt, AuditLogEntry } from '@/types';
import { useStore } from '@/store/useStore';
import { statusConfig, appConfig, submissionFields } from '@/config/appConfig';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';
import Timeline from './Timeline';

interface Props {
  record: InspectionRecord | null;
  onClose: () => void;
  onSubmit?: (recordId: string) => void;
  onWithdraw?: (recordId: string) => void;
  onResume?: (recordId: string) => void;
  onResubmit?: (recordId: string) => void;
  onEdit?: (recordId: string) => void;
}

function formatTs(ts: string): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function InfoRow({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2 ${className}`}>
      <span className="text-xs text-primary-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-primary-800 text-right break-all">{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-surface-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-surface-50 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-primary-800">
          <Icon size={16} className="text-primary-500" />
          {title}
        </span>
        <span className={`text-primary-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

export default function RecordDetailSidebar({ record, onClose, onSubmit, onWithdraw, onResume, onResubmit, onEdit }: Props) {
  const { devices, templates, getSubmissionReceipts, getAuditLogs, getTimelineEvents, getLatestSnapshot, getRecordMeta } = useStore();

  const device = useMemo(() => record ? devices.find(d => d.id === record.deviceId) : undefined, [record, devices]);
  const template = useMemo(() => record ? templates.find(t => t.id === record.templateId) : undefined, [record, templates]);
  const receipts = useMemo(() => record ? getSubmissionReceipts(record.id) : [], [record, getSubmissionReceipts]);
  const auditLogs = useMemo(() => record ? getAuditLogs(record.id) : [], [record, getAuditLogs]);
  const timeline = useMemo(() => record ? getTimelineEvents(record.id) : [], [record, getTimelineEvents]);
  const latestSnapshot = useMemo(() => record ? getLatestSnapshot(record.id) : undefined, [record, getLatestSnapshot]);
  const meta = useMemo(() => record ? getRecordMeta(record.id) : undefined, [record, getRecordMeta]);

  if (!record) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
        <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <p className="text-primary-400 text-sm">选择一条记录查看详情</p>
        </div>
      </div>
    );
  }

  const statusCfg = statusConfig[record.status as keyof typeof statusConfig];
  const latestReceipt: SubmissionReceipt | undefined = receipts[0];

  const handleExportSnapshot = () => {
    if (!latestSnapshot) return;
    const json = JSON.stringify(latestSnapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot_${record.id}_${new Date(latestSnapshot.snapshotAt).getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl flex flex-col animate-[slideIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
          <div>
            <h2 className="text-base font-bold text-primary-800">记录详情</h2>
            <p className="text-[11px] text-primary-400 mt-0.5 truncate max-w-[200px]">{record.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 text-primary-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`p-4 ${statusCfg?.bgColor || 'bg-surface-50'} border-b ${statusCfg?.borderColor || 'border-surface-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusCfg?.bgColor || 'bg-surface-100'} ${statusCfg?.textColor || 'text-primary-600'} border ${statusCfg?.borderColor || 'border-surface-200'}`}>
                {statusCfg?.label || record.status}
              </span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${getAnomalyLevelColor(record.anomalyLevel)}`}>
                {getAnomalyLevelLabel(record.anomalyLevel)}
              </span>
            </div>
            <p className="text-sm font-medium text-primary-800">{device?.name || '未知设备'} · {device?.code || ''}</p>
            <p className="text-xs text-primary-500 mt-1">{template?.name || '未知模板'} v{record.templateVersion} · {record.date}</p>
          </div>

          <div className="px-4 py-2">
            <Section title="基础信息" icon={FileCheck}>
              <InfoRow label="记录ID" value={<span className="font-mono text-[11px]">{record.id}</span>} />
              <InfoRow label="设备名称" value={device?.name || '-'} />
              <InfoRow label="设备编号" value={device?.code || '-'} />
              <InfoRow label="设备位置" value={device?.location || '-'} />
              <InfoRow label="巡检日期" value={record.date} />
              <InfoRow label="巡检模板" value={`${template?.name || '-'} v${record.templateVersion}`} />
              <InfoRow label="巡检员" value={`${record.inspectorName} (${record.inspectorId})`} />
              <InfoRow label="照片数" value={`${record.photos.length} 张`} />
              <InfoRow label="提交次数" value={`${record.submissionCount || 0} 次`} />
              <InfoRow label="撤回次数" value={`${record.withdrawCount || 0} 次`} />
            </Section>

            {latestReceipt && (
              <Section title={submissionFields.receiptInfo} icon={ShieldCheck}>
                <InfoRow label="凭据编号" value={<span className="font-mono text-[11px] text-primary-700">{latestReceipt.receiptNo}</span>} />
                <InfoRow label={submissionFields.operationTime} value={formatTs(latestReceipt.submittedAt)} />
                <InfoRow label={submissionFields.sourceDevice} value={
                  <span title={latestReceipt.sourceDeviceId}>
                    {latestReceipt.sourceDeviceInfo}
                  </span>
                } />
                <InfoRow label="操作人" value={`${latestReceipt.operatorName} (${latestReceipt.operatorId})`} />
                <InfoRow label="快照ID" value={<span className="font-mono text-[11px]">{latestReceipt.snapshotId}</span>} />
                <InfoRow label="数据哈希" value={<span className="font-mono text-[11px]">{latestReceipt.recordValuesHash}</span>} />
                <InfoRow label="凭据状态" value={
                  latestReceipt.status === 'acknowledged' ? (
                    <span className="text-success-600">已确认</span>
                  ) : latestReceipt.status === 'failed' ? (
                    <span className="text-critical-600">失败</span>
                  ) : (
                    <span className="text-accent-600">待确认</span>
                  )
                } />
                {latestSnapshot && (
                  <div className="pt-2">
                    <button
                      onClick={handleExportSnapshot}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors"
                    >
                      <Download size={14} />
                      导出{appConfig.submission.snapshotExport}
                    </button>
                  </div>
                )}
              </Section>
            )}

            {auditLogs.length > 0 && (
              <Section title={submissionFields.auditTrail} icon={ShieldCheck} defaultOpen={false}>
                {auditLogs.map((log: AuditLogEntry) => (
                  <div key={log.id} className="py-2 border-b border-surface-100 last:border-b-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary-700">{log.detail.slice(0, 30)}...</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${log.result === 'success' ? 'bg-success-50 text-success-700' : 'bg-critical-50 text-critical-700'}`}>
                        {log.result}
                      </span>
                    </div>
                    <p className="text-[11px] text-primary-400">{formatTs(log.timestamp)} · {log.operatorName}</p>
                  </div>
                ))}
              </Section>
            )}

            <Section title={submissionFields.statusTrajectory} icon={History}>
              <Timeline events={timeline} />
            </Section>

            <Section title="时间戳" icon={Clock} defaultOpen={false}>
              <InfoRow label="创建时间" value={formatTs(record.createdAt)} />
              <InfoRow label="最后更新" value={formatTs(record.updatedAt)} />
              <InfoRow label="首次提交" value={formatTs(record.firstSubmittedAt || '')} />
              <InfoRow label="最近提交" value={formatTs(record.submittedAt || '')} />
              <InfoRow label="最近撤回" value={formatTs(record.lastWithdrawnAt || '')} />
              <InfoRow label="同步时间" value={formatTs(record.syncedAt || '')} />
              {meta?.lastConflictResolvedAt && (
                <InfoRow label="冲突解决时间" value={formatTs(meta.lastConflictResolvedAt)} />
              )}
            </Section>
          </div>
        </div>

        <div className="border-t border-surface-200 p-3 space-y-2 bg-surface-50 safe-bottom">
          {(record.status === 'draft' || record.status === 'resumed') && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onEdit?.(record.id)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-surface-100 text-primary-700 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
              >
                <FileCheck size={16} />
                编辑
              </button>
              <button
                onClick={() => onSubmit?.(record.id)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
              >
                <Send size={16} />
                提交
              </button>
            </div>
          )}
          {record.status === 'submitted' && (
            <button
              onClick={() => onWithdraw?.(record.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-warning-500 text-white rounded-xl text-sm font-medium hover:bg-warning-600 transition-colors"
            >
              <RotateCcw size={16} />
              撤销回滚
            </button>
          )}
          {record.status === 'withdrawn' && (
            <button
              onClick={() => onResubmit?.(record.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Send size={16} />
              重新发起
            </button>
          )}
          {(record.status === 'draft' || record.status === 'withdrawn') && (
            <button
              onClick={() => onResume?.(record.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-info-50 text-info-700 rounded-xl text-sm font-medium hover:bg-info-100 transition-colors"
            >
              <RefreshCcw size={16} />
              恢复续办
            </button>
          )}
          {record.status === 'synced' && (
            <div className="flex items-center justify-center gap-2 py-2 text-success-600 text-sm">
              <AlertCircle size={16} />
              已完成同步
            </div>
          )}
          {record.status === 'conflict' && (
            <div className="flex items-center justify-center gap-2 py-2 text-critical-600 text-sm">
              <AlertCircle size={16} />
              请前往同步中心处理冲突
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
