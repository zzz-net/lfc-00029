import { Router } from 'express';
import { dataStore } from '../store/dataStore';
import { generateId } from '../../src/utils/id';
import type { Template, TemplateField } from '../../src/types';

const router = Router();

router.get('/', (_req, res) => {
  res.json(dataStore.templates);
});

router.get('/:id', (req, res) => {
  const tpl = dataStore.templates.find((t) => t.id === req.params.id);
  if (!tpl) {
    return res.status(404).json({ error: '模板不存在' });
  }
  res.json(tpl);
});

router.post('/', (req, res) => {
  const { name, fields } = req.body;
  if (!name || !Array.isArray(fields)) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const now = new Date().toISOString();
  const newTemplate: Template = {
    id: generateId('tpl'),
    name,
    version: 1,
    enabled: true,
    fields: fields.map((f: Partial<TemplateField>) => ({
      id: generateId('fld'),
      key: f.key || '',
      label: f.label || '',
      type: f.type || 'text',
      required: f.required ?? false,
      options: f.options,
      anomalyLevel: f.anomalyLevel,
    })),
    createdAt: now,
    updatedAt: now,
  };

  dataStore.addTemplate(newTemplate);
  res.status(201).json(newTemplate);
});

router.put('/:id', (req, res) => {
  const { name, fields, enabled } = req.body;
  const existing = dataStore.templates.find((t) => t.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '模板不存在' });
  }

  const now = new Date().toISOString();
  const versionIncrement = fields && JSON.stringify(existing.fields) !== JSON.stringify(fields);

  const updated: Template = {
    ...existing,
    name: name ?? existing.name,
    enabled: enabled ?? existing.enabled,
    fields: fields
      ? fields.map((f: Partial<TemplateField>) => ({
          id: f.id || generateId('fld'),
          key: f.key || '',
          label: f.label || '',
          type: f.type || 'text',
          required: f.required ?? false,
          options: f.options,
          anomalyLevel: f.anomalyLevel,
        }))
      : existing.fields,
    version: versionIncrement ? existing.version + 1 : existing.version,
    updatedAt: now,
  };

  dataStore.updateTemplate(updated);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const existing = dataStore.templates.find((t) => t.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '模板不存在' });
  }
  dataStore.deleteTemplate(req.params.id);
  res.json({ success: true });
});

export default router;
