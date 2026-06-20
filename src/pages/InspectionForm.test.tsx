import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InspectionForm from './InspectionForm';
import { useStore } from '@/store/useStore';
import type { InspectionRecord, Template, Device } from '@/types';

vi.mock('@/store/useStore', () => ({
  useStore: vi.fn(),
}));

const mockDevice: Device = {
  id: 'dev_123',
  code: 'PUMP-001',
  name: '1号循环泵',
  location: 'A区泵房',
  category: '泵类',
  status: 'normal',
};

const mockTemplateV2: Template = {
  id: 'tpl_123',
  name: '通用巡检模板',
  version: 2,
  enabled: true,
  fields: [
    { id: 'f1', key: 'appearance', label: '外观检查', type: 'select', required: true, anomalyLevel: 'medium', options: ['正常', '异常'] },
    { id: 'f2', key: 'temperature', label: '运行温度', type: 'number', required: true, anomalyLevel: 'high' },
    { id: 'f3', key: 'vibration', label: '振动情况', type: 'select', required: true, anomalyLevel: 'high', options: ['无', '轻微', '明显'] },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-19T00:00:00.000Z',
};

const mockTemplateV1: Template = {
  ...mockTemplateV2,
  version: 1,
  fields: [
    { id: 'f1', key: 'appearance', label: '外观检查', type: 'select', required: true, anomalyLevel: 'medium', options: ['正常', '异常'] },
    { id: 'f2', key: 'temperature', label: '运行温度', type: 'number', required: true, anomalyLevel: 'high' },
  ],
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockOldDraft: InspectionRecord = {
  id: 'rec_456',
  deviceId: 'dev_123',
  templateId: 'tpl_123',
  templateVersion: 1,
  inspectorId: 'inspector_001',
  inspectorName: '张巡检',
  date: '2026-06-20',
  values: { appearance: '正常', temperature: 45 },
  photos: [],
  anomalyLevel: 'none',
  status: 'draft',
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:30:00.000Z',
};

const mockSubmitInspection = vi.fn();
let currentInspections: InspectionRecord[] = [];

const mockSaveInspectionDraft = vi.fn().mockImplementation(async (data: Partial<InspectionRecord>) => {
  if (data.id) {
    const idx = currentInspections.findIndex((r) => r.id === data.id);
    if (idx >= 0) {
      const updated: InspectionRecord = {
        ...currentInspections[idx],
        ...data,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      } as InspectionRecord;
      currentInspections[idx] = updated;
      return updated;
    }
  }
  const newRecord: InspectionRecord = {
    ...mockOldDraft,
    ...data,
    id: data.id || `rec_${Date.now()}`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as InspectionRecord;
  currentInspections.push(newRecord);
  return newRecord;
});

const renderForm = (inspections: InspectionRecord[] = [], template = mockTemplateV2) => {
  currentInspections = [...inspections];

  vi.mocked(useStore).mockImplementation(() => ({
    devices: [mockDevice],
    templates: [template],
    inspections: currentInspections,
    offlineMode: false,
    saveInspectionDraft: mockSaveInspectionDraft,
    submitInspection: mockSubmitInspection,
  }));

  return render(
    <MemoryRouter initialEntries={['/inspections/dev_123']}>
      <Routes>
        <Route path="/inspections/:deviceId" element={<InspectionForm />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('InspectionForm - 问题1: 刷新后草稿恢复', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该在加载完设备和模板后正常显示表单，而不是一直卡在加载中', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('1号循环泵')).toBeInTheDocument();
    });

    expect(screen.getByText('外观检查')).toBeInTheDocument();
    expect(screen.getByText('运行温度')).toBeInTheDocument();
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
  });

  it('刷新后有同日草稿时应该显示草稿选择器', async () => {
    renderForm([mockOldDraft]);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    expect(screen.getByText(/该设备今日已有 1 个草稿版本/)).toBeInTheDocument();
    expect(screen.getByText('草稿版本 1')).toBeInTheDocument();
    expect(screen.getByText('+ 新建草稿')).toBeInTheDocument();
  });

  it('选择草稿后应该正确恢复表单内容', async () => {
    renderForm([mockOldDraft]);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.queryByText('选择草稿')).not.toBeInTheDocument();
    });

    const appearanceSelect = screen.getByDisplayValue('正常');
    expect(appearanceSelect).toBeInTheDocument();
  });

  it('草稿的待同步状态应该正确显示', async () => {
    const submittedDraft = { ...mockOldDraft, status: 'submitted' as const };
    renderForm([submittedDraft]);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    expect(screen.getByText('待同步')).toBeInTheDocument();
  });
});

