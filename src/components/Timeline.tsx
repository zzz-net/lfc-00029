import { Clock, FileText, Send, RotateCcw, CheckCircle, AlertTriangle, RefreshCw, Zap, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { TimelineEvent, RecordStatus, StatusChangeAction } from '@/types';
import { statusConfig } from '@/config/appConfig';

const actionIconMap: Partial<Record<StatusChangeAction, LucideIcon>> = {
  create_draft: FileText,
  save_draft: FileText,
  submit: Send,
  withdraw: RotateCcw,
  resubmit: Send,
  resubmit_after_withdraw: Send,
  sync_success: CheckCircle,
  sync_fail: AlertTriangle,
  conflict_detected: AlertTriangle,
  conflict_resolved: ShieldCheck,
  edit_after_sync: FileText,
  resume: RefreshCw,
  withdraw_audit_logged: Zap,
};

function formatTs(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusPill({ status }: { status: RecordStatus | null }) {
  if (!status) return <span className="text-[10px] text-primary-400">-</span>;
  const cfg = statusConfig[status as keyof typeof statusConfig];
  if (!cfg) return <span className="text-[10px] text-primary-400">{status}</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bgColor} ${cfg.textColor}`}>
      {cfg.shortLabel}
    </span>
  );
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-primary-400">
        暂无状态变更记录
      </div>
    );
  }

  return (
    <div className="relative pl-5">
      {events.map((evt, idx) => {
        const Icon = actionIconMap[evt.action as StatusChangeAction] || Clock;
        const isLast = idx === events.length - 1;
        return (
          <div key={evt.id} className="relative pb-5 last:pb-0">
            {!isLast && (
              <div className="absolute left-[-14px] top-5 bottom-0 w-px bg-surface-200" />
            )}
            <div className="absolute left-[-18px] top-0 w-9 h-9 rounded-full border-2 border-white bg-primary-100 flex items-center justify-center text-primary-600 shadow-sm">
              <Icon size={16} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-primary-400">{formatTs(evt.timestamp)}</span>
                {evt.sourceDeviceId && (
                  <span className="text-[10px] text-primary-400 truncate max-w-[100px]" title={evt.sourceDeviceId}>
                    {evt.sourceDeviceId.slice(0, 8)}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-primary-800">{evt.actionLabel}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusPill status={evt.fromStatus} />
                <span className="text-xs text-primary-400">→</span>
                <StatusPill status={evt.toStatus} />
              </div>
              {evt.note && (
                <p className="text-xs text-primary-500 leading-relaxed">{evt.note}</p>
              )}
              <p className="text-[11px] text-primary-400">操作人：{evt.operatorName}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
