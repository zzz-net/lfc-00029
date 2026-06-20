import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { generateId } from '@/utils/id';
import type { TemplateField, FieldType, AnomalyLevel } from '@/types';

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'select', label: '选择' },
  { value: 'textarea', label: '多行文本' },
  { value: 'photo', label: '照片' },
];

const anomalyLevels: { value: Exclude<AnomalyLevel, 'none'>; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '严重' },
];

export default function TemplateEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { templates, createTemplate, updateTemplate } = useStore();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      const tpl = templates.find((t) => t.id === id);
      if (tpl) {
        setName(tpl.name);
        setEnabled(tpl.enabled);
        setFields(tpl.fields);
      }
    }
  }, [id, isNew, templates]);

  const addField = () => {
    const newField: TemplateField = {
      id: generateId('fld'),
      key: `field_${Date.now()}`,
      label: '新字段',
      type: 'text',
      required: false,
    };
    setFields([...fields, newField]);
  };

  const updateField = (fieldId: string, updates: Partial<TemplateField>) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('请输入模板名称');
      return;
    }
    if (fields.length === 0) {
      alert('请至少添加一个字段');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createTemplate({ name, fields, enabled });
      } else if (id) {
        await updateTemplate(id, { name, fields, enabled });
      }
      navigate('/templates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-surface-200">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-primary-700 hover:bg-surface-50 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-primary-800">
            {isNew ? '新建模板' : '编辑模板'}
          </h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-card p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1.5">
              模板名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入模板名称"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary-700">启用状态</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`p-1 rounded-full transition-colors ${
                enabled ? 'bg-success-500' : 'bg-surface-200'
              }`}
            >
              {enabled ? (
                <ToggleRight size={28} className="text-white" />
              ) : (
                <ToggleLeft size={28} className="text-white" />
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-primary-800">
              字段配置
              <span className="text-xs font-normal text-primary-500 ml-2">
                共 {fields.length} 个
              </span>
            </h2>
            <button
              onClick={addField}
              className="flex items-center gap-1 text-primary-600 text-sm font-medium hover:text-primary-700"
            >
              <Plus size={16} />
              添加字段
            </button>
          </div>

          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-primary-400 text-sm">
                暂无字段，点击上方按钮添加
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border border-surface-200 rounded-xl p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical size={16} className="text-surface-300 flex-shrink-0" />
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value, key: e.target.value })}
                      placeholder="字段名称"
                      className="flex-1 px-3 py-2 rounded-lg border border-surface-200 focus:border-primary-500 outline-none text-sm"
                    />
                    <button
                      onClick={() => deleteField(field.id)}
                      className="p-2 text-danger-500 hover:bg-danger-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-primary-500 mb-1 block">类型</label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                        className="w-full px-3 py-2 rounded-lg border border-surface-200 focus:border-primary-500 outline-none text-sm bg-white"
                      >
                        {fieldTypes.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-primary-500 mb-1 block">必填</label>
                      <div className="flex items-center h-[38px]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-primary-700">必填</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {field.type === 'select' && (
                    <div>
                      <label className="text-xs text-primary-500 mb-1 block">
                        选项（用英文逗号分隔）
                      </label>
                      <input
                        type="text"
                        value={field.options?.join(',') || ''}
                        onChange={(e) =>
                          updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })
                        }
                        placeholder="例如：正常,异常,故障"
                        className="w-full px-3 py-2 rounded-lg border border-surface-200 focus:border-primary-500 outline-none text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-primary-500 mb-1 block">异常等级</label>
                    <select
                      value={field.anomalyLevel || ''}
                      onChange={(e) =>
                        updateField(field.id, {
                          anomalyLevel: (e.target.value as Exclude<AnomalyLevel, 'none'>) || undefined,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 focus:border-primary-500 outline-none text-sm bg-white"
                    >
                      <option value="">无（正常字段）</option>
                      {anomalyLevels.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                      className="flex-1 py-1.5 text-xs text-primary-500 hover:bg-surface-50 rounded-lg disabled:opacity-30"
                    >
                      上移
                    </button>
                    <button
                      onClick={() => moveField(index, 'down')}
                      disabled={index === fields.length - 1}
                      className="flex-1 py-1.5 text-xs text-primary-500 hover:bg-surface-50 rounded-lg disabled:opacity-30"
                    >
                      下移
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 p-4 safe-bottom z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? '保存中...' : '保存模板'}
          </button>
        </div>
      </div>
    </div>
  );
}
