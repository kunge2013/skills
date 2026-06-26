'use strict';

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function _colorize(color, msg) {
  return `${COLORS[color]}${msg}${COLORS.reset}`;
}

function info(msg) {
  console.log(_colorize('white', msg));
}

function success(msg) {
  console.log(_colorize('green', msg));
}

function error(msg) {
  console.error(_colorize('red', msg));
}

function warn(msg) {
  console.log(_colorize('yellow', msg));
}

function status(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function dim(msg) {
  console.log(_colorize('gray', msg));
}

function header(msg) {
  console.log(_colorize('bold', msg));
}

function table(headers, rows) {
  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxInCol = Math.max(
      h.length,
      ...rows.map(r => (r[i] || '').length)
    );
    return maxInCol;
  });

  // Print headers
  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i]))
    .join('  ');
  console.log(_colorize('bold', headerLine));

  // Print separator
  const sepLine = widths.map(w => '─'.repeat(w)).join('  ');
  console.log(_colorize('gray', sepLine));

  // Print rows
  for (const row of rows) {
    const line = row
      .map((cell, i) => (cell || '').padEnd(widths[i]))
      .join('  ');
    console.log(line);
  }
}

module.exports = {
  info,
  success,
  error,
  warn,
  status,
  dim,
  header,
  table
};
