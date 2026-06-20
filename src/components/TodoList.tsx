import { useMemo } from 'react';
import { FileText, Send, CheckCircle, RotateCcw, AlertTriangle, RefreshCcw } from 'lucide-react';
import type { InspectionRecord, RecordStatus } from '@/types';
import { useStore } from '@/store/useStore';
import { statusConfig, workbenchSections, type WorkbenchSection } from '@/config/appConfig';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';

interface Props {
  section: WorkbenchSection;
  selectedId: string | null;
  onSelect: (record: InspectionRecord) => void;
}

const sectionIconMap: Record<WorkbenchSection, React.ElementType> = {
  todo: FileText,
  processing: Send,
  completed: CheckCircle,
  withdrawn: RotateCcw,
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TodoList({ section, selectedId, onSelect }: Props) {
  const { inspections, devices, templates, getRecordMeta } = useStore();

  const sectionCfg = workbenchSections[section];
  const SectionIcon = sectionIconMap[section];

  const records = useMemo(() => {
    const targetStatuses = sectionCfg.statuses as RecordStatus[];
    return inspections
      .filter(r => targetStatuses.includes(r.status))
      .sort((a, b) => {
        const aMeta = getRecordMeta(a.id);
        const bMeta = getRecordMeta(b.id);
        if (aMeta?.hasConflict && !bMeta?.hasConflict) return -1;
        if (!aMeta?.hasConflict && bMeta?.hasConflict) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [inspections, sectionCfg.statuses, getRecordMeta]);

  const badgeCount = records.length;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
            <SectionIcon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary-800">{sectionCfg.title}</h3>
            <p className="text-[10px] text-primary-400">{sectionCfg.subtitle}</p>
          </div>
        </div>
        {badgeCount > 0 && (
          <span className="min-w-[22px] h-[22px] px-1.5 bg-primary-100 text-primary-700 rounded-full text-[11px] font-semibold flex items-center justify-center">
            {badgeCount}
          </span>
        )}
      </div>

      {records.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-surface-50 flex items-center justify-center mx-auto mb-3 text-primary-300">
            <SectionIcon size={22} />
          </div>
          <p className="text-sm text-primary-400">{sectionCfg.emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 max-h-[340px] overflow-y-auto">
          {records.map(record => {
            const device = devices.find(d => d.id === record.deviceId);
            const template = templates.find(t => t.id === record.templateId);
            const meta = getRecordMeta(record.id);
            const statusCfg = statusConfig[record.status as keyof typeof statusConfig];
            const isSelected = selectedId === record.id;
            const hasConflict = meta?.hasConflict;

            return (
              <button
                key={record.id}
                onClick={() => onSelect(record)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isSelected ? 'bg-primary-50' : 'hover:bg-surface-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 h-10 rounded-full flex-shrink-0 mt-0.5 ${
                    hasConflict ? 'bg-critical-500' : statusCfg?.color || 'bg-surface-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary-800 truncate">
                          {device?.name || '未知设备'}
                          <span className="text-primary-400 font-normal ml-1">· {device?.code || ''}</span>
                        </p>
                        <p className="text-[11px] text-primary-500 mt-0.5 truncate">
                          {template?.name || '未知模板'} · {record.date}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg?.bgColor || 'bg-surface-100'} ${statusCfg?.textColor || 'text-primary-600'}`}>
                          {statusCfg?.shortLabel || record.status}
                        </span>
                        {hasConflict && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-critical-50 text-critical-600">
                            <AlertTriangle size={10} />
                            冲突
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getAnomalyLevelColor(record.anomalyLevel)}`}>
                        {getAnomalyLevelLabel(record.anomalyLevel)}
                      </span>
                      <span className="text-[10px] text-primary-400 flex items-center gap-0.5">
                        <RefreshCcw size={10} />
                        {formatTime(record.updatedAt)}
                      </span>
                      {(record.submissionCount || 0) > 0 && (
                        <span className="text-[10px] text-primary-400">
                          提{record.submissionCount}次
                        </span>
                      )}
                      {(record.withdrawCount || 0) > 0 && (
                        <span className="text-[10px] text-primary-400">
                          撤{record.withdrawCount}次
                        </span>
                      )}
                      {record.photos.length > 0 && (
                        <span className="text-[10px] text-primary-400">
                          📷{record.photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
