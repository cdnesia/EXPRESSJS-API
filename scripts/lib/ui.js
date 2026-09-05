// Small terminal-output helpers shared by the CLI scripts — kept separate
// from the interactive flow so manage-client.js reads as prompts + logic,
// not string formatting.
const chalk = require('chalk');
const boxen = require('boxen');
const stringWidth = require('string-width');

// How much of the terminal width a box's content can never use: 2 for the
// left/right borders, plus 6 for padding — boxen v5's `padding: <number>`
// shorthand does NOT apply that number evenly; it multiplies the
// left/right side by 3 (padding: 1 becomes {left: 3, right: 3}, not {left:
// 1, right: 1}), so our `padding: 1` below costs 6 columns, not 2.
const BOX_OVERHEAD = 2 + 6;

// Mirrors boxen's own internal terminalColumns() fallback chain exactly
// (stdout.columns, then stderr.columns, then $COLUMNS, then 80) — our
// inline-vs-block decision has to agree with the width boxen itself will
// actually render at, or the two can disagree and reintroduce the bug.
function terminalColumns() {
  if (process.stdout && process.stdout.columns) return process.stdout.columns;
  if (process.stderr && process.stderr.columns) return process.stderr.columns;
  if (process.env.COLUMNS) return Number.parseInt(process.env.COLUMNS, 10);
  return 80;
}

function banner(title) {
  console.log(
    '\n' +
      boxen(chalk.bold.cyanBright(title), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
      })
  );
}

function section(title) {
  console.log('\n' + chalk.bold.whiteBright(title));
}

function kv(label, value) {
  console.log(`  ${chalk.dim(label.padEnd(12))} ${chalk.white(value)}`);
}

function scopeText(scopes) {
  if (!scopes || scopes.length === 0) return chalk.dim.italic('(tidak ada akses)');
  return scopes.map((s) => chalk.cyan(s)).join(chalk.dim(', '));
}

function success(text) {
  console.log(chalk.green(`✔ ${text}`));
}

function warn(text) {
  console.log(chalk.yellow(`⚠ ${text}`));
}

function error(text) {
  console.log(chalk.red(`✘ ${text}`));
}

// rows: [{ label, value, emphasize?, raw? }]. `raw` skips the default
// chalk.white wrap — use it when `value` is already styled (e.g. scopeText
// output). `emphasize` bolds+yellows the value — reserved for the secret
// itself, so it stands out from the surrounding context (clientId, scopes)
// shown in the same box.
//
// Each row goes on one line ONLY if it actually fits the current terminal
// width; otherwise the value drops to its own indented line below the
// label. This isn't just cosmetic wrapping — boxen v5 miscomputes its line
// separator and silently glues every row into one unreadable line when a
// row's width lands at/near the terminal's column count, which a bare
// label + 64-char clientSecret hits exactly at the common 80-column
// default. Checking real width here keeps rows inline whenever there's
// room and only breaks them up when that bug would otherwise trigger.
// Verified bug-free from 75 columns up (the practical floor — every
// mainstream terminal defaults to 80+); narrower than that, even the
// broken-up value line no longer fits and the same boxen bug can return.
function credentialsBox(rows) {
  const availableWidth = terminalColumns() - BOX_OVERHEAD;
  const lines = [];

  rows.forEach(({ label, value, emphasize, raw }) => {
    const valuePart = emphasize ? chalk.bold.yellowBright(value) : raw ? value : chalk.white(value);
    const labelPart = chalk.dim(label.padEnd(14));

    // Strictly less-than, not <=: boxen's own bug triggers when the content
    // width reaches exactly the available space, not just past it.
    if (stringWidth(labelPart) + stringWidth(valuePart) < availableWidth) {
      lines.push(`${labelPart}${valuePart}`);
    } else {
      lines.push(chalk.dim(label));
      lines.push(`  ${valuePart}`);
    }
  });

  console.log(
    '\n' +
      boxen(lines.join('\n'), {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'yellow',
        title: chalk.red.bold('SIMPAN SEKARANG'),
        titleAlignment: 'center',
      })
  );
  console.log(chalk.dim('  clientSecret di atas tidak akan ditampilkan lagi setelah ini.\n'));
}

module.exports = { banner, section, kv, scopeText, success, warn, error, credentialsBox };
