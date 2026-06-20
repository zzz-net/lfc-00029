import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  X,
  Save,
  Send,
  AlertCircle,
  FileText,
  Clock,
  Image,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getTodayString, generateId } from '@/utils/id';
import { validateRecord } from '@/utils/validation';
import { getAnomalyLevelColor, getAnomalyLevelLabel, calculateAnomalyLevel } from '@/utils/anomaly';
import type { PhotoPlaceholder, TemplateField, InspectionRecord } from '@/types';

export default function InspectionForm() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { devices, templates, inspections, saveInspectionDraft, submitInspection, offlineMode } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const device = devices.find((d) => d.id === deviceId);
  const template = templates.find((t) => t.enabled) || templates[0];

  const today = getTodayString();

  const existingDrafts = useMemo(() => {
    return inspections.filter(
      (r) => r.deviceId === deviceId && r.date === today && (r.status === 'draft' || r.status === 'submitted')
    );
  }, [inspections, deviceId, today]);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<PhotoPlaceholder[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templateVersionMismatch, setTemplateVersionMismatch] = useState(false);

  useEffect(() => {
    if (existingDrafts.length > 0) {
      setShowDraftPicker(true);
    }
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      const draft = inspections.find((r) => r.id === selectedDraftId);
      if (draft) {
        setValues(draft.values);
        setPhotos(draft.photos);
        if (template && draft.templateVersion !== template.version) {
          setTemplateVersionMismatch(true);
        }
      }
    }
  }, [selectedDraftId, inspections, template]);

  const handleValueChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: PhotoPlaceholder[] = [];

    Array.from(files).forEach((file) => {
      const id = generateId('photo');
      const reader = new FileReader();

      reader.onload = (event) => {
        const thumbnail = event.target?.result as string;
        const photo: PhotoPlaceholder = {
          id,
          placeholderName: `${Date.now()}_${file.name}`,
          thumbnail,
          size: file.size,
          createdAt: new Date().toISOString(),
        };
        setPhotos((prev) => [...prev, photo]);
      };

      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const validateForm = (): boolean => {
    if (!template) return false;

    const validationErrors = validateRecord(values, template.fields);
    const errorMap: Record<string, string> = {};
    validationErrors.forEach((e) => {
      errorMap[e.fieldKey] = e.message;
    });
    setErrors(errorMap);

    return validationErrors.length === 0;
  };

  const handleSaveDraft = async () => {
    if (!template || !deviceId) return;

    setSaving(true);
    try {
      const hasSameDayDraft = existingDrafts.length > 0 && !selectedDraftId;

      if (hasSameDayDraft) {
        setShowOverwriteConfirm(true);
        setSaving(false);
        return;
      }

      const record = await saveInspectionDraft({
        id: selectedDraftId || undefined,
        deviceId,
        templateId: template.id,
        templateVersion: template.version,
        date: today,
        values,
        photos,
      });

      if (!selectedDraftId) {
        setSelectedDraftId(record.id);
      }

      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleOverwriteConfirm = async (overwrite: boolean) => {
    if (!template || !deviceId) return;
    setShowOverwriteConfirm(false);

    if (overwrite && existingDrafts.length > 0) {
      const latestDraft = existingDrafts[0];
      setSelectedDraftId(latestDraft.id);
      const record = await saveInspectionDraft({
        id: latestDraft.id,
        deviceId,
        templateId: template.id,
        templateVersion: template.version,
        date: today,
        values,
        photos,
      });
      setSelectedDraftId(record.id);
    } else {
      const record = await saveInspectionDraft({
        deviceId,
        templateId: template.id,
        templateVersion: template.version,
        date: today,
        values,
        photos,
      });
      setSelectedDraftId(record.id);
    }

    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const handleSubmit = async () => {
    if (!template || !deviceId) return;

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await submitInspection({
        id: selectedDraftId || undefined,
        deviceId,
        templateId: template.id,
        templateVersion: template.version,
        date: today,
        values,
        photos,
      });

      navigate('/inspections');
    } finally {
      setSubmitting(false);
    }
  };

  const anomalyLevel = template ? calculateAnomalyLevel(values, template.fields) : 'none';

  if (!device || !template) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-primary-500">加载中...</div>
      </div>
    );
  }

  const renderField = (field: TemplateField) => {
    const hasError = !!errors[field.key];
    const errorMsg = errors[field.key];

    const baseInputClass = `w-full px-4 py-3 rounded-xl border transition-all text-sm outline-none ${
      hasError
        ? 'border-danger-500 focus:ring-2 focus:ring-danger-100'
        : 'border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100'
    }`;

    return (
      <div key={field.id} className="space-y-2">
        <label className="flex items-center gap-1 text-sm font-medium text-primary-700">
          {field.label}
          {field.required && <span className="text-danger-500">*</span>}
          {field.anomalyLevel && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getAnomalyLevelColor(
                field.anomalyLevel
              )}`}
            >
              {getAnomalyLevelLabel(field.anomalyLevel)}级
            </span>
          )}
        </label>

        {field.type === 'text' && (
          <input
            type="text"
            value={values[field.key] || ''}
            onChange={(e) => handleValueChange(field.key, e.target.value)}
            placeholder={`请输入${field.label}`}
            className={baseInputClass}
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            value={values[field.key] ?? ''}
            onChange={(e) => handleValueChange(field.key, e.target.value ? Number(e.target.value) : '')}
            placeholder={`请输入${field.label}`}
            className={baseInputClass}
          />
        )}

        {field.type === 'select' && (
          <select
            value={values[field.key] || ''}
            onChange={(e) => handleValueChange(field.key, e.target.value)}
            className={`${baseInputClass} bg-white`}
          >
            <option value="">请选择</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {field.type === 'textarea' && (
          <textarea
            value={values[field.key] || ''}
            onChange={(e) => handleValueChange(field.key, e.target.value)}
            placeholder={`请输入${field.label}`}
            rows={3}
            className={`${baseInputClass} resize-none`}
          />
        )}

        {field.type === 'photo' && (
          <div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {photos.slice(0, 8).map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-surface-100"
                >
                  {photo.thumbnail ? (
                    <img
                      src={photo.thumbnail}
                      alt={photo.placeholderName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={24} className="text-surface-300" />
                    </div>
                  )}
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 9 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-surface-200 flex flex-col items-center justify-center text-surface-300 hover:border-primary-400 hover:text-primary-500 transition-colors"
                >
                  <Camera size={20} />
                  <span className="text-[10px] mt-1">添加照片</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-primary-400">
              {offlineMode ? '离线模式：照片将在同步后上传' : `已添加 ${photos.length}/9 张照片`}
            </p>
          </div>
        )}

        {hasError && (
          <p className="text-xs text-danger-500 flex items-center gap-1">
            <AlertCircle size={12} />
            {errorMsg}
          </p>
        )}
      </div>
    );
  };

  const requiredCount = template.fields.filter((f) => f.required).length;
  const filledCount = template.fields.filter((f) => f.required && values[f.key] !== undefined && values[f.key] !== '').length;

  return (
    <div className="min-h-screen bg-surface-100 pb-28">
      <div className="sticky top-0 z-40 bg-white border-b border-surface-200">
        {offlineMode && (
          <div className="bg-danger-500 text-white text-xs text-center py-1.5 font-medium">
            离线模式 - 数据保存在本地
          </div>
        )}
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-primary-700 hover:bg-surface-50 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold text-primary-800">{device.name}</h1>
            <p className="text-[10px] text-primary-500">{device.code} · {today}</p>
          </div>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="p-2 -mr-2 text-primary-600 hover:bg-surface-50 rounded-lg disabled:opacity-50"
          >
            <Save size={20} />
          </button>
        </div>

        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${getAnomalyLevelColor(anomalyLevel)}`}>
              异常等级：{getAnomalyLevelLabel(anomalyLevel)}
            </div>
          </div>
          <div className="text-xs text-primary-500">
            必填项 {filledCount}/{requiredCount}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {templateVersionMismatch && (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 flex items-start gap-3">
            <AlertCircle size={18} className="text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning-700">模板版本不一致</p>
              <p className="text-xs text-warning-600 mt-0.5">
                草稿基于旧模板版本，提交时将使用当前最新版本模板
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-primary-800">巡检内容</h2>
            <span className="text-xs text-primary-500">
              模板：{template.name} v{template.version}
            </span>
          </div>

          {template.fields.map((field) => renderField(field))}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-base font-bold text-primary-800 mb-3">现场照片</h2>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-surface-100"
              >
                {photo.thumbnail ? (
                  <img
                    src={photo.thumbnail}
                    alt={photo.placeholderName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image size={24} className="text-surface-300" />
                  </div>
                )}
                <button
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < 9 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-surface-200 flex flex-col items-center justify-center text-surface-300 hover:border-primary-400 hover:text-primary-500 transition-colors"
              >
                <Camera size={20} />
                <span className="text-[10px] mt-1">添加</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-primary-400 mt-2">
            {offlineMode ? '离线模式：照片以占位形式保存，同步后上传' : `已添加 ${photos.length}/9 张照片`}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 p-4 safe-bottom z-40">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 py-3 bg-surface-100 text-primary-700 rounded-xl font-medium hover:bg-surface-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Clock size={18} />
            保存草稿
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Send size={18} />
            {submitting ? '提交中...' : '提交巡检'}
          </button>
        </div>
      </div>

      {showDraftPicker && existingDrafts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 pb-8 animate-slide-up">
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-primary-800 mb-1">选择草稿</h3>
            <p className="text-sm text-primary-500 mb-4">
              该设备今日已有 {existingDrafts.length} 个草稿版本
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {existingDrafts.map((draft, index) => (
                <button
                  key={draft.id}
                  onClick={() => {
                    setSelectedDraftId(draft.id);
                    setShowDraftPicker(false);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-800">
                      草稿版本 {index + 1}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      draft.status === 'draft'
                        ? 'bg-warning-100 text-warning-600'
                        : 'bg-accent-100 text-accent-600'
                    }`}>
                      {draft.status === 'draft' ? '草稿' : '待同步'}
                    </span>
                  </div>
                  <p className="text-xs text-primary-500 mt-1">
                    更新于 {new Date(draft.updatedAt).toLocaleTimeString()}
                  </p>
                </button>
              ))}
              <button
                onClick={() => setShowDraftPicker(false)}
                className="w-full p-3 rounded-xl border-2 border-dashed border-surface-200 text-primary-500 text-sm hover:border-primary-300 hover:text-primary-600 transition-colors"
              >
                + 新建草稿
              </button>
            </div>
          </div>
        </div>
      )}

      {showOverwriteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold text-primary-800 mb-2">同日草稿提醒</h3>
            <p className="text-sm text-primary-600 mb-5">
              该设备今日已有 {existingDrafts.length} 个草稿，是否覆盖最新版本？
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleOverwriteConfirm(true)}
                className="w-full py-2.5 rounded-xl bg-accent-500 text-white font-medium hover:bg-accent-600 transition-colors"
              >
                覆盖最新草稿
              </button>
              <button
                onClick={() => handleOverwriteConfirm(false)}
                className="w-full py-2.5 rounded-xl border border-surface-200 text-primary-700 font-medium hover:bg-surface-50 transition-colors"
              >
                另存为新版本
              </button>
              <button
                onClick={() => setShowOverwriteConfirm(false)}
                className="w-full py-2.5 text-primary-400 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-success-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
            <FileText size={16} />
            草稿已保存
          </div>
        </div>
      )}
    </div>
  );
}
