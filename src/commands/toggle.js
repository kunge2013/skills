#!/usr/bin/env node
'use strict';

// [AGC:START] tool=Cc author=fangkun
/**
 * CLI for skill enable/disable management (User-scope only).
 * Supports multiple providers (Claude Code and Pi Agent).
 *
 *   kungeskill toggle list [--json] [--provider <name>]     list skills grouped by owner/project with status
 *   kungeskill toggle on <name> [--provider <name>]         enable a skill
 *   kungeskill toggle off <name> [--provider <name>]        disable a skill
 *   kungeskill toggle owner <owner> on|off [--provider <name>]   batch toggle by owner
 *   kungeskill toggle project <owner> <project> on|off [--provider <name>]  batch toggle by project
 *   kungeskill toggle source add <owner/repo> [--providers <name1,name2>]  add external skill source
 *   kungeskill toggle source remove <owner/repo>  remove external skill source
 *   kungeskill toggle source list       list external skill sources
 *   kungeskill toggle source sync <owner/repo>  sync external source
 *
 * Disabling moves the skill directory into <provider>.skillsDir/.kungeskill-disabled/,
 * which the agent does not scan, so the skill is no longer loaded.
 */

const { listSkillToggleState, setSkillEnabled, setOwnerSkillsEnabled, setProjectSkillsEnabled } = require('../core/skill-toggle.js');
const { addExternalSource, removeExternalSource, listExternalSources, syncExternalSource, discoverExternalSkills } = require('../core/external-source.js');
const logger = require('../utils/logger');

const DEFAULT_PROVIDER = 'claude-code';

function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') flags.json = true;
    else if (a === '--provider' && args[i + 1]) {
      flags.provider = args[i + 1];
      i++;
    } else if (a === '--providers' && args[i + 1]) {
      flags.providers = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else positional.push(a);
  }
  return { positional, flags };
}

