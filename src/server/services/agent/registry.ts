import fs from 'fs';
import path from 'path';
import type { SkillRegistration, ISkillRegistry } from './types';

export class SkillRegistry implements ISkillRegistry {
  private skills: Map<string, SkillRegistration> = new Map();

  async discover(baseDir: string): Promise<void> {
    if (!fs.existsSync(baseDir)) {
      console.warn(`[SkillRegistry] Directory not found: ${baseDir}`);
      return;
    }
    const files = this.findSkillFiles(baseDir);
    for (const filePath of files) {
      try {
        const skill = this.parseSkillFile(filePath);
        this.skills.set(skill.name, skill);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[SkillRegistry] Failed to parse ${filePath}: ${message}`);
      }
    }
  }

  get(name: string): SkillRegistration | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillRegistration[] {
    return Array.from(this.skills.values());
  }

  private findSkillFiles(baseDir: string): string[] {
    const results: string[] = [];
    const walk = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.name === 'SKILL.md') {
          results.push(fullPath);
        }
      }
    };
    walk(baseDir);
    return results;
  }

  private parseSkillFile(filePath: string): SkillRegistration {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { name, description, content } = this.extractFrontmatter(raw);

    if (!name) {
      throw new Error(`SKILL.md missing name field: ${filePath}`);
    }

    return {
      name,
      description: description || '',
      filePath,
      content,
      tools: [],
    };
  }

  private extractFrontmatter(raw: string): {
    name: string;
    description: string;
    content: string;
  } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { name: '', description: '', content: raw };
    }

    const yamlBlock = match[1];
    const body = match[2];

    const nameMatch = yamlBlock.match(/^name:\s*(.+)$/m);
    const descMatch = yamlBlock.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch ? nameMatch[1].trim() : '',
      description: descMatch ? descMatch[1].trim() : '',
      content: body.trim(),
    };
  }
}
