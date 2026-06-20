import { describe, it, expect } from 'vitest';
import { appConfig } from './appConfig';
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
    });
  });

  describe('页面配置', () => {
    it('应该包含所有主要页面的配置', () => {
      expect(appConfig.pages.home).toBeDefined();
      expect(appConfig.pages.home.title).toBeDefined();
      expect(appConfig.pages.templates).toBeDefined();
      expect(appConfig.pages.templates.title).toBeDefined();
      expect(appConfig.pages.devices).toBeDefined();
      expect(appConfig.pages.devices.title).toBeDefined();
      expect(appConfig.pages.inspections).toBeDefined();
      expect(appConfig.pages.inspections.title).toBeDefined();
      expect(appConfig.pages.sync).toBeDefined();
      expect(appConfig.pages.sync.title).toBeDefined();
      expect(appConfig.pages.export).toBeDefined();
      expect(appConfig.pages.export.title).toBeDefined();
      expect(appConfig.pages.logs).toBeDefined();
      expect(appConfig.pages.logs.title).toBeDefined();
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
    });

    it('所有空状态文案都应该是非空字符串', () => {
      const emptyTexts = Object.values(appConfig.empty);
      emptyTexts.forEach((text) => {
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('状态配置', () => {
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

  describe('导出配置', () => {
    it('应该包含导出相关配置', () => {
      expect(appConfig.export.jsonLabel).toBe('导出 JSON');
      expect(appConfig.export.jsonDesc).toBe('完整数据格式');
      expect(appConfig.export.csvLabel).toBe('导出 CSV');
      expect(appConfig.export.csvDesc).toBe('Excel 兼容格式');
      expect(appConfig.export.fileNamePrefix).toBe('巡检记录_');
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
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      const firstLine = readmeContent.split('\n')[0].replace('# ', '').trim();
      expect(firstLine).toBe(appConfig.productName);
    });

    it('README 描述应该包含产品核心功能', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain(appConfig.productName);
      expect(readmeContent).toContain(appConfig.productDescription);
      expect(readmeContent).toContain('离线巡检');
      expect(readmeContent).toContain('本地缓存');
      expect(readmeContent).toContain('一键同步');
      expect(readmeContent).toContain('数据导出');
    });

    it('README 应该包含启动说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('npm run dev');
      expect(readmeContent).toContain('npm install');
    });

    it('README 应该包含巡检流程说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('巡检流程');
    });

    it('README 应该包含同步流程说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('同步流程');
    });

    it('README 应该包含导出流程说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('导出流程');
    });

    it('README 应该包含日志查看说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('日志查看');
    });

    it('README 应该包含状态说明', () => {
      const readmePath = path.resolve(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('待巡检');
      expect(readmeContent).toContain('草稿');
      expect(readmeContent).toContain('待同步');
      expect(readmeContent).toContain('已同步');
      expect(readmeContent).toContain('冲突');
    });
  });
});
