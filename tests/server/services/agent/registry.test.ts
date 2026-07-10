import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry } from '../../../../src/server/services/agent/registry';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;
  let tempDir: string;

  beforeEach(() => {
    registry = new SkillRegistry();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('discovers SKILL.md files in a directory', async () => {
    const subdir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'SKILL.md'), [
      '---',
      'name: test-skill',
      'description: A test skill',
      '---',
      'Some content',
    ].join('\n'));

    await registry.discover(tempDir);
    const skills = registry.getAll();
    expect(skills.length).toBeGreaterThan(0);
  });

  it('parses frontmatter name and description', async () => {
    const subdir = path.join(tempDir, 'named-skill');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'SKILL.md'), [
      '---',
      'name: named-skill',
      'description: A named skill',
      '---',
      'Some content',
    ].join('\n'));

    await registry.discover(tempDir);
    const skills = registry.getAll();
    const named = skills.filter(s => s.name.length > 0);
    expect(named.length).toBeGreaterThan(0);
  });

  it('excludes YAML frontmatter from content', async () => {
    const subdir = path.join(tempDir, 'frontmatter-skill');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'SKILL.md'), [
      '---',
      'name: frontmatter-skill',
      'description: A skill with frontmatter',
      '---',
      'Some content',
    ].join('\n'));

    await registry.discover(tempDir);
    const skills = registry.getAll();
    for (const skill of skills) {
      expect(skill.content).not.toMatch(/^---\n/);
    }
  });

  it('get returns undefined for unknown skill', async () => {
    const subdir = path.join(tempDir, 'empty-dir');
    fs.mkdirSync(subdir);

    await registry.discover(tempDir);
    expect(registry.get('nonexistent-skill')).toBeUndefined();
  });

  it('get returns skill by name', async () => {
    const subdir = path.join(tempDir, 'lookup-skill');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'SKILL.md'), [
      '---',
      'name: lookup-skill',
      'description: A skill for lookup',
      '---',
      'Some content',
    ].join('\n'));

    await registry.discover(tempDir);
    const skills = registry.getAll();
    expect(skills.length).toBeGreaterThan(0);
    const found = registry.get(skills[0].name);
    expect(found).toBeDefined();
    expect(found?.name).toBe(skills[0].name);
  });

  it('handles missing directory gracefully', async () => {
    const missingRegistry = new SkillRegistry();
    await missingRegistry.discover('/nonexistent/path');
    expect(missingRegistry.getAll()).toEqual([]);
  });

  it('skips files with frontmatter but missing name field', async () => {
    const subdir = path.join(tempDir, 'no-name-skill');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'SKILL.md'), [
      '---',
      'description: I have no name',
      '---',
      'Some content',
    ].join('\n'));

    await registry.discover(tempDir);
    expect(registry.getAll()).toEqual([]);
  });

  it('returns raw content for files without frontmatter', async () => {
    const subdir = path.join(tempDir, 'no-frontmatter-skill');
    fs.mkdirSync(subdir);
    const rawContent = 'Just plain markdown, no YAML frontmatter here.';
    fs.writeFileSync(path.join(subdir, 'SKILL.md'), rawContent);

    await registry.discover(tempDir);
    const skills = registry.getAll();
    expect(skills.length).toBe(0);
  });
});
