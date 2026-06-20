import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Send,
  RotateCcw,
  RefreshCw,
  FileCheck,
  ClipboardList,
  ArrowRight,
  Download,
  Upload,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  Layers,
  History,
  Shield,
  Workflow,
} from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { useStore } from '@/store/useStore';
import { getTodayString } from '@/utils/id';
import { appConfig, statusConfig, workbenchSections } from '@/config/appConfig';

export default function Home() {
  const navigate = useNavigate();
  const {
    inspections,
    recoveredSession,
    clearRecoveredSession,
    offlineMode,
    getStaleDrafts,
  } = useStore();

  const today = getTodayString();
  const [showQuickStart, setShowQuickStart] = useState(true);

  const draftCount = inspections.filter((r) => r.status === 'draft' || r.status === 'resumed').length;
  const submittedCount = inspections.filter((r) => r.status === 'submitted').length;
  const syncedCount = inspections.filter((r) => r.status === 'synced').length;
  const withdrawnCount = inspections.filter((r) => r.status === 'withdrawn').length;
  const conflictCount = inspections.filter((r) => r.status === 'conflict').length;
  const todayCount = inspections.filter((r) => r.date === today).length;

  const staleDrafts = getStaleDrafts();

  useEffect(() => {
    if (recoveredSession) {
      setShowQuickStart(false);
    }
  }, [recoveredSession]);

  const workflowSteps = [
    {
      step: 1,
      title: '新建提交单',
      description: '选择设备、模板和日期，创建草稿',
      icon: Plus,
      color: 'bg-primary-500',
      action: () => navigate('/submission-workbench'),
    },
    {
      step: 2,
      title: '暂存草稿',
      description: '填写内容后保存，本地随时可继续编辑',
      icon: FileCheck,
      color: 'bg-warning-500',
      action: () => navigate('/submission-workbench'),
    },
    {
      step: 3,
      title: '正式提交',
      description: '校验通过后提交，生成提交凭据',
      icon: Send,
      color: 'bg-accent-500',
      action: () => navigate('/submission-workbench'),
    },
    {
      step: 4,
      title: '撤回修改',
      description: '提交后可撤回，保留审计日志',
      icon: RotateCcw,
      color: 'bg-surface-400',
      action: () => navigate('/submission-workbench'),
    },
    {
      step: 5,
      title: '重新发起',
      description: '修改后再次提交，完整追溯流程',
      icon: RefreshCw,
      color: 'bg-info-500',
      action: () => navigate('/submission-workbench'),
    },
  ];

  const coreFeatures = [
    {
      title: '任务列表',
      description: '按待办、进行中、已撤回、已完成分区管理',
      icon: Layers,
      color: 'bg-primary-100 text-primary-600',
    },
    {
      title: '详情侧栏',
      description: '完整信息展示，快捷操作入口',
      icon: ClipboardList,
      color: 'bg-accent-100 text-accent-600',
    },
    {
      title: '流转时间线',
      description: '完整状态变更历史，清晰追溯',
      icon: History,
      color: 'bg-success-100 text-success-600',
    },
    {
      title: '操作日志',
      description: '所有操作全记录，便于审计追溯',
      icon: Clock,
      color: 'bg-warning-100 text-warning-600',
    },
    {
      title: '凭证视图',
      description: '提交凭据留存，快照哈希防篡改',
      icon: Shield,
      color: 'bg-info-100 text-info-600',
    },
    {
      title: 'CSV 双向流转',
      description: '导出后可再导回，完整数据回灌',
      icon: Zap,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title="提交工作台" />

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {recoveredSession && (
          <div className="bg-info-50 border border-info-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-info-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw size={20} className="text-info-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-info-800 mb-1">检测到上次未完成会话</h4>
                <p className="text-xs text-info-600">
                  已恢复 {draftCount} 条草稿，可在工作台继续编辑
                </p>
              </div>
              <button
                onClick={clearRecoveredSession}
                className="text-xs text-info-600 hover:text-info-700 px-2 py-1 rounded-lg hover:bg-info-100"
              >
                知道了
              </button>
            </div>
          </div>
        )}

        {staleDrafts.length > 0 && (
          <div className="bg-warning-50 border border-warning-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-warning-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-warning-800 mb-1">检测到旧版草稿</h4>
                <p className="text-xs text-warning-600">
                  {staleDrafts.length} 条草稿基于旧版模板创建，可在工作台迁移
                </p>
              </div>
              <button
                onClick={() => navigate('/submission-workbench')}
                className="text-xs bg-warning-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-warning-600"
              >
                去处理
              </button>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 rounded-2xl shadow-card p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">提交工作台</h2>
              <p className="text-sm text-white/80">草稿整理 · 提交上报 · 撤回回滚 · 恢复续办</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Workflow size={24} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <div className="text-xl font-bold">{draftCount}</div>
              <div className="text-[10px] text-white/70">待办</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{submittedCount + conflictCount}</div>
              <div className="text-[10px] text-white/70">进行中</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{withdrawnCount}</div>
              <div className="text-[10px] text-white/70">已撤回</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{syncedCount}</div>
              <div className="text-[10px] text-white/70">已完成</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/submission-workbench')}
            className="w-full mt-4 py-2.5 bg-white text-primary-600 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"
          >
            进入工作台
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-primary-800 flex items-center gap-2">
              <Plus size={16} className="text-primary-500" />
              快速开始
            </h3>
            <button
              onClick={() => setShowQuickStart(!showQuickStart)}
              className="text-xs text-primary-400 hover:text-primary-600"
            >
              {showQuickStart ? '收起' : '展开'}
            </button>
          </div>
          {showQuickStart && (
            <div className="space-y-3">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 ${step.color} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                        <Icon size={16} />
                      </div>
                      {index < workflowSteps.length - 1 && (
                        <div className="w-0.5 h-6 bg-surface-200 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary-800">
                          第 {step.step} 步
                        </span>
                        <span className="text-sm font-medium text-primary-700">
                          {step.title}
                        </span>
                      </div>
                      <p className="text-xs text-primary-500 mt-0.5">{step.description}</p>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => navigate('/submission-workbench')}
                className="w-full mt-2 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={16} />
                立即开始
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Layers size={16} className="text-primary-500" />
            工作台分区
          </h3>
          <div className="space-y-2">
            {Object.entries(workbenchSections).map(([key, section]) => {
              const count = key === 'todo' ? draftCount :
                key === 'processing' ? submittedCount + conflictCount :
                key === 'withdrawn' ? withdrawnCount :
                syncedCount;
              const statusSample = section.statuses[0] as keyof typeof statusConfig;
              const statusCfg = statusConfig[statusSample];
              return (
                <button
                  key={key}
                  onClick={() => navigate('/submission-workbench')}
                  className="w-full flex items-center gap-3 p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors text-left"
                >
                  <div className={`w-10 h-10 ${statusCfg?.bgColor || 'bg-surface-100'} rounded-lg flex items-center justify-center`}>
                    <span className={`w-3 h-3 rounded-full ${statusCfg?.dotColor || 'bg-surface-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary-800">{section.title}</div>
                    <div className="text-xs text-primary-500 mt-0.5">{section.subtitle}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-primary-700">{count}</div>
                    <ArrowRight size={14} className="text-primary-300 ml-auto" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-primary-500" />
            核心能力
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {coreFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-surface-50 rounded-xl p-3 text-center"
                >
                  <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center ${feature.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="text-xs font-medium text-primary-700 mt-2">{feature.title}</div>
                  <div className="text-[10px] text-primary-500 mt-0.5 leading-tight">{feature.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Download size={16} className="text-primary-500" />
            数据导入导出
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Download size={20} className="text-success-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary-800">CSV 导出</div>
                <div className="text-xs text-primary-500 mt-0.5">导出完整记录，含状态、凭据、快照等信息</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload size={20} className="text-accent-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary-800">CSV 导回</div>
                <div className="text-xs text-primary-500 mt-0.5">导出文件可再导回，支持冲突检测和字段兼容</div>
              </div>
            </div>
            <button
              onClick={() => navigate('/submission-workbench')}
              className="w-full py-2.5 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors flex items-center justify-center gap-1.5"
            >
              在工作台中使用
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-success-500" />
            真实场景覆盖
          </h3>
          <div className="space-y-2 text-xs text-primary-600">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success-500 mt-1.5 flex-shrink-0" />
              <span><strong className="text-primary-700">跨重启恢复</strong>：刷新/关闭后自动恢复草稿和会话现场</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success-500 mt-1.5 flex-shrink-0" />
              <span><strong className="text-primary-700">旧草稿处理</strong>：模板更新后检测并一键迁移旧版草稿</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success-500 mt-1.5 flex-shrink-0" />
              <span><strong className="text-primary-700">重复提交拦截</strong>：同设备同日重复提交自动检测拦截</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success-500 mt-1.5 flex-shrink-0" />
              <span><strong className="text-primary-700">字段兼容</strong>：导入时自动处理字段缺失和版本差异</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-primary-400 py-2">
          今日提交 {todayCount} 条记录
          {offlineMode && <span className="ml-2">· 离线模式</span>}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