describe('InspectionForm - 问题2: 旧模板版本拦截', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该在打开旧模板版本的草稿时显示版本不一致警告', async () => {
    renderForm([mockOldDraft], mockTemplateV2);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.getByText('模板版本不一致')).toBeInTheDocument();
    });

    expect(screen.getByText(/草稿基于 v.*版本.*当前模板已更新至 v/)).toBeInTheDocument();
    expect(screen.getByText('处理版本问题')).toBeInTheDocument();
    expect(screen.getByText('一键迁移')).toBeInTheDocument();
  });

  it('提交旧模板版本的草稿时应该阻止提交并显示版本选择对话框', async () => {
    renderForm([mockOldDraft], mockTemplateV2);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.getByText('模板版本不一致')).toBeInTheDocument();
    });

    const appearanceSelect = screen.getByDisplayValue('正常');
    fireEvent.change(appearanceSelect, { target: { value: '正常' } });

    const tempInput = screen.getByPlaceholderText('请输入运行温度');
    fireEvent.change(tempInput, { target: { value: '45' } });

    const vibrationSelect = screen.getByRole('combobox', { name: /振动情况/ });
    fireEvent.change(vibrationSelect, { target: { value: '无' } });

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(screen.getByText(/模板版本冲突/)).toBeInTheDocument();
    });

    expect(screen.getByText(/未解决版本问题前，该草稿无法进入同步流程/)).toBeInTheDocument();
    expect(screen.getByText('迁移数据到新版本')).toBeInTheDocument();
    expect(screen.getByText('使用新版本重新填写')).toBeInTheDocument();
    expect(mockSubmitInspection).not.toHaveBeenCalled();
  });

  it('选择迁移数据到新版本后应该允许提交', async () => {
    renderForm([mockOldDraft], mockTemplateV2);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.getByText('模板版本不一致')).toBeInTheDocument();
    });

    const appearanceSelect = screen.getByDisplayValue('正常');
    fireEvent.change(appearanceSelect, { target: { value: '正常' } });

    const tempInput = screen.getByPlaceholderText('请输入运行温度');
    fireEvent.change(tempInput, { target: { value: '45' } });

    const vibrationSelect = screen.getByRole('combobox', { name: /振动情况/ });
    fireEvent.change(vibrationSelect, { target: { value: '无' } });

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(screen.getByText(/模板版本冲突/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('迁移数据到新版本'));

    await waitFor(() => {
      expect(screen.queryByText(/模板版本冲突/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(mockSubmitInspection).toHaveBeenCalled();
    });
  });

  it('选择使用新版本重新填写后应该清空表单', async () => {
    renderForm([mockOldDraft], mockTemplateV2);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.getByText('模板版本不一致')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(screen.getByText(/模板版本冲突/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('使用新版本重新填写'));

    await waitFor(() => {
      expect(screen.queryByText(/模板版本冲突/)).not.toBeInTheDocument();
    });

    const appearanceSelect = screen.getByRole('combobox', { name: /外观检查/ });
    expect(appearanceSelect).toHaveValue('');

    expect(screen.queryByText('模板版本不一致')).not.toBeInTheDocument();
  });

  it('点击取消可以继续编辑但不能提交', async () => {
    renderForm([mockOldDraft], mockTemplateV2);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.getByText('模板版本不一致')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(screen.getByText(/模板版本冲突/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('取消，继续编辑'));

    await waitFor(() => {
      expect(screen.queryByText(/模板版本冲突/)).not.toBeInTheDocument();
    });

    expect(screen.getByText('模板版本不一致')).toBeInTheDocument();

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(screen.getByText(/模板版本冲突/)).toBeInTheDocument();
    });
    expect(mockSubmitInspection).not.toHaveBeenCalled();
  });

  it('草稿基于当前版本模板时不应该显示版本警告', async () => {
    const currentDraft: InspectionRecord = {
      ...mockOldDraft,
      templateVersion: 2,
    };
    renderForm([currentDraft], mockTemplateV2);

    await waitFor(() => {
      expect(screen.getByText('选择草稿')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('草稿版本 1'));

    await waitFor(() => {
      expect(screen.queryByText('选择草稿')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('模板版本不一致')).not.toBeInTheDocument();
  });
});

describe('InspectionForm - 必填校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少必填字段时应该阻止提交并显示错误', async () => {
    renderForm([]);

    await waitFor(() => {
      expect(screen.getByText('1号循环泵')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('提交巡检'));

    await waitFor(() => {
      expect(screen.getByText(/外观检查.*必填/)).toBeInTheDocument();
      expect(screen.getByText(/运行温度.*必填/)).toBeInTheDocument();
      expect(screen.getByText(/振动情况.*必填/)).toBeInTheDocument();
    });

    expect(mockSubmitInspection).not.toHaveBeenCalled();
  });
});
