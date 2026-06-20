import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Copy, ChevronRight, FileText } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { useStore } from '@/store/useStore';
import { formatDateTime } from '@/utils/id';

export default function Templates() {
  const navigate = useNavigate();
  const { templates, deleteTemplate, createTemplate } = useStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleCreate = () => {
    navigate('/templates/new');
  };

  const handleEdit = (id: string) => {
    navigate(`/templates/${id}`);
  };

  const handleCopy = async (tpl: typeof templates[0]) => {
    await createTemplate({
      name: `${tpl.name} (副本)`,
      fields: tpl.fields,
      enabled: false,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    setShowDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title="模板配置" />

      <div className="p-4 space-y-3 max-w-md mx-auto">
        <button
          onClick={handleCreate}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={20} />
          新建模板
        </button>

        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card p-8 text-center">
              <FileText size={48} className="mx-auto text-surface-200 mb-3" />
              <p className="text-primary-400 text-sm">暂无模板，点击上方按钮创建</p>
            </div>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-2xl shadow-card p-4 hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-primary-800">{tpl.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          tpl.enabled
                            ? 'bg-success-100 text-success-600'
                            : 'bg-surface-100 text-surface-300'
                        }`}
                      >
                        {tpl.enabled ? '启用' : '停用'}
                      </span>
                    </div>
                    <p className="text-xs text-primary-500 mt-1">
                      版本 v{tpl.version} · {tpl.fields.length} 个字段
                    </p>
                  </div>
                  <button
                    onClick={() => handleEdit(tpl.id)}
                    className="text-primary-400 hover:text-primary-600"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tpl.fields.slice(0, 4).map((field) => (
                    <span
                      key={field.id}
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        field.required
                          ? 'bg-accent-50 text-accent-600'
                          : 'bg-surface-50 text-primary-500'
                      }`}
                    >
                      {field.label}
                      {field.required && ' *'}
                    </span>
                  ))}
                  {tpl.fields.length > 4 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-50 text-primary-400">
                      +{tpl.fields.length - 4}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-surface-100">
                  <span className="text-xs text-primary-400">
                    更新于 {formatDateTime(tpl.updatedAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(tpl)}
                      className="p-2 text-primary-500 hover:bg-surface-50 rounded-lg transition-colors"
                      title="复制"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(tpl.id)}
                      className="p-2 text-primary-500 hover:bg-surface-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(tpl.id)}
                      className="p-2 text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold text-primary-800 mb-2">确认删除</h3>
            <p className="text-sm text-primary-600 mb-5">
              删除后将无法恢复，确定要删除这个模板吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-surface-200 text-primary-700 font-medium hover:bg-surface-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-2.5 rounded-xl bg-danger-500 text-white font-medium hover:bg-danger-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
