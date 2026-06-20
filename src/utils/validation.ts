import type { TemplateField, InspectionRecord } from '@/types';

export interface ValidationError {
  fieldKey: string;
  message: string;
}

export function validateRecord(
  values: Record<string, any>,
  fields: TemplateField[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of fields) {
    const value = values[field.key];

    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push({
          fieldKey: field.key,
          message: `${field.label}为必填项`,
        });
        continue;
      }
    }

    if (field.type === 'number' && value !== '' && value !== undefined && value !== null) {
      if (isNaN(Number(value))) {
        errors.push({
          fieldKey: field.key,
          message: `${field.label}必须是数字`,
        });
      }
    }

    if (field.type === 'photo' && Array.isArray(value) && value.length > 9) {
      errors.push({
        fieldKey: field.key,
        message: `${field.label}最多上传9张`,
      });
    }
  }

  return errors;
}

export function hasRequiredFields(fields: TemplateField[]): string[] {
  return fields.filter((f) => f.required).map((f) => f.key);
}
