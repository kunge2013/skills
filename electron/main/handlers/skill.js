// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// [AGC:START] tool=Cc author=fangkun
function readSkillContent(skillPath) {
  if (!fs.existsSync(skillPath)) throw new Error(`Skill path does not exist: ${skillPath}`);
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) throw new Error(`SKILL.md not found in: ${skillPath}`);
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const stat = fs.statSync(skillMdPath);
  return { content, path: skillMdPath, lastModified: stat.mtimeMs };
}
// [AGC:END]

// [AGC:START] tool=Cc author=fangkun
function validateSkillMd(content) {
  const errors = [];
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) {
    errors.push('Missing YAML frontmatter (--- ... ---)');
    return { valid: false, errors };
  }
  const frontmatter = frontmatterMatch[1];
  if (!/^name:\s*\S+/m.test(frontmatter)) errors.push('Missing required field: name');
  if (!/^description:\s*\S+/m.test(frontmatter)) errors.push('Missing required field: description');
  return { valid: errors.length === 0, errors, frontmatter, body: content.slice(frontmatterMatch[0].length) };
}
// [AGC:END]

// [AGC:START] tool=Cc author=fangkun
function saveSkillContent(skillPath, content, expectedMtime = null) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) throw new Error(`SKILL.md not found in: ${skillPath}`);
  if (expectedMtime !== null) {
    const currentStat = fs.statSync(skillMdPath);
    if (currentStat.mtimeMs !== expectedMtime) {
      return { success: false, error: 'File was modified externally. Please reload and try again.', conflict: true, currentContent: fs.readFileSync(skillMdPath, 'utf-8') };
    }
  }
  const validation = validateSkillMd(content);
  if (!validation.valid) return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
  fs.writeFileSync(skillMdPath, content, 'utf-8');
  return { success: true };
}
// [AGC:END]

// [AGC:START] tool=Cc author=fangkun
ipcMain.handle('skill:read', (_event, skillPath) => {
  try { const result = readSkillContent(skillPath); return { success: true, data: result }; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('skill:validate', (_event, content) => {
  try { const result = validateSkillMd(content); return { success: true, data: result }; }
  catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('skill:save', (_event, skillPath, content, expectedMtime) => {
  try { const result = saveSkillContent(skillPath, content, expectedMtime); return result; }
  catch (err) { return { success: false, error: err.message }; }
});
// [AGC:END]
