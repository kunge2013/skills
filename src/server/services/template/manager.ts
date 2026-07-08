import { IStorageProvider } from '../../storage/types';

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: 'optimize' | 'userOptimize' | 'iterate' | 'evaluation' | 'variable-extraction' | 'image-optimize';
  templateType: 'simple' | 'advanced';
  content: {
    system: string;
    user?: string;
  };
  category?: string;
}

export class TemplateProcessor {
  static process(template: Template, variables: Record<string, string>): string {
    let result = template.content.system;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  static processAdvanced(template: Template, variables: Record<string, string>): { system: string; user?: string } {
    const system = this.replaceVariables(template.content.system, variables);
    const user = template.content.user
      ? this.replaceVariables(template.content.user, variables)
      : undefined;
    return { system, user };
  }

  private static replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}

export class TemplateManager {
  private storageKey = 'templates';
  private storage: IStorageProvider;
  private builtinTemplates: Template[];

  constructor(storage: IStorageProvider, builtinTemplates?: Template[]) {
    this.storage = storage;
    this.builtinTemplates = builtinTemplates || [];
  }

  async getAllTemplates(): Promise<Template[]> {
    const raw = await this.storage.getItem(this.storageKey);
    const custom = raw ? JSON.parse(raw) : [];
    return [...this.builtinTemplates, ...custom];
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === id);
  }

  async createTemplate(template: Template): Promise<void> {
    const raw = await this.storage.getItem(this.storageKey);
    const custom = raw ? JSON.parse(raw) : [];
    custom.push(template);
    await this.storage.setItem(this.storageKey, JSON.stringify(custom));
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<void> {
    const raw = await this.storage.getItem(this.storageKey);
    const custom = raw ? JSON.parse(raw) : [];
    const index = custom.findIndex((t: Template) => t.id === id);
    if (index < 0) {
      // 内置模板不在自定义列表中，查找内置模板并添加到自定义列表
      const builtin = this.builtinTemplates.find(t => t.id === id);
      if (builtin) {
        custom.push({ ...builtin, ...updates });
      } else {
        throw new Error(`Template "${id}" not found`);
      }
    } else {
      custom[index] = { ...custom[index], ...updates };
    }
    await this.storage.setItem(this.storageKey, JSON.stringify(custom));
  }

  async deleteTemplate(id: string): Promise<void> {
    const raw = await this.storage.getItem(this.storageKey);
    const custom = raw ? JSON.parse(raw) : [];
    const filtered = custom.filter((t: Template) => t.id !== id);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  async getTemplatesByType(type: Template['type']): Promise<Template[]> {
    const templates = await this.getAllTemplates();
    return templates.filter(t => t.type === type);
  }

  async importTemplates(data: string): Promise<void> {
    const templates = JSON.parse(data) as Template[];
    for (const t of templates) {
      await this.createTemplate(t);
    }
  }
}

// Built-in optimize templates
export function createDefaultTemplates(): Template[] {
  return [
    {
      id: 'optimize-general',
      name: 'General Optimize',
      type: 'optimize',
      templateType: 'simple',
      content: {
        system: `You are an expert prompt engineer. Optimize the following user prompt to be more effective, clear, and structured.

Requirements:
1. Make the prompt more specific and actionable
2. Add relevant context and constraints
3. Improve structure and formatting
4. Preserve the original intent

Original prompt:
{{originalPrompt}}

Provide the optimized version directly.`,
        user: '{{originalPrompt}}',
      },
      category: 'general',
    },
    {
      id: 'user-optimize-professional',
      name: 'Professional Prompt Optimizer',
      type: 'userOptimize',
      templateType: 'advanced',
      content: {
        system: `You are a world-class prompt engineering specialist. Your task is to analyze and optimize user prompts for maximum effectiveness when used with AI models.

## Analysis Framework
1. **Clarity**: Is the intent unambiguous?
2. **Completeness**: Are all necessary context and constraints included?
3. **Structure**: Is the format optimal for AI comprehension?
4. **Specificity**: Are vague terms replaced with concrete instructions?

## Optimization Principles
- Use imperative mood
- Provide examples when helpful
- Specify output format expectations
- Include edge case handling
- Add quality checkpoints

Optimize the following prompt:

{{originalPrompt}}`,
        user: '{{originalPrompt}}',
      },
      category: 'professional',
    },
    {
      id: 'iterate-general',
      name: 'General Iterate',
      type: 'iterate',
      templateType: 'advanced',
      content: {
        system: `You are refining a prompt based on feedback.

Original prompt: {{originalPrompt}}
Last optimized version: {{lastOptimizedPrompt}}
Feedback/iteration input: {{iterateInput}}

Please improve the last optimized version based on the feedback while preserving the improvements from the original.`,
        user: '{{iterateInput}}',
      },
    },
    {
      id: 'evaluation-basic',
      name: 'Basic Evaluation',
      type: 'evaluation',
      templateType: 'advanced',
      content: {
        system: `Evaluate the following prompt on these criteria:
1. Clarity - How well-defined is the task?
2. Completeness - Are necessary details included?
3. Specificity - Is it specific enough to get consistent results?
4. Structure - Is the format effective?

Prompt to evaluate:
{{originalPrompt}}

Provide a score from 1-10 for each criterion and specific suggestions for improvement.`,
        user: '{{originalPrompt}}',
      },
    },
  ];
}
