#!/usr/bin/env node
'use strict';

// [AGC:START] tool=Cc author=fangkun
const { cmdInit } = require('./commands/init');
const { cmdList } = require('./commands/list');
const { cmdAdd } = require('./commands/add');
const { cmdRemove } = require('./commands/remove');
const { cmdView } = require('./commands/view');
const { cmdUpdate } = require('./commands/update');
const { cmdDoctor } = require('./commands/doctor');
const { cmdDashboard } = require('./commands/dashboard');
const { cmdWeb } = require('./commands/web');
const logger = require('./utils/logger');

const VERSION = '0.1.0';
const USAGE = `
Usage: kungeskill <command> [options]

Commands:
  init               Initialize marketplace cache
  list               List available skills in the marketplace
    --installed        Show only installed skills in this project
  add <skill>        Install a skill via symlink
    --force            Reinstall even if already installed
  remove <skill>     Remove a skill symlink from this project
  view               Show installed skills with health status
  update             Update marketplace cache via git pull
  dashboard          Launch desktop UI
  web                Launch web UI in browser (same as dashboard)
  doctor             Check symlink health and cache status

Options:
  --help, -h         Show help
  --version, -v      Show version
`;

function parseArgs(argv) {
  const args = argv.slice(2); // skip node and script path
  const result = { command: null, positional: [], flags: {} };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.flags.version = true;
    } else if (arg === '--installed') {
      result.flags.installed = true;
    } else if (arg === '--force') {
      result.flags.force = true;
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.flags.help) {
    console.log(USAGE.trim());
    return;
  }

  if (parsed.flags.version) {
    console.log(`kungeskill v${VERSION}`);
    return;
  }

  if (!parsed.command) {
    console.log(USAGE.trim());
    process.exit(0);
  }

  try {
    switch (parsed.command) {
      case 'init':
        await cmdInit();
        break;

      case 'list':
        cmdList({ installed: parsed.flags.installed });
        break;

      case 'add': {
        const skillName = parsed.positional[0];
        if (!skillName) {
          logger.error('Missing skill name. Usage: kungeskill add <skill>');
          process.exit(1);
        }
        await cmdAdd(skillName, { force: parsed.flags.force });
        break;
      }

      case 'remove': {
        const skillName = parsed.positional[0];
        if (!skillName) {
          logger.error('Missing skill name. Usage: kungeskill remove <skill>');
          process.exit(1);
        }
        cmdRemove(skillName);
        break;
      }

      case 'view':
        cmdView();
        break;

      case 'update':
        await cmdUpdate();
        break;

      case 'doctor':
        cmdDoctor();
        break;

      case 'dashboard':
        await cmdDashboard();
        break;

      case 'web':
        await cmdWeb();
        break;

      default:
        logger.error(`Unknown command: ${parsed.command}`);
        console.log(USAGE.trim());
        process.exit(1);
    }
  } catch (err) {
    logger.error(err.message || String(err));
    process.exit(1);
  }
}

main();
// [AGC:END]
