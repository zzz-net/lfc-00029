import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  FileCheck,
  RefreshCw,
  AlertTriangle,
  Zap,
  Settings,
  Download,
  Clock,
  ArrowRight,
  Save,
  Wifi,
} from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { useStore } from '@/store/useStore';
import { getTodayString } from '@/utils/id';
import { appConfig } from '@/config/appConfig';

export default function Home() {
  const navigate = useNavigate();
  const {
    role,
    devices,
    inspections,
    conflicts,
    offlineMode,
  } = useStore();
  const [showRecoveryTip, setShowRecoveryTip] = useState(false);

  const today = getTodayString();

  const todayInspections = inspections.filter((r) => r.date === today);
  const draftCount = inspections.filter((r) => r.status === 'draft').length;
  const pendingSyncCount = inspections.filter(
    (r) => r.status === 'submitted' || r.status === 'draft'
  ).length;
  const anomalyCount = inspections.filter((r) => r.anomalyLevel !== 'none' && r.status === 'synced').length;
  const conflictCount = conflicts.filter((c) => !c.resolved).length;
  const totalDevices = devices.length;
  const inspectedToday = new Set(todayInspections.map((r) => r.deviceId)).size;

  useEffect(() => {
    if (draftCount > 0 || pendingSyncCount > 0) {
      setShowRecoveryTip(true);
      const timer = setTimeout(() => setShowRecoveryTip(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [draftCount, pendingSyncCount]);

  const stats = [
    {
      label: '待巡检设备',
      value: Math.max(0, totalDevices - inspectedToday),
      icon: ClipboardList,
      color: 'bg-primary-500',
      bgLight: 'bg-primary-50',
      textColor: 'text-primary-600',
      path: '/inspections',
    },
    {
      label: '草稿',
      value: draftCount,
      icon: FileCheck,
      color: 'bg-warning-500',
      bgLight: 'bg-warning-50',
      textColor: 'text-warning-600',
      path: '/inspections',
    },
    {
      label: '待同步',
      value: pendingSyncCount,
      icon: RefreshCw,
      color: 'bg-accent-500',
      bgLight: 'bg-accent-50',
      textColor: 'text-accent-600',
      path: '/sync',
    },
    {
      label: '异常',
      value: anomalyCount,
      icon: AlertTriangle,
      color: 'bg-danger-500',
      bgLight: 'bg-danger-50',
      textColor: 'text-danger-600',
      path: '/inspections',
    },
    {
      label: '冲突',
      value: conflictCount,
      icon: Zap,
      color: 'bg-critical-500',
      bgLight: 'bg-critical-500/10',
      textColor: 'text-critical-500',
      path: '/sync',
    },
  ];

  const quickActions =
    role === 'inspector'
      ? [
          { label: '开始巡检', icon: ClipboardList, path: '/inspections', color: 'bg-primary-600 hover:bg-primary-700' },
          { label: '同步中心', icon: RefreshCw, path: '/sync', color: 'bg-accent-500 hover:bg-accent-600' },
          { label: '导出记录', icon: Download, path: '/export', color: 'bg-success-500 hover:bg-success-600' },
          { label: '操作日志', icon: Clock, path: '/logs', color: 'bg-primary-700 hover:bg-primary-800' },
        ]
      : [
          { label: '模板配置', icon: Settings, path: '/templates', color: 'bg-primary-600 hover:bg-primary-700' },
          { label: '设备管理', icon: ClipboardList, path: '/devices', color: 'bg-accent-500 hover:bg-accent-600' },
          { label: '同步中心', icon: RefreshCw, path: '/sync', color: 'bg-success-500 hover:bg-success-600' },
          { label: '操作日志', icon: Clock, path: '/logs', color: 'bg-primary-700 hover:bg-primary-800' },
        ];

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title={appConfig.pages.home.title} />

      <div className="p-4 space-y-5 max-w-md mx-auto">
        {showRecoveryTip && (draftCount > 0 || pendingSyncCount > 0) && (
          <div className="bg-accent-50 border border-accent-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Save size={20} className="text-accent-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-accent-800 mb-1">欢迎回来</h4>
                <div className="text-xs text-accent-700 space-y-1">
                  {draftCount > 0 && (
                    <div className="flex items-center gap-1">
                      <FileCheck size={12} />
                      <span>{draftCount} 条草稿待处理</span>
                    </div>
                  )}
                  {pendingSyncCount > 0 && (
                    <div className="flex items-center gap-1">
                      <RefreshCw size={12} />
                      <span>{pendingSyncCount} 条记录待同步</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {draftCount > 0 && (
                    <button
                      onClick={() => navigate('/inspections')}
                      className="text-xs px-3 py-1.5 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 transition-colors"
                    >
                      查看草稿
                    </button>
                  )}
                  {pendingSyncCount > 0 && (
                    <button
                      onClick={() => navigate('/sync')}
                      className="text-xs px-3 py-1.5 bg-accent-100 text-accent-700 rounded-lg font-medium hover:bg-accent-200 transition-colors"
                    >
                      去同步
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowRecoveryTip(false)}
                className="text-accent-400 hover:text-accent-600 text-xs"
              >
                知道了
              </button>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 rounded-2xl shadow-card p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">{appConfig.productName}</h2>
              <p className="text-sm text-white/80">{appConfig.productDescription}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <ClipboardList size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/20">
            <Wifi size={14} className={offlineMode ? 'text-danger-300' : 'text-success-300'} />
            <span className="text-xs text-white/70">
              {offlineMode ? '离线模式 - 数据本地保存' : '在线模式 - 数据实时同步'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                onClick={() => navigate(stat.path)}
                className={`${stat.bgLight} rounded-xl p-3 flex flex-col items-center gap-2 transition-transform active:scale-95`}
              >
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white`}>
                  <Icon size={20} />
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</div>
                  <div className="text-[10px] text-primary-700/70 mt-0.5">{stat.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-base font-bold text-primary-800 mb-3">快捷操作</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`${action.color} text-white rounded-xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95 shadow-sm`}
                >
                  <Icon size={22} />
                  <span className="text-xs font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-primary-800">今日概览</h2>
            <span className="text-xs text-primary-500">{today}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-surface-100">
              <span className="text-sm text-primary-700">设备总数</span>
              <span className="text-sm font-medium text-primary-800">{totalDevices} 台</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-surface-100">
              <span className="text-sm text-primary-700">今日已巡检</span>
              <span className="text-sm font-medium text-success-600">{inspectedToday} 台</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-surface-100">
              <span className="text-sm text-primary-700">巡检记录数</span>
              <span className="text-sm font-medium text-primary-800">{todayInspections.length} 条</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-primary-700">离线模式</span>
              <span className={`text-sm font-medium ${offlineMode ? 'text-danger-600' : 'text-success-600'}`}>
                {offlineMode ? '已开启' : '已关闭'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-base font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Zap size={18} className="text-primary-500" />
            核心功能
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/inspections')}
              className="w-full flex items-center gap-3 p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <ClipboardList size={20} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary-800">巡检记录</div>
                <div className="text-xs text-primary-500 mt-0.5">离线填写，自动保存草稿</div>
              </div>
              <ArrowRight size={16} className="text-primary-300 flex-shrink-0" />
            </button>
            <button
              onClick={() => navigate('/sync')}
              className="w-full flex items-center gap-3 p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
                <RefreshCw size={20} className="text-accent-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary-800">数据同步</div>
                <div className="text-xs text-primary-500 mt-0.5">恢复网络后一键上传，冲突智能处理</div>
              </div>
              <ArrowRight size={16} className="text-primary-300 flex-shrink-0" />
            </button>
            <button
              onClick={() => navigate('/export')}
              className="w-full flex items-center gap-3 p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                <Download size={20} className="text-success-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary-800">数据导出</div>
                <div className="text-xs text-primary-500 mt-0.5">支持 JSON、CSV 格式导出</div>
              </div>
              <ArrowRight size={16} className="text-primary-300 flex-shrink-0" />
            </button>
            <button
              onClick={() => navigate('/logs')}
              className="w-full flex items-center gap-3 p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-warning-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary-800">操作日志</div>
                <div className="text-xs text-primary-500 mt-0.5">完整记录所有操作，便于追溯</div>
              </div>
              <ArrowRight size={16} className="text-primary-300 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
