#!/usr/bin/env node
'use strict';

// [AGC:START] tool=Cc author=fangkun
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const logger = require('../utils/logger');

// Reuse CLI core modules
const { getAllMarketplaceDirs, getMarketplaceSourceDir } = require('../core/cache.js');
const { parseMarketplace, findSkillMerged } = require('../core/registry.js');
const { createSkillSymlink, removeSkillSymlink, getSymlinkStatus, copyDirRecursive } = require('../core/symlink.js');
const { copyInstallSkill, uninstallCopySkill, getCopyInstallStatus } = require('../core/copy-install.js');
const { findProjectSkillsDir } = require('../commands/shared.js');
const { cloneRepo, pullRepo } = require('../utils/git.js');
const { getConfig, updateConfig } = require('../core/config.js');

const pkgRoot = path.resolve(__dirname, '../..');
const rendererDist = path.join(pkgRoot, 'web', 'dist');

// ---------- API Handlers (reusing CLI core modules) ----------

function listPlugins() {
  const sourceDirs = getAllMarketplaceDirs();
  const all = []; const seen = new Set();
  for (const sd of sourceDirs) {
    const mp = parseMarketplace(sd);
    if (!mp || !mp.plugins) continue;
    for (const p of mp.plugins) {
      if (seen.has(p.name)) continue; seen.add(p.name);
      const sDir = path.join(sd, p.source, 'skills');
      const skills = [];
      if (fs.existsSync(sDir)) {
        for (const d of fs.readdirSync(sDir)) {
          const f = path.join(sDir, d);
          if (!fs.statSync(f).isDirectory() || !fs.existsSync(path.join(f, 'SKILL.md'))) continue;
          skills.push({ skillName: d, sourcePath: path.join(sDir, d), description: p.description, author: p.author?.name || 'Unknown', license: p.license || 'Unknown', category: p.category || 'other', keywords: p.keywords || [] });
        }
      }
      all.push({ name: p.name, source: p.source, description: p.description, author: p.author?.name || 'Unknown', license: p.license || 'Unknown', category: p.category || 'other', keywords: p.keywords || [], skillCount: skills.length, skills, sourceDir: path.join(sd, p.source) });
    }
  }
  return all;
}

function listAllSkills() {
  const sourceDirs = getAllMarketplaceDirs();
  const all = []; const seen = new Set();
  for (const sd of sourceDirs) {
    const mp = parseMarketplace(sd);
    if (!mp || !mp.plugins) continue;
    for (const p of mp.plugins) {
      const sDir = path.join(sd, p.source, 'skills');
      if (!fs.existsSync(sDir)) continue;
      for (const d of fs.readdirSync(sDir)) {
        const f = path.join(sDir, d);
        if (!fs.statSync(f).isDirectory() || !fs.existsSync(path.join(f, 'SKILL.md'))) continue;
        if (seen.has(d)) continue; seen.add(d);
        all.push({ skillName: d, pluginName: p.name, sourcePath: path.join(sDir, d), pluginDescription: p.description, pluginAuthor: p.author?.name || 'Unknown', pluginLicense: p.license || 'Unknown', pluginCategory: p.category || 'other', pluginKeywords: p.keywords || [] });
      }
    }
  }
  return all;
}

function searchSkills(query, filters) {
  let skills = listAllSkills();
  if (query) { const q = query.toLowerCase(); skills = skills.filter(s => s.skillName.toLowerCase().includes(q) || s.pluginName.toLowerCase().includes(q) || s.pluginDescription?.toLowerCase().includes(q) || s.pluginKeywords?.some(kw => kw.toLowerCase().includes(q))); }
  if (filters?.category) skills = skills.filter(s => s.pluginCategory === filters.category);
  if (filters?.plugin) skills = skills.filter(s => s.pluginName === filters.plugin);
  if (filters?.sortBy === 'name') skills.sort((a, b) => a.skillName.localeCompare(b.skillName));
  else if (filters?.sortBy === 'plugin') skills.sort((a, b) => a.pluginName.localeCompare(b.pluginName));
  else if (filters?.sortBy === 'author') skills.sort((a, b) => (a.pluginAuthor || '').localeCompare(b.pluginAuthor || ''));
  return skills;
}

function readSkill(skillPath) {
  const fp = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(fp)) throw new Error('SKILL.md not found: ' + skillPath);
  const content = fs.readFileSync(fp, 'utf-8');
  const stat = fs.statSync(fp);
  return { content, path: fp, lastModified: stat.mtimeMs };
}

