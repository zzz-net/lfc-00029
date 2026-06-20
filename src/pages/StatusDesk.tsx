import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileEdit,
  Send,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  ArrowLeft,
  Eye,
  RotateCcw,
  Search,
  Filter,
} from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import Empty from '@/components/Empty';
import { useStore } from '@/store/useStore';
import { appConfig, statusConfig, sectionsConfig } from '@/config/appConfig';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';
import type { RecordStatus, SectionKey } from '@/types';

const sectionIcons = {
  drafts: FileEdit,
  pending: Send,
  synced: CheckCircle,
} as const;

const sectionStatuses: Record<SectionKey, RecordStatus[]> = {
  drafts: ['draft'],
  pending: ['submitted', 'conflict'],
  synced: ['synced'],
};

function formatTime(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function StatusDesk() {
  const navigate = useNavigate();
  const {
    inspections,
    devices,
    templates,
    conflicts,
    withdrawInspection,
    sessionRecovered,
    lastVisitAt,
    offlineMode,
  } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | ''>('');
  const [showFilter, setShowFilter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const sectionRecords = useMemo(() => {
    const result: Record<SectionKey, typeof inspections> = {
      drafts: [],
      pending: [],
      synced: [],
    };
    for (const record of inspections) {
      for (const key of Object.keys(sectionStatuses) as SectionKey[]) {
        if (sectionStatuses[key].includes(record.status)) {
          result[key].push(record);
          break;
        }
      }
    }
    return result;
  }, [inspections]);

  const filteredSectionRecords = useMemo(() => {
    const result: Record<SectionKey, typeof inspections> = {
      drafts: [],
      pending: [],
      synced: [],
    };
    for (const key of Object.keys(sectionStatuses) as SectionKey[]) {
      result[key] = sectionRecords[key].filter((record) => {
        const device = devices.find((d) => d.id === record.deviceId);
        const matchSearch =
          !search ||
          device?.name.toLowerCase().includes(search.toLowerCase()) ||
          device?.code.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || record.status === statusFilter;
        return matchSearch && matchStatus;
      });
    }
    return result;
  }, [sectionRecords, devices, search, statusFilter]);

  const counts = useMemo(() => ({
    drafts: sectionRecords.drafts.length,
    pending: sectionRecords.pending.length,
    synced: sectionRecords.synced.length,
  }), [sectionRecords]);

  const showRecoveryTip = sessionRecovered && (counts.drafts > 0 || counts.pending > 0);

  const handleWithdraw = async (recordId: string) => {
    if (!confirm('确认撤回？\n撤回后该记录将从同步队列移除，回到草稿区。重新编辑后需再次提交。')) return;
    setWithdrawing(recordId);
    try {
      await withdrawInspection(recordId);
      setToast('已撤回至草稿区');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('撤回失败');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setWithdrawing(null);
    }
  };

  const renderCard = (record: typeof inspections[0]) => {
    const device = devices.find((d) => d.id === record.deviceId);
    const template = templates.find((t) => t.id === record.templateId);
    const sCfg = statusConfig[record.status];

    return (
      <div
        key={record.id}
        className="bg-white rounded-2xl shadow-card p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-primary-800 truncate">
                {device?.name || '未知设备'}
              </h3>
              <span
                title={sCfg.description}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium cursor-help ${sCfg.bgColor} ${sCfg.textColor} border ${sCfg.borderColor}`}
              >
                {sCfg.shortLabel}
              </span>
            </div>
            <p className="text-xs text-primary-500 mt-0.5 font-mono">
              {device?.code || record.deviceId}
            </p>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getAnomalyLevelColor(record.anomalyLevel)}`}
          >
            {getAnomalyLevelLabel(record.anomalyLevel)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-primary-500">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {record.date}
          </span>
          <span>·</span>
          <span>{template?.name || '未知模板'}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-primary-400">
          <span>更新 {formatTime(record.updatedAt)}</span>
          {record.submittedAt && (
            <>
              <span>·</span>
              <span>提交 {formatTime(record.submittedAt)}</span>
            </>
          )}
          {record.syncedAt && (
            <>
              <span>·</span>
              <span>同步 {formatTime(record.syncedAt)}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-surface-50">
          {record.status === 'draft' && (
            <>
              <button
                onClick={() => navigate(`/inspections/${record.deviceId}`)}
                className="flex-1 py-2 text-sm font-medium rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors flex items-center justify-center gap-1"
              >
                <FileEdit size={14} />
                编辑
              </button>
              <button
                onClick={() => navigate(`/inspections/${record.deviceId}`)}
                className="flex-1 py-2 text-sm font-medium rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
              >
                <Send size={14} />
                提交
              </button>
            </>
          )}
          {record.status === 'submitted' && (
            <>
              <button
                onClick={() => handleWithdraw(record.id)}
                disabled={withdrawing === record.id}
                className="flex-1 py-2 text-sm font-medium rounded-xl bg-surface-100 text-primary-600 hover:bg-surface-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                {withdrawing === record.id ? '撤回中...' : '撤回'}
              </button>
              <button
                onClick={() => navigate(`/record/${record.id}/receipt`)}
                className="flex-1 py-2 text-sm font-medium rounded-xl bg-accent-50 text-accent-600 hover:bg-accent-100 transition-colors flex items-center justify-center gap-1"
              >
                <Eye size={14} />
                查看凭证
              </button>
            </>
          )}
          {record.status === 'conflict' && (
            <button
              onClick={() => navigate('/sync')}
              className="w-full py-2 text-sm font-medium rounded-xl bg-critical-500/10 text-critical-600 border border-critical-500/30 hover:bg-critical-500/20 transition-colors flex items-center justify-center gap-1"
            >
              <AlertTriangle size={14} />
              处理冲突
            </button>
          )}
          {record.status === 'synced' && (
            <button
              onClick={() => navigate(`/record/${record.id}/receipt`)}
              className="w-full py-2 text-sm font-medium rounded-xl bg-success-50 text-success-600 hover:bg-success-100 transition-colors flex items-center justify-center gap-1"
            >
              <Eye size={14} />
              查看凭证
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (key: SectionKey) => {
    const config = sectionsConfig[key];
    const Icon = sectionIcons[key];
    const records = filteredSectionRecords[key];
    const count = counts[key];
    const firstStatus = sectionStatuses[key][0];
    const sCfg = statusConfig[firstStatus];

    return (
      <div key={key} className="space-y-3">
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 ${sCfg.bgColor} border ${sCfg.borderColor}`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${sCfg.iconBg} flex items-center justify-center`}>
              <Icon size={16} className={sCfg.textColor} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm font-bold ${sCfg.textColor}`}>{config.title}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sCfg.color} text-white`}>
                  {count}
                </span>
              </div>
              <p className="text-[11px] text-primary-500 mt-0.5">{config.subtitle}</p>
            </div>
          </div>
          {records.length > 0 && (
            <ChevronRight size={18} className={sCfg.textColor} />
          )}
        </div>

        {records.length === 0 ? (
          <Empty text={config.emptyText} icon={Icon} className="py-6" />
        ) : (
          <div className="space-y-2">
            {records.map(renderCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title={appConfig.pages.statusDesk.title} />

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {showRecoveryTip && (
          <div className="bg-accent-50 border border-accent-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <RotateCcw size={20} className="text-accent-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-accent-800 mb-1">会话已恢复</h4>
                <div className="text-xs text-accent-700 space-y-1">
                  {counts.drafts > 0 && (
                    <div className="flex items-center gap-1">
                      <FileEdit size={12} />
                      <span>{appConfig.recovery.hasDrafts.replace('{count}', String(counts.drafts))}</span>
                    </div>
                  )}
                  {counts.pending > 0 && (
                    <div className="flex items-center gap-1">
                      <Send size={12} />
                      <span>{appConfig.recovery.hasPendingSync.replace('{count}', String(counts.pending))}</span>
                    </div>
                  )}
                  {lastVisitAt && (
                    <div className="flex items-center gap-1 text-accent-600">
                      <Clock size={12} />
                      <span>{appConfig.recovery.lastVisit.replace('{time}', formatTime(lastVisitAt))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索设备名称/编号"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm bg-white"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-3 rounded-xl transition-colors ${
              showFilter || statusFilter
                ? 'bg-primary-600 text-white'
                : 'bg-white text-primary-600 border border-surface-200'
            }`}
          >
            <Filter size={20} />
          </button>
        </div>

        {showFilter && (
          <div className="bg-white rounded-2xl shadow-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-primary-800">状态筛选</h3>
            <div className="flex flex-wrap gap-2">
              {([
                { value: '' as const, label: '全部' },
                { value: 'draft' as const, label: statusConfig.draft.shortLabel },
                { value: 'submitted' as const, label: statusConfig.submitted.shortLabel },
                { value: 'conflict' as const, label: statusConfig.conflict.shortLabel },
                { value: 'synced' as const, label: statusConfig.synced.shortLabel },
              ]).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStatusFilter(item.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === item.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-50 text-primary-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-xl p-3 text-center shadow-sm ${statusConfig.draft.bgColor} border ${statusConfig.draft.borderColor}`}>
            <div className={`text-2xl font-bold ${statusConfig.draft.textColor}`}>{counts.drafts}</div>
            <div className="text-[11px] text-primary-500 mt-0.5">{sectionsConfig.drafts.iconLabel}</div>
          </div>
          <div className={`rounded-xl p-3 text-center shadow-sm ${statusConfig.submitted.bgColor} border ${statusConfig.submitted.borderColor}`}>
            <div className={`text-2xl font-bold ${statusConfig.submitted.textColor}`}>{counts.pending}</div>
            <div className="text-[11px] text-primary-500 mt-0.5">{sectionsConfig.pending.iconLabel}</div>
          </div>
          <div className={`rounded-xl p-3 text-center shadow-sm ${statusConfig.synced.bgColor} border ${statusConfig.synced.borderColor}`}>
            <div className={`text-2xl font-bold ${statusConfig.synced.textColor}`}>{counts.synced}</div>
            <div className="text-[11px] text-primary-500 mt-0.5">{sectionsConfig.synced.iconLabel}</div>
          </div>
        </div>

        {(renderSection('drafts'))}
        {(renderSection('pending'))}
        {(renderSection('synced'))}
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-success-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
            <CheckCircle size={16} />
            {toast}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
