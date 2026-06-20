import { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, Filter, ChevronDown } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import Empty from '@/components/Empty';
import { useStore } from '@/store/useStore';
import { appConfig } from '@/config/appConfig';
import type { OperationLog } from '@/types';

export default function Logs() {
  const { logs } = useStore();
  const [resultFilter, setResultFilter] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);

  const filteredLogs = logs.filter((log) => {
    if (resultFilter && log.result !== resultFilter) return false;
    return true;
  });

  const getResultIcon = (result: OperationLog['result']) => {
    switch (result) {
      case 'success':
        return <CheckCircle size={16} className="text-success-500" />;
      case 'fail':
        return <XCircle size={16} className="text-danger-500" />;
      case 'conflict':
        return <AlertTriangle size={16} className="text-warning-500" />;
      default:
        return <Clock size={16} className="text-primary-400" />;
    }
  };

  const getResultLabel = (result: OperationLog['result']) => {
    switch (result) {
      case 'success':
        return '成功';
      case 'fail':
        return '失败';
      case 'conflict':
        return '冲突';
      default:
        return result;
    }
  };

  const getResultColor = (result: OperationLog['result']) => {
    switch (result) {
      case 'success':
        return 'bg-success-50 text-success-600';
      case 'fail':
        return 'bg-danger-50 text-danger-600';
      case 'conflict':
        return 'bg-warning-50 text-warning-600';
      default:
        return 'bg-surface-100 text-primary-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString();
  };

  const resultOptions = [
    { value: '', label: '全部结果' },
    { value: 'success', label: '成功' },
    { value: 'fail', label: '失败' },
    { value: 'conflict', label: '冲突' },
  ];

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title={appConfig.pages.logs.title} />

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-primary-800 flex items-center gap-2">
              <Clock size={16} className="text-primary-500" />
              日志筛选
            </h2>
            <span className="text-xs text-primary-500">
              共 {filteredLogs.length} 条
            </span>
          </div>

          <div className="mt-3 relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-50 rounded-xl text-sm text-primary-700 hover:bg-surface-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Filter size={14} className="text-primary-400" />
                {resultOptions.find((o) => o.value === resultFilter)?.label || '全部结果'}
              </span>
              <ChevronDown size={14} className={`text-primary-400 transition-transform ${showFilter ? 'rotate-180' : ''}`} />
            </button>
            {showFilter && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-10 overflow-hidden">
                {resultOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setResultFilter(option.value);
                      setShowFilter(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-surface-50 transition-colors ${
                      resultFilter === option.value
                        ? 'text-primary-600 bg-primary-50 font-medium'
                        : 'text-primary-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <Clock size={18} className="text-primary-500" />
              全部日志
            </h2>
          </div>

          {filteredLogs.length === 0 ? (
            <Empty type="logs" icon={Clock} />
          ) : (
            <div className="divide-y divide-surface-100 max-h-[60vh] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      {getResultIcon(log.result)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-primary-800 truncate">
                          {log.action}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${getResultColor(log.result)}`}>
                          {getResultLabel(log.result)}
                        </span>
                      </div>
                      <p className="text-xs text-primary-600 mt-1 line-clamp-2">
                        {log.detail}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-primary-400">
                        <span>{log.userName}</span>
                        <span>·</span>
                        <span>{formatTime(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-primary-50 rounded-xl p-3">
          <div className="text-xs text-primary-600">
            <span className="font-medium">提示：</span>
            {appConfig.logs.notice}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