function validateSkillMd(content) {
  const errors = [];
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!fm) { errors.push('Missing YAML frontmatter (--- ... ---)'); return { valid: false, errors }; }
  const frontmatter = fm[1];
  if (!/^name:\s*\S+/m.test(frontmatter)) errors.push('Missing required field: name');
  if (!/^description:\s*\S+/m.test(frontmatter)) errors.push('Missing required field: description');
  return { valid: errors.length === 0, errors, frontmatter, body: content.slice(fm[0].length) };
}

function saveSkill(skillPath, content, expectedMtime) {
  const fp = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(fp)) throw new Error('SKILL.md not found: ' + skillPath);
  if (expectedMtime != null) { const s = fs.statSync(fp); if (s.mtimeMs !== expectedMtime) return { success: false, error: 'File was modified externally. Please reload.', conflict: true, currentContent: fs.readFileSync(fp, 'utf-8') }; }
  const v = validateSkillMd(content);
  if (!v.valid) return { success: false, error: 'Validation failed: ' + v.errors.join(', ') };
  fs.writeFileSync(fp, content, 'utf-8');
  return { success: true };
}

function installSkill(skillName, projectPath) {
  return installSkillWithMode(skillName, projectPath, 'symlink', '');
}

/**
 * Unified install handler supporting both symlink and copy modes.
 * @param {string} skillName
 * @param {string} projectPath
 * @param {'symlink'|'copy'} mode
 * @param {string} customTargetDir - Optional custom target directory
 */