async function cmdToggle(argv) {
  const { positional, flags } = parseArgs(argv);
  const sub = positional[0];
  const provider = flags.provider || DEFAULT_PROVIDER;

  if (sub === 'list') {
    const state = listSkillToggleState(provider);
    if (flags.json) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    if (!state.groups.length) {
      logger.info(`No installed skills found for provider: ${provider}`);
      return;
    }
    logger.info(`Provider: ${provider}`);
    logger.info(`User skills directory: ${state.userSkillsDir}`);
    for (const g of state.groups) {
      logger.info(`[${g.owner}]  (${g.enabledCount}/${g.total} enabled)`);
      for (const proj of g.projects) {
        if (proj.projectPath) {
          logger.info(`  Project: ${proj.projectPath}  (${proj.enabledCount}/${proj.total} enabled)`);
        }
        for (const sk of proj.skills) {
          const mark = sk.enabled ? '[x]' : '[ ]';
          logger.info(`    ${mark} ${sk.skillName}  (${sk.installMode})`);
        }
      }
    }
    return;
  }

  if (sub === 'on' || sub === 'off') {
    const skillName = positional[1];
    if (!skillName) {
      logger.error(`Usage: kungeskill toggle ${sub} <skill> [--provider <name>]`);
      process.exitCode = 1;
      return;
    }
    const enabled = sub === 'on';
    const r = setSkillEnabled(skillName, enabled, provider);
    if (r.success) {
      logger.success(r.already ? `Already ${sub}: ${skillName}` : `${enabled ? 'Enabled' : 'Disabled'} ${skillName}`);
    } else {
      logger.error(r.error);
      process.exitCode = 1;
    }
    return;
  }

  if (sub === 'owner') {
    const owner = positional[1];
    const state = positional[2];
    if (!owner || (state !== 'on' && state !== 'off')) {
      logger.error('Usage: kungeskill toggle owner <owner> on|off [--provider <name>]');
      process.exitCode = 1;
      return;
    }
    const r = setOwnerSkillsEnabled(owner, state === 'on', provider);
    if (r.success) {
      logger.success(`${state === 'on' ? 'Enabled' : 'Disabled'} ${r.data.changed} skill(s) by ${owner}`);
    } else {
      for (const res of r.data.results) {
        if (!res.success) logger.error(`${res.skillName}: ${res.error}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  if (sub === 'project') {
    const owner = positional[1];
    const project = positional[2];
    const state = positional[3];
    if (!owner || !project || (state !== 'on' && state !== 'off')) {
      logger.error('Usage: kungeskill toggle project <owner> <project> on|off [--provider <name>]');
      process.exitCode = 1;
      return;
    }
    const r = setProjectSkillsEnabled(owner, project, state === 'on', provider);
    if (r.success) {
      logger.success(`${state === 'on' ? 'Enabled' : 'Disabled'} ${r.data.changed} skill(s) in ${owner}/${project}`);
    } else {
      for (const res of r.data.results) {
        if (!res.success) logger.error(`${res.skillName}: ${res.error}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  if (sub === 'source') {
    const sourceCmd = positional[1];
    const sourceStr = positional[2];

    if (sourceCmd === 'add') {
      if (!sourceStr) {
        logger.error('Usage: kungeskill toggle source add <owner/repo> [branch] [--providers <name1,name2>]');
        process.exitCode = 1;
        return;
      }
      const branch = positional[3] || 'main';
      const providers = flags.providers || [DEFAULT_PROVIDER];
      logger.info(`Adding external source: ${sourceStr} (branch: ${branch}, providers: ${providers.join(',')})...`);
      const r = await addExternalSource(sourceStr, branch, providers);
      if (r.success) {
        logger.success(`Added source: ${r.source.owner}/${r.source.repo}`);
        // Discover and list available skills
        const skills = discoverExternalSkills();
        const fromSource = skills.filter(s => s.owner === r.source.owner && s.repo === r.source.repo);
        if (fromSource.length > 0) {
          logger.info(`Found ${fromSource.length} skill(s):`);
          for (const s of fromSource) {
            const installed = s.installed ? ' (installed)' : '';
            logger.info(`  - ${s.projectPath ? s.projectPath + '/' : ''}${s.skillName}${installed}`);
          }
        }
      } else {
        logger.error(`Failed to add source: ${r.error}`);
        process.exitCode = 1;
      }
      return;
    }

    if (sourceCmd === 'remove') {
      if (!sourceStr) {
        logger.error('Usage: kungeskill toggle source remove <owner/repo>');
        process.exitCode = 1;
        return;
      }
      const parts = sourceStr.split('/');
      if (parts.length < 2) {
        logger.error('Invalid source format. Expected: owner/repo');
        process.exitCode = 1;
        return;
      }
      removeExternalSource(parts[0], parts[1]);
      logger.success(`Removed source: ${sourceStr}`);
      return;
    }

    if (sourceCmd === 'list') {
      const sources = listExternalSources();
      if (flags.json) {
        console.log(JSON.stringify(sources, null, 2));
        return;
      }
      if (!sources.length) {
        logger.info('No external sources configured.');
        return;
      }
      for (const s of sources) {
        const cached = s.cached ? 'cached' : 'not cached';
        const providers = (s.providers || [DEFAULT_PROVIDER]).join(',');
        logger.info(`${s.owner}/${s.repo} (${s.branch}) - ${cached} [providers: ${providers}]`);
        logger.info(`  URL: ${s.url}`);
      }
      return;
    }

    if (sourceCmd === 'sync') {
      if (!sourceStr) {
        logger.error('Usage: kungeskill toggle source sync <owner/repo>');
        process.exitCode = 1;
        return;
      }
      const parts = sourceStr.split('/');
      if (parts.length < 2) {
        logger.error('Invalid source format. Expected: owner/repo');
        process.exitCode = 1;
        return;
      }
      logger.info(`Syncing ${sourceStr}...`);
      const r = await syncExternalSource(parts[0], parts[1]);
      if (r.success) {
        logger.success(`Synced: ${sourceStr}`);
      } else {
        logger.error(`Failed to sync: ${r.error}`);
        process.exitCode = 1;
      }
      return;
    }

    logger.error('Usage: kungeskill toggle source add|remove|list|sync [args]');
    process.exitCode = 1;
    return;
  }

  logger.error('Usage: kungeskill toggle list|on|off|owner|project|source [args] [--json] [--provider <name>] [--providers <name1,name2>]');
  process.exitCode = 1;
}

module.exports = { cmdToggle };
// [AGC:END]
