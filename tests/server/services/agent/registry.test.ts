import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../../../src/server/services/agent/registry';
import path from 'path';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('discovers SKILL.md files in a directory', async () => {
    const testDir = path.join(process.cwd(), 'plugins');
    await registry.discover(testDir);
    const skills = registry.getAll();
    expect(skills.length).toBeGreaterThan(0);
  });

  it('parses frontmatter name and description', async () => {
    const testDir = path.join(process.cwd(), 'plugins');
    await registry.discover(testDir);
    const skills = registry.getAll();
    // At least one skill should have a name from frontmatter
    const named = skills.filter(s => s.name.length > 0);
    expect(named.length).toBeGreaterThan(0);
  });

  it('excludes YAML frontmatter from content', async () => {
    const testDir = path.join(process.cwd(), 'plugins');
    await registry.discover(testDir);
    const skills = registry.getAll();
    for (const skill of skills) {
      expect(skill.content).not.toMatch(/^---\n/);
    }
  });

  it('get returns undefined for unknown skill', async () => {
    const testDir = path.join(process.cwd(), 'plugins');
    await registry.discover(testDir);
    expect(registry.get('nonexistent-skill')).toBeUndefined();
  });

  it('get returns skill by name', async () => {
    const testDir = path.join(process.cwd(), 'plugins');
    await registry.discover(testDir);
    const skills = registry.getAll();
    if (skills.length > 0) {
      const found = registry.get(skills[0].name);
      expect(found).toBeDefined();
      expect(found?.name).toBe(skills[0].name);
    }
  });

  it('handles missing directory gracefully', async () => {
    const missingRegistry = new SkillRegistry();
    await missingRegistry.discover('/nonexistent/path');
    expect(missingRegistry.getAll()).toEqual([]);
  });
});