function installSkillWithMode(skillName, projectPath, mode, customTargetDir) {
  const sDir = customTargetDir || findProjectSkillsDir(projectPath || undefined);
  const skill = findSkillMerged(getAllMarketplaceDirs(), skillName);
  if (!skill) return { success: false, error: 'Skill not found: ' + skillName };

  if (mode === 'copy') {
    return copyInstallSkill(skillName, skill.sourcePath, sDir);
  }

  // Default: symlink mode
  const lp = path.join(sDir, skillName);
  try {
    createSkillSymlink(skill.sourcePath, lp);
    return { success: true, linkPath: lp, targetPath: skill.sourcePath, mode: 'symlink' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function uninstallSkill(skillName, projectPath) {
  return uninstallSkillUnified(skillName, projectPath);
}

/**
 * Unified uninstall handler that detects install mode and dispatches correctly.
 */
function uninstallSkillUnified(skillName, projectPath) {
  const sDir = findProjectSkillsDir(projectPath || undefined);
  const skillPath = path.join(sDir, skillName);

  if (!fs.existsSync(skillPath)) {
    return { success: false, error: `Skill not installed: ${skillName}` };
  }

  // Check if it's a copy-mode install
  const copyStatus = getCopyInstallStatus(skillPath);
  if (copyStatus.isCopy) {
    return uninstallCopySkill(skillPath);
  }

  // Check if it's a symlink
  const stat = fs.lstatSync(skillPath);
  if (stat.isSymbolicLink()) {
    removeSkillSymlink(skillPath);
    return { success: true, mode: 'symlink' };
  }

  // Not a symlink, no manifest — refuse to delete
  return { success: false, error: 'Not a managed install (no symlink, no manifest). Refusing to delete.' };
}

/**
 * Get detailed install status for a skill in a project.
 */
function getInstallStatus(skillName, projectPath) {
  const sDir = findProjectSkillsDir(projectPath || undefined);
  const skillPath = path.join(sDir, skillName);

  if (!fs.existsSync(skillPath)) {
    return { success: true, data: { installed: false, skillName } };
  }

  // Check copy mode first
  const copyStatus = getCopyInstallStatus(skillPath);
  if (copyStatus.isCopy) {
    return {
      success: true,
      data: {
        installed: true,
        skillName,
        mode: 'copy',
        installPath: skillPath,
        installedAt: copyStatus.manifest?.installedAt || null,
        sourcePath: copyStatus.manifest?.sourcePath || null,
      },
    };
  }

  // Check symlink
  const s = getSymlinkStatus(skillPath);
  return {
    success: true,
    data: {
      installed: true,
      skillName,
      mode: 'symlink',
      linkPath: skillPath,
      isLink: s.isLink,
      isValid: s.isValid,
      hasSkillMd: s.hasSkillMd,
      targetPath: s.target,
    },
  };
}

function checkSkillStatus(skillName) {
  let cwd = process.cwd(); let root = cwd;
  while (cwd !== path.parse(cwd).root) { if (fs.existsSync(path.join(cwd, '.git'))) { root = cwd; break; } cwd = path.dirname(cwd); }
  const lp = path.join(root, '.claude', 'skills', skillName);
  if (!fs.existsSync(lp)) return { success: true, data: { installed: false, skillName } };
  const s = getSymlinkStatus(lp);
  return { success: true, data: { installed: true, skillName, linkPath: lp, isLink: s.isLink, isValid: s.isValid, hasSkillMd: s.hasSkillMd } };
}

async function initMarketplace() {
  const config = getConfig();
  const cacheDir = path.join(os.homedir(), '.kungeskills', 'cache', 'marketplace');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  if (fs.existsSync(path.join(cacheDir, '.git'))) fs.rmSync(cacheDir, { recursive: true, force: true });
  await cloneRepo(config.marketplace.url, cacheDir, config.marketplace.branch || 'main');
  updateConfig({ ...config, marketplace: { ...config.marketplace, cloned: true, lastSync: new Date().toISOString() } });
  return { success: true, cacheDir };
}

async function updateMarketplace() {
  const cacheDir = path.join(os.homedir(), '.kungeskills', 'cache', 'marketplace');
  if (!fs.existsSync(path.join(cacheDir, '.git'))) return { success: false, error: 'Marketplace not initialized' };
  await pullRepo(cacheDir);
  const config = getConfig();
  updateConfig({ ...config, marketplace: { ...config.marketplace, lastSync: new Date().toISOString() } });
  return { success: true };
}

function cacheStatus() {
  const cacheDir = path.join(os.homedir(), '.kungeskills', 'cache', 'marketplace');
  const config = getConfig();
  return { valid: fs.existsSync(path.join(cacheDir, '.git')), cacheDir, hasBundled: fs.existsSync(path.join(pkgRoot, 'plugins')), lastSync: config.marketplace.lastSync, repoUrl: config.marketplace.url };
}

// [AGC:START] tool=Cc author=fangkun
/**
 * List available filesystem drives/volumes.
 * Windows: returns drive letters (C:\, D:\, etc.) via fsutil fsinfo drives.
 * Each drive includes `available: true/false` based on stat access.
 * Unix: returns single root '/' as the sole drive.
 */
function listDrives() {
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      const output = execSync('fsutil fsinfo drives', { encoding: 'utf-8' });
      // Parse "Drives: C:\ D:\ E:\" -> ["C:\\", "D:\\", "E:\\"]
      const match = output.match(/([A-Z]:\\)/gi);
      if (!match || match.length === 0) {
        return { success: false, error: 'No drives found' };
      }
      const drives = match
        .map(d => d.toUpperCase())
        .sort()
        .map(d => {
          let available = false;
          try {
            const s = fs.statSync(d);
            available = s.isDirectory();
          } catch { /* inaccessible drive */ }
          return { label: d, value: d, available };
        });
      return { success: true, data: { drives } };
    }
    // Unix: single root
    return { success: true, data: { drives: [{ label: '/', value: '/', available: true }] } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
// [AGC:END]

/**
 * List directories at a given path for the directory picker.
 * Returns subdirectories with their label, value, and whether they have children.
 */
function listDirectories(dirPath) {
  // Resolve to absolute path
  const resolved = path.resolve(dirPath || '/')
  if (!fs.existsSync(resolved)) {
    return { success: false, error: `Path not found: ${resolved}` }
  }
  const stat = fs.statSync(resolved)
  if (!stat.isDirectory()) {
    return { success: false, error: `Not a directory: ${resolved}` }
  }
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({
        label: e.name,
        value: path.join(resolved, e.name),
        isLeaf: false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return {
      success: true,
      data: { path: resolved, children: dirs, parent: path.dirname(resolved) },
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// [AGC:START] tool=Cc author=fangkun
/**
 * List installed skills from the default .claude/skills/ directory.
 * Returns skills with their actual install paths (not marketplace source paths).
 */
function listInstalledSkills() {
  const skillsDir = findProjectSkillsDir();
  if (!fs.existsSync(skillsDir)) {
    return [];
  }
  const installed = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || !entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name);
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    // Read SKILL.md to extract metadata
    const content = fs.readFileSync(skillMd, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);

    // Check install mode
    let mode = 'unknown';
    try {
      const lstat = fs.lstatSync(skillPath);
      if (lstat.isSymbolicLink()) {
        mode = 'symlink';
      } else {
        const manifestPath = path.join(skillPath, '.install-manifest.json');
        if (fs.existsSync(manifestPath)) {
          mode = 'copy';
        }
      }
    } catch { /* skip */ }

    installed.push({
      skillName: entry.name,
      pluginName: '',
      sourcePath: skillPath,
      installPath: skillPath,
      installMode: mode,
      pluginDescription: descMatch ? descMatch[1].trim() : '',
      pluginAuthor: '',
      pluginLicense: '',
      pluginCategory: '',
      pluginKeywords: [],
    });
  }
  return installed;
}
// [AGC:END]

// [AGC:START] tool=Cc author=fangkun
/**
 * List a skill directory as a tree structure for the file browser.
 */
function listSkillDirectory(dirPath) {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    return { success: false, error: `Path not found: ${resolved}` };
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return { success: false, error: `Not a directory: ${resolved}` };
  }
  try {
    const node = buildDirectoryNode(resolved);
    return { success: true, data: node };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function buildDirectoryNode(dirPath) {
  const name = path.basename(dirPath);
  const node = { name, path: dirPath, type: 'directory', children: [] };
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Only return directory metadata, do NOT recurse - client loads lazily
      node.children.push({ name: entry.name, path: fullPath, type: 'directory', isLeaf: false });
    } else {
      node.children.push({ name: entry.name, path: fullPath, type: 'file', isLeaf: true });
    }
  }
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return node;
}

/**
 * List files in a skill directory with metadata.
 */
function listSkillFiles(dirPath) {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    return { success: false, error: `Path not found: ${resolved}` };
  }
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true, recursive: true });
    const files = entries
      .filter(e => e.isFile() && !e.name.startsWith('.'))
      .map(e => {
        const fullPath = path.resolve(resolved, typeof e === 'string' ? e : path.join(e.path || resolved, e.name));
        const stat = fs.statSync(fullPath);
        return { name: e.name, path: fullPath, size: stat.size, lastModified: stat.mtimeMs, isDirectory: false, extension: path.extname(e.name) };
      });
    return { success: true, data: files };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Read a file's content by path.
 */
function readFileContent(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return { success: false, error: `File not found: ${resolved}` };
  }
  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    const stat = fs.statSync(resolved);
    return { success: true, data: { content, path: resolved, lastModified: stat.mtimeMs } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Save a single file's content with optimistic locking.
 */
function saveFileContent(filePath, content, expectedMtime) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return { success: false, error: `File not found: ${resolved}` };
  }
  try {
    if (expectedMtime != null) {
      const s = fs.statSync(resolved);
      if (s.mtimeMs !== expectedMtime) {
        return { success: false, error: 'File was modified externally', conflict: true, currentContent: fs.readFileSync(resolved, 'utf-8') };
      }
    }
    fs.writeFileSync(resolved, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Batch save multiple files with optimistic locking.
 */
function batchSaveFiles(fileOperations) {
  const result = { success: true, saved: [], failed: [], conflicts: [] };
  for (const op of fileOperations) {
    const r = saveFileContent(op.path, op.content, op.expectedMtime);
    if (r.success) {
      result.saved.push(op.path);
    } else if (r.conflict) {
      result.conflicts.push({ path: op.path, currentContent: r.currentContent });
      result.success = false;
      break;
    } else {
      result.failed.push({ path: op.path, error: r.error });
      result.success = false;
    }
  }
  return { success: result.success, data: result };
}
// [AGC:END]

// ---------- HTTP Server ----------

// Internal prompt server
let promptServerPort = null;

function createServer(port) {
  return http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Proxy /api/v1/* and /health to internal prompt server
    if (pathname.startsWith('/api/v1/') || pathname === '/health') {
      if (!promptServerPort) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Prompt server not ready' }));
        return;
      }
      const targetPath = parsed.path;
      const options = {
        hostname: '127.0.0.1',
        port: promptServerPort,
        path: targetPath,
        method: req.method,
        headers: { ...req.headers, host: '127.0.0.1' },
      };
      const proxyReq = http.request(options);
      proxyReq.on('response', (proxyRes) => {
        const headers = { ...proxyRes.headers };
        delete headers['transfer-encoding'];
        if (headers['content-type']?.includes('text/event-stream')) {
          headers['Content-Type'] = 'text/event-stream';
          headers['Cache-Control'] = 'no-cache';
          headers['Connection'] = 'keep-alive';
        }
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
      });
      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Proxy error: ${err.message}` }));
        } else {
          res.end();
        }
      });
      if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(proxyReq, { end: true });
      } else {
        proxyReq.end();
      }
      return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      const handle = async () => {
        try {
          let body;
          if (req.method === 'POST') {
            body = await new Promise((resolve, reject) => {
              let d = ''; req.on('data', c => d += c); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch(e) { reject(e); } });
            });
          }
          let result;
          switch (pathname) {
            case '/api/marketplace/plugins': result = { success: true, data: listPlugins() }; break;
            case '/api/marketplace/skills': result = { success: true, data: listAllSkills() }; break;
            case '/api/marketplace/search': result = { success: true, data: searchSkills(body?.query || '', body?.filters || {}) }; break;
            case '/api/marketplace/installed': result = { success: true, data: listInstalledSkills() }; break;
            case '/api/skill/read': result = { success: true, data: readSkill(body.skillPath) }; break;
            case '/api/skill/save': result = saveSkill(body.skillPath, body.content, body.expectedMtime); break;
            case '/api/skill/validate': result = { success: true, data: validateSkillMd(body.content) }; break;
            case '/api/skill/install': result = installSkillWithMode(body.skillName, body.projectPath, body.mode || 'symlink', body.targetDir || ''); break;
            case '/api/skill/uninstall': result = uninstallSkillUnified(body.skillName, body.projectPath); break;
            case '/api/skill/status': result = getInstallStatus(body.skillName, body.projectPath); break;
            case '/api/skill/default-dir': result = { success: true, data: { defaultDir: findProjectSkillsDir(body?.projectPath || undefined) } }; break;
            case '/api/fs/drives': result = listDrives(); break;
            case '/api/fs/dirs': result = listDirectories(body?.path || '/'); break;
            case '/api/skill/dir': result = listSkillDirectory(body?.path || '/'); break;
            case '/api/skill/files': result = listSkillFiles(body?.path || '/'); break;
            case '/api/skill/read-file': result = readFileContent(body?.path || ''); break;
            case '/api/skill/save-file': result = saveFileContent(body?.path || '', body?.content || '', body?.expectedMtime); break;
            case '/api/skill/batch-save': result = batchSaveFiles(body?.files || []); break;
            // Deprecated aliases — use /api/skill/* instead
            case '/api/symlink/install': result = installSkill(body.skillName, body.projectPath); break;
            case '/api/symlink/uninstall': result = uninstallSkill(body.skillName, body.projectPath); break;
            case '/api/symlink/status': result = checkSkillStatus(body.skillName); break;
            case '/api/git/init': result = await initMarketplace(); break;
            case '/api/git/update': result = await updateMarketplace(); break;
            case '/api/git/cache-status': result = { success: true, data: cacheStatus() }; break;
            default: result = { success: false, error: 'Not found' };
          }
          res.writeHead(result.success ? 200 : (result.error ? 400 : 200));
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      };
      handle();
      return;
    }

    // Serve static files from renderer/dist
    let filePath = path.join(rendererDist, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      // SPA fallback: serve index.html for client-side routes (no file extension)
      const ext = path.extname(pathname);
      if (!ext) {
        filePath = path.join(rendererDist, 'index.html');
      } else {
        res.writeHead(404); res.end('Not found'); return;
      }
    }

    const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');

    if (ext === '.html') {
      // Inject window.api bridge script before </body>
      let html = fs.readFileSync(filePath, 'utf-8');
      const bridgeScript = `<script>
window.api = {
  _base: '/api',
  _post: async function(path, body) {
    const r = await fetch(this._base + path, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {}) });
    return r.json();
  },
  listMarketplacePlugins: function() { return this._post('/marketplace/plugins'); },
  listSkills: function() { return this._post('/marketplace/skills'); },
  searchSkills: function(q, f) { return this._post('/marketplace/search', { query: q, filters: f }); },
  readSkillContent: function(p) { return this._post('/skill/read', { skillPath: p }); },
  saveSkillContent: function(p, c, m) { return this._post('/skill/save', { skillPath: p, content: c, expectedMtime: m }); },
  validateSkillMd: function(c) { return this._post('/skill/validate', { content: c }); },
  installSkill: function(n, p) { return this._post('/symlink/install', { skillName: n, projectPath: p }); },
  installSkillWithMode: function(n, p, m, td) { return this._post('/skill/install', { skillName: n, projectPath: p, mode: m, targetDir: td }); },
  uninstallSkill: function(n, p) { return this._post('/skill/uninstall', { skillName: n, projectPath: p }); },
  checkSkillStatus: function(n) { return this._post('/symlink/status', { skillName: n }); },
  checkInstallStatus: function(n, p) { return this._post('/skill/status', { skillName: n, projectPath: p }); },
  getDefaultDir: function(p) { return this._post('/skill/default-dir', { projectPath: p }); },
  listDrives: function() { return this._post('/fs/drives', {}); },
  listDirs: function(p) { return this._post('/fs/dirs', { path: p }); },
  initMarketplace: function() { return this._post('/git/init'); },
  updateMarketplace: function() { return this._post('/git/update'); },
  checkCacheStatus: function() { return this._post('/git/cache-status'); },
  listInstalledSkills: function() { return this._post('/marketplace/installed'); },
  listSkillDirectory: function(p) { return this._post('/skill/dir', { path: p }); },
  listSkillFiles: function(p) { return this._post('/skill/files', { path: p }); },
  readSkillFile: function(p) { return this._post('/skill/read-file', { path: p }); },
  saveSkillFile: function(p, c, m) { return this._post('/skill/save-file', { path: p, content: c, expectedMtime: m }); },
  batchSaveFiles: function(files) { return this._post('/skill/batch-save', { files }); },
  onFileChanged: function() { return function() {}; }
};
</script></body>`;
      html = html.replace('</body>', bridgeScript);
      res.end(html);
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

async function cmdWeb() {
  if (!fs.existsSync(rendererDist)) {
    logger.error('Renderer not built. Run: cd web && npm run build');
    process.exit(1);
  }

  // Find available port starting from 3010
  let port = 3010;
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        const srv = http.createServer();
        srv.listen(port, '127.0.0.1', () => { srv.close(resolve); });
        srv.on('error', (e) => { if (e.code === 'EADDRINUSE') reject(e); else reject(e); });
      });
      break; // port available
    } catch (e) { port++; }
  }

  // Start internal prompt server
  await startInternalPromptServer();

  const server = createServer(port);

  await new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      logger.success(`KungeSkill Web running at http://127.0.0.1:${port}`);
      logger.info('Press Ctrl+C to stop');

      // Open browser
      const { exec } = require('child_process');
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} http://127.0.0.1:${port}`);
      resolve();
    });
    server.on('error', reject);
  });
}

/**
 * Start the prompt Express server internally and proxy /api/v1/* to it.
 */
async function startInternalPromptServer() {
  const { spawn } = require('child_process');

  logger.info('Starting Prompt Optimizer server...');

  const serverDir = path.resolve(__dirname, '../server');
  const serverEntry = path.join(serverDir, 'prompt-server.ts');
  const projectRoot = path.resolve(__dirname, '../..');

  // Find tsx
  const tsxPath = [
    path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ].find(p => fs.existsSync(p));

  if (!tsxPath) {
    logger.warn('tsx not found, prompt API will be unavailable');
    promptServerPort = 0;
    return;
  }

  // Find an available port for the internal prompt server
  let pPort = 0;
  for (let p = 3020; p < 3030; p++) {
    try {
      await new Promise((resolve, reject) => {
        const srv = http.createServer();
        srv.listen(p, '127.0.0.1', () => { srv.close(resolve); });
        srv.on('error', () => reject(new Error('in use')));
      });
      pPort = p;
      break;
    } catch { /* try next */ }
  }

  if (!pPort) {
    logger.warn('No available port for internal prompt server');
    promptServerPort = 0;
    return;
  }

  const child = spawn(process.execPath, [tsxPath, serverEntry], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: {
      ...process.env,
      PORT: String(pPort),
      NODE_ENV: 'production',
      DATA_DIR: process.env.DATA_DIR || path.join(projectRoot, 'data'),
    },
    cwd: projectRoot,
  });

  // Forward child stdout
  child.stdout.on('data', (data) => process.stdout.write(data.toString()));

  // Wait for server to be ready by polling
  const start = Date.now();
  logger.info(`Waiting for Prompt API to be ready on port ${pPort}...`);
  while (Date.now() - start < 50000) {
    try {
      await new Promise((resolve, reject) => {
        const testReq = http.get(`http://127.0.0.1:${pPort}/health`, (res) => {
          resolve();
        });
        testReq.on('error', () => reject(new Error('not ready')));
        testReq.setTimeout(500, () => { testReq.destroy(); reject(new Error('timeout')); });
      });
      promptServerPort = pPort;
      logger.success(`Prompt API ready on internal port ${pPort}`);
      return;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 100));
  }

  logger.warn('Prompt server did not start within 5 seconds');
  promptServerPort = 0;
}

module.exports = { cmdWeb, createServer };
// [AGC:END]
