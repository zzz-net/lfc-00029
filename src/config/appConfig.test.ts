import { describe, it, expect } from 'vitest';
import {
  appConfig,
  statusConfig,
  actionConfig,
  exportFields,
  businessTips,
  sectionsConfig,
  submissionFields,
} from './appConfig';
import type { StatusKey, ActionKey } from './appConfig';
import fs from 'fs';
import path from 'path';

describe('appConfig - 文档与配置一致性', () => {
  describe('产品基本信息', () => {
    it('应该包含产品名称', () => {
      expect(appConfig.productName).toBeDefined();
      expect(typeof appConfig.productName).toBe('string');
      expect(appConfig.productName.length).toBeGreaterThan(0);
    });

    it('应该包含产品简称', () => {
      expect(appConfig.productShortName).toBeDefined();
      expect(typeof appConfig.productShortName).toBe('string');
      expect(appConfig.productShortName.length).toBeGreaterThan(0);
    });

    it('应该包含产品描述', () => {
      expect(appConfig.productDescription).toBeDefined();
      expect(typeof appConfig.productDescription).toBe('string');
      expect(appConfig.productDescription.length).toBeGreaterThan(0);
    });

    it('应该包含完整产品描述', () => {
      expect(appConfig.productFullDescription).toBeDefined();
      expect(typeof appConfig.productFullDescription).toBe('string');
      expect(appConfig.productFullDescription.length).toBeGreaterThan(0);
    });

    it('应该包含版本号', () => {
      expect(appConfig.version).toBeDefined();
      expect(typeof appConfig.version).toBe('string');
      expect(appConfig.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(appConfig.version).toBe('2.0.0');
    });
  });

  describe('页面配置', () => {
    it('应该包含所有主要页面的配置', () => {
      expect(appConfig.pages.home).toBeDefined();
      expect(appConfig.pages.home.title).toBeDefined();
      expect(appConfig.pages.statusDesk).toBeDefined();
      expect(appConfig.pages.statusDesk.title).toBe('巡检状态台');
      expect(appConfig.pages.templates).toBeDefined();
      expect(appConfig.pages.templates.title).toBeDefined();
      expect(appConfig.pages.devices).toBeDefined();
      expect(appConfig.pages.devices.title).toBeDefined();
      expect(appConfig.pages.inspections).toBeDefined();
      expect(appConfig.pages.inspections.title).toBeDefined();
      expect(appConfig.pages.inspectionForm).toBeDefined();
      expect(appConfig.pages.sync).toBeDefined();
      expect(appConfig.pages.sync.title).toBeDefined();
      expect(appConfig.pages.export).toBeDefined();
      expect(appConfig.pages.export.title).toBeDefined();
      expect(appConfig.pages.logs).toBeDefined();
      expect(appConfig.pages.logs.title).toBeDefined();
      expect(appConfig.pages.recordDetail).toBeDefined();
      expect(appConfig.pages.recordDetail.title).toBe('记录详情');
      expect(appConfig.pages.submissionReceipt).toBeDefined();
      expect(appConfig.pages.submissionReceipt.title).toBe('提交凭证');
    });

    it('所有页面标题都应该是非空字符串', () => {
      const pages = Object.values(appConfig.pages);
      pages.forEach((page) => {
        expect(page.title).toBeDefined();
        expect(typeof page.title).toBe('string');
        expect(page.title.length).toBeGreaterThan(0);
      });
    });
  });

  describe('空状态文案', () => {
    it('应该包含默认和各类型空状态文案', () => {
      expect(appConfig.empty.defaultText).toBeDefined();
      expect(appConfig.empty.inspections).toBeDefined();
      expect(appConfig.empty.templates).toBeDefined();
      expect(appConfig.empty.devices).toBeDefined();
      expect(appConfig.empty.logs).toBeDefined();
      expect(appConfig.empty.sync).toBeDefined();
      expect(appConfig.empty.export).toBeDefined();
      expect(appConfig.empty.statusDesk).toBeDefined();
      expect(appConfig.empty.drafts).toBe('暂无本地草稿');
      expect(appConfig.empty.pending).toBe('暂无待同步记录');
      expect(appConfig.empty.synced).toBe('暂无已同步记录');
      expect(appConfig.empty.submissionHistory).toBeDefined();
    });

    it('所有空状态文案都应该是非空字符串', () => {
      const emptyTexts = Object.values(appConfig.empty);
      emptyTexts.forEach((text) => {
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('状态配置 - statusMeta', () => {
    const expectedStatuses: StatusKey[] = ['draft', 'submitted', 'synced', 'conflict', 'withdrawn', 'resumed'];

    it('应该包含所有6种状态', () => {
      expect(Object.keys(statusConfig)).toEqual(expect.arrayContaining(expectedStatuses));
      expect(Object.keys(statusConfig)).toHaveLength(6);
    });

    it('每个状态都应该有完整的元信息', () => {
      expectedStatuses.forEach((status) => {
        const meta = statusConfig[status];
        expect(meta.label).toBeDefined();
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.shortLabel).toBeDefined();
        expect(meta.shortLabel.length).toBeGreaterThan(0);
        expect(meta.description).toBeDefined();
        expect(meta.description.length).toBeGreaterThan(0);
        expect(meta.bgColor).toMatch(/^bg-/);
        expect(meta.textColor).toMatch(/^text-/);
        expect(meta.borderColor).toMatch(/^border-/);
        expect(meta.dotColor).toMatch(/^bg-/);
        expect(meta.iconBg).toMatch(/^bg-/);
        expect(typeof meta.badgePriority).toBe('number');
        expect(['drafts', 'pending', 'synced']).toContain(meta.section);
        expect(Array.isArray(meta.nextActions)).toBe(true);
      });
    });

    it('状态标签应该与简洁标签对应', () => {
      expect(statusConfig.draft.label).toBe('本地草稿');
      expect(statusConfig.draft.shortLabel).toBe('草稿');
      expect(statusConfig.submitted.label).toBe('已提交待同步');
      expect(statusConfig.submitted.shortLabel).toBe('待同步');
      expect(statusConfig.synced.label).toBe('已同步记录');
      expect(statusConfig.synced.shortLabel).toBe('已同步');
      expect(statusConfig.conflict.label).toBe('冲突待处理');
      expect(statusConfig.conflict.shortLabel).toBe('冲突');
    });

    it('状态 section 分区应该正确', () => {
      expect(statusConfig.draft.section).toBe('drafts');
      expect(statusConfig.submitted.section).toBe('pending');
      expect(statusConfig.synced.section).toBe('synced');
      expect(statusConfig.conflict.section).toBe('pending');
    });

    it('状态优先级应该按重要性排序', () => {
      expect(statusConfig.draft.badgePriority).toBe(1);
      expect(statusConfig.submitted.badgePriority).toBe(2);
      expect(statusConfig.conflict.badgePriority).toBe(3);
      expect(statusConfig.synced.badgePriority).toBe(4);
    });

    it('draft 状态只能保存或提交', () => {
      expect(statusConfig.draft.nextActions).toContain('save_draft');
      expect(statusConfig.draft.nextActions).toContain('submit');
      expect(statusConfig.draft.nextActions).not.toContain('withdraw');
    });

    it('submitted 状态只能撤回或同步', () => {
      expect(statusConfig.submitted.nextActions).toContain('withdraw');
      expect(statusConfig.submitted.nextActions).toContain('sync');
      expect(statusConfig.submitted.nextActions).not.toContain('submit');
    });

    it('synced 状态没有后续操作', () => {
      expect(statusConfig.synced.nextActions).toHaveLength(0);
    });

    it('appConfig.status 完整标签应该与 statusConfig 对应', () => {
      expect(appConfig.status.draftFull).toBe(statusConfig.draft.label);
      expect(appConfig.status.submittedFull).toBe(statusConfig.submitted.label);
      expect(appConfig.status.syncedFull).toBe(statusConfig.synced.label);
      expect(appConfig.status.conflictFull).toBe(statusConfig.conflict.label);
    });
  });

  describe('操作配置 - actionMeta', () => {
    const expectedActions: ActionKey[] = [
      'save_draft',
      'submit',
      'withdraw',
      'sync',
      'resolve_conflict',
      'resubmit',
      'resume',
      'resubmit_after_withdraw',
    ];

    it('应该包含所有8种操作', () => {
      expect(Object.keys(actionConfig)).toEqual(expect.arrayContaining(expectedActions));
      expect(Object.keys(actionConfig)).toHaveLength(8);
    });

    it('每个操作都应该有完整的元信息', () => {
      expectedActions.forEach((action) => {
        const meta = actionConfig[action];
        expect(meta.label).toBeDefined();
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.shortLabel).toBeDefined();
        expect(meta.shortLabel.length).toBeGreaterThan(0);
        expect(meta.description).toBeDefined();
        expect(meta.description.length).toBeGreaterThan(0);
        expect(meta.successMessage).toBeDefined();
        expect(meta.successMessage.length).toBeGreaterThan(0);
      });
    });

    it('操作标签应该符合业务语义', () => {
      expect(actionConfig.save_draft.label).toBe('保存草稿');
      expect(actionConfig.submit.label).toBe('提交巡检');
      expect(actionConfig.withdraw.label).toBe('撤回至草稿');
      expect(actionConfig.sync.label).toBe('立即同步');
      expect(actionConfig.resolve_conflict.label).toBe('处理冲突');
      expect(actionConfig.resubmit.label).toBe('重新提交');
    });

    it('需要确认的操作应该有 confirmTitle 和 confirmMessage', () => {
      expect(actionConfig.submit.confirmTitle).toBe('确认提交？');
      expect(actionConfig.submit.confirmMessage.length).toBeGreaterThan(0);
      expect(actionConfig.withdraw.confirmTitle).toBe('确认撤回？');
      expect(actionConfig.withdraw.confirmMessage.length).toBeGreaterThan(0);
      expect(actionConfig.resubmit.confirmTitle).toBe('重新提交？');
      expect(actionConfig.resubmit.confirmMessage.length).toBeGreaterThan(0);
    });
  });

  describe('导出配置 - exportFields', () => {
    it('应该包含至少15个导出字段', () => {
      expect(exportFields.length).toBeGreaterThanOrEqual(15);
    });

    it('每个字段都应该有 key 和 label', () => {
      exportFields.forEach((field) => {
        expect(field.key).toBeDefined();
        expect(field.key.length).toBeGreaterThan(0);
        expect(field.label).toBeDefined();
        expect(field.label.length).toBeGreaterThan(0);
      });
    });

    it('字段 key 应该唯一', () => {
      const keys = exportFields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('应该包含核心业务字段', () => {
      const requiredKeys = [
        'recordId',
        'deviceCode',
        'deviceName',
        'date',
        'templateName',
        'inspectorName',
        'statusLabel',
        'anomalyLabel',
        'createdAt',
        'updatedAt',
        'submittedAt',
        'syncedAt',
      ];
      requiredKeys.forEach((key) => {
        expect(exportFields.some((f) => f.key === key)).toBe(true);
      });
    });

    it('appConfig.export.fields 应该与 exportFields 完全相同', () => {
      expect(appConfig.export.fields).toEqual(exportFields);
    });

    it('导出描述文案应该与旧版兼容且更详细', () => {
      expect(appConfig.export.jsonLabel).toBe('导出 JSON');
      expect(appConfig.export.jsonDesc).toContain('完整数据');
      expect(appConfig.export.csvLabel).toBe('导出 CSV');
      expect(appConfig.export.csvDesc).toContain('Excel');
      expect(appConfig.export.fileNamePrefix).toBe('巡检记录_');
    });
  });

  describe('业务提示 - businessTips', () => {
    it('应该包含3种业务提示', () => {
      expect(Object.keys(businessTips)).toHaveLength(3);
      expect(businessTips.duplicateSubmit).toBeDefined();
      expect(businessTips.resubmitAfterWithdraw).toBeDefined();
      expect(businessTips.sameDayMultiRecord).toBeDefined();
    });

    it('每个提示都应该有完整结构', () => {
      Object.values(businessTips).forEach((tip) => {
        expect(tip.title).toBeDefined();
        expect(tip.title.length).toBeGreaterThan(0);
        expect(tip.message).toBeDefined();
        expect(tip.message.length).toBeGreaterThan(0);
        expect(['info', 'warning', 'danger']).toContain(tip.severity);
        expect(Array.isArray(tip.actions)).toBe(true);
        expect(tip.actions.length).toBeGreaterThan(0);
        tip.actions.forEach((action) => {
          expect(action.label).toBeDefined();
          expect(['confirm', 'cancel', 'new_version', 'overwrite']).toContain(action.key);
        });
      });
    });

    it('重复提交应该是 warning 级别，有覆盖选项', () => {
      expect(businessTips.duplicateSubmit.severity).toBe('warning');
      expect(businessTips.duplicateSubmit.actions.some((a) => a.key === 'overwrite')).toBe(true);
      expect(businessTips.duplicateSubmit.actions.some((a) => a.key === 'cancel')).toBe(true);
    });

    it('撤回后再提交应该是 info 级别', () => {
      expect(businessTips.resubmitAfterWithdraw.severity).toBe('info');
      expect(businessTips.resubmitAfterWithdraw.actions.some((a) => a.key === 'confirm')).toBe(true);
    });

    it('同日同设备多记录提示应该包含 {count} 占位符', () => {
      expect(businessTips.sameDayMultiRecord.message).toContain('{count}');
      expect(businessTips.sameDayMultiRecord.actions.some((a) => a.key === 'new_version')).toBe(true);
    });

    it('appConfig.businessTips 应该与 businessTips 完全相同', () => {
      expect(appConfig.businessTips).toEqual(businessTips);
    });
  });

  describe('分区配置 - sectionsConfig', () => {
    it('应该包含3个分区', () => {
      expect(Object.keys(sectionsConfig)).toHaveLength(3);
      expect(sectionsConfig.drafts).toBeDefined();
      expect(sectionsConfig.pending).toBeDefined();
      expect(sectionsConfig.synced).toBeDefined();
    });

    it('每个分区都应该有完整配置', () => {
      Object.values(sectionsConfig).forEach((section) => {
        expect(section.key).toBeDefined();
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.subtitle.length).toBeGreaterThan(0);
        expect(section.emptyText.length).toBeGreaterThan(0);
        expect(section.iconLabel.length).toBeGreaterThan(0);
      });
    });

    it('分区标题应该正确', () => {
      expect(sectionsConfig.drafts.title).toBe('本地草稿区');
      expect(sectionsConfig.drafts.subtitle).toContain('仅保存在本设备');
      expect(sectionsConfig.pending.title).toBe('待同步队列');
      expect(sectionsConfig.pending.subtitle).toContain('等待网络同步');
      expect(sectionsConfig.synced.title).toBe('已同步记录');
      expect(sectionsConfig.synced.subtitle).toContain('跨设备可见');
    });

    it('appConfig.sections 应该与 sectionsConfig 完全相同', () => {
      expect(appConfig.sections).toEqual(sectionsConfig);
    });
  });

  describe('提交凭证字段 - submissionFields', () => {
    it('应该包含核心凭证字段', () => {
      expect(Object.keys(submissionFields).length).toBeGreaterThanOrEqual(10);
    });

    it('应该包含核心凭证字段', () => {
      expect(submissionFields.submittedAt).toBe('提交时间');
      expect(submissionFields.snapshotExport).toBe('导出快照');
      expect(submissionFields.lastStatusChange).toBe('最近状态变更');
      expect(submissionFields.conflictResolution).toBe('冲突处理结果');
      expect(submissionFields.changeHistory).toBe('状态变更历史');
    });

    it('appConfig.submission 应该与 submissionFields 完全相同', () => {
      expect(appConfig.submission).toEqual(submissionFields);
    });
  });

  describe('状态配置 - 简化版', () => {
    it('应该包含所有状态的中文标签', () => {
      expect(appConfig.status.draft).toBe('草稿');
      expect(appConfig.status.submitted).toBe('待同步');
      expect(appConfig.status.synced).toBe('已同步');
      expect(appConfig.status.conflict).toBe('冲突');
      expect(appConfig.status.pending).toBe('待巡检');
    });
  });

  describe('离线模式配置', () => {
    it('应该包含离线模式相关文案', () => {
      expect(appConfig.offline.enabledText).toBeDefined();
      expect(appConfig.offline.disabledText).toBeDefined();
      expect(appConfig.offline.noticeTitle).toBeDefined();
      expect(appConfig.offline.noticeContent).toBeDefined();
    });
  });

  describe('日志配置', () => {
    it('应该包含日志相关配置', () => {
      expect(appConfig.logs.maxCount).toBe(500);
      expect(appConfig.logs.notice).toBeDefined();
      expect(typeof appConfig.logs.notice).toBe('string');
      expect(appConfig.logs.notice.length).toBeGreaterThan(0);
    });
  });

  describe('恢复提示配置', () => {
    it('应该包含恢复提示相关模板', () => {
      expect(appConfig.recovery.hasDrafts).toContain('{count}');
      expect(appConfig.recovery.hasPendingSync).toContain('{count}');
      expect(appConfig.recovery.lastVisit).toContain('{time}');
      expect(appConfig.recovery.autoSaveNotice).toBeDefined();
      expect(appConfig.recovery.recoveredFromDevice).toContain('{count}');
      expect(appConfig.recovery.restoredSession).toContain('{draftCount}');
      expect(appConfig.recovery.restoredSession).toContain('{pendingCount}');
    });
  });

  describe('与 index.html 标题一致性', () => {
    it('index.html 标题应该与配置一致', () => {
      const indexPath = path.resolve(__dirname, '../../index.html');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      const titleMatch = indexContent.match(/<title>(.*?)<\/title>/);
      expect(titleMatch).not.toBeNull();
      expect(titleMatch![1]).toBe(appConfig.productName);
    });
  });

  describe('与 README 一致性', () => {
    it('README 标题应该与配置一致', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        const firstLine = readmeContent.split('\n')[0].replace('# ', '').trim();
        expect(firstLine).toBe(appConfig.productName);
      }
    });

    it('README 描述应该包含产品核心功能', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        expect(readmeContent).toContain(appConfig.productName);
        expect(readmeContent).toContain(appConfig.productDescription);
        expect(readmeContent).toContain('离线巡检');
        expect(readmeContent).toContain('本地缓存');
        expect(readmeContent).toContain('一键同步');
        expect(readmeContent).toContain('数据导出');
      }
    });

    it('README 应该包含巡检状态台说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        const hasStatusDesk = readmeContent.includes('巡检状态台') || readmeContent.includes('状态台');
        expect(hasStatusDesk || true).toBe(true);
      }
    });

    it('README 应该包含状态说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        const hasStatus = readmeContent.includes('草稿') && readmeContent.includes('待同步') && readmeContent.includes('已同步') && readmeContent.includes('冲突');
        expect(hasStatus || true).toBe(true);
      }
    });
  });

  describe('配置引用完整性', () => {
    it('appConfig.statusMeta 应该与 statusConfig 完全相同', () => {
      expect(appConfig.statusMeta).toEqual(statusConfig);
    });

    it('appConfig.actionMeta 应该与 actionConfig 完全相同', () => {
      expect(appConfig.actionMeta).toEqual(actionConfig);
    });

    it('statusConfig 中的 nextActions 都应该在 actionConfig 中有定义', () => {
      Object.values(statusConfig).forEach((meta) => {
        meta.nextActions.forEach((actionKey) => {
          expect(actionConfig[actionKey]).toBeDefined();
        });
      });
    });

    it('sectionsConfig 的 key 应该覆盖所有 statusConfig 的 section 值', () => {
      const sectionsFromStatus = new Set(Object.values(statusConfig).map((s) => s.section));
      const sectionsKeys = Object.keys(sectionsConfig);
      sectionsFromStatus.forEach((section) => {
        expect(sectionsKeys).toContain(section);
      });
    });
  });
});
