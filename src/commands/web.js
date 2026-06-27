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
const { createSkillSymlink, removeSkillSymlink, getSymlinkStatus } = require('../core/symlink.js');
const { findProjectSkillsDir } = require('../commands/shared.js');
const { cloneRepo, pullRepo } = require('../utils/git.js');
const { getConfig, updateConfig } = require('../core/config.js');

const pkgRoot = path.resolve(__dirname, '../..');
const rendererDist = path.join(pkgRoot, 'electron', 'renderer', 'dist');

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
      let skillCount = 0;
      if (fs.existsSync(sDir)) skillCount = fs.readdirSync(sDir).filter(d => {
        const f = path.join(sDir, d); return fs.statSync(f).isDirectory() && fs.existsSync(path.join(f, 'SKILL.md'));
      }).length;
      all.push({ name: p.name, source: p.source, description: p.description, author: p.author?.name || 'Unknown', license: p.license || 'Unknown', category: p.category || 'other', keywords: p.keywords || [], skillCount, sourceDir: path.join(sd, p.source) });
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
  const sDir = findProjectSkillsDir(projectPath || undefined);
  const lp = path.join(sDir, skillName);
  const skill = findSkillMerged(getAllMarketplaceDirs(), skillName);
  if (!skill) return { success: false, error: 'Skill not found: ' + skillName };
  createSkillSymlink(skill.sourcePath, lp);
  return { success: true, linkPath: lp, targetPath: skill.sourcePath };
}

function uninstallSkill(skillName, projectPath) {
  const sDir = findProjectSkillsDir(projectPath || undefined);
  removeSkillSymlink(path.join(sDir, skillName));
  return { success: true };
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

// ---------- HTTP Server ----------

function createServer(port) {
  return http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

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
            case '/api/skill/read': result = { success: true, data: readSkill(body.skillPath) }; break;
            case '/api/skill/save': result = saveSkill(body.skillPath, body.content, body.expectedMtime); break;
            case '/api/skill/validate': result = { success: true, data: validateSkillMd(body.content) }; break;
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
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }

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
  uninstallSkill: function(n, p) { return this._post('/symlink/uninstall', { skillName: n, projectPath: p }); },
  checkSkillStatus: function(n) { return this._post('/symlink/status', { skillName: n }); },
  initMarketplace: function() { return this._post('/git/init'); },
  updateMarketplace: function() { return this._post('/git/update'); },
  checkCacheStatus: function() { return this._post('/git/cache-status'); },
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
    logger.error('Renderer not built. Run: cd electron/renderer && npm run build');
    process.exit(1);
  }

  // Find available port
  const startPort = 3010;
  const server = createServer(startPort);

  await new Promise((resolve, reject) => {
    server.listen(startPort, '127.0.0.1', () => {
      logger.success(`KungeSkill Web running at http://127.0.0.1:${startPort}`);
      logger.info('Press Ctrl+C to stop');

      // Open browser
      const open = require('child_process').exec;
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      open(`${cmd} http://127.0.0.1:${startPort}`);
      resolve();
    });
    server.on('error', reject);
  });
}

module.exports = { cmdWeb, createServer };
// [AGC:END]
