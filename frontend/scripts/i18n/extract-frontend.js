/* Collect every interface message passed to t()/tr()/m()/tn() in the frontend.
 * Usage: node scripts/i18n/extract-frontend.js > scripts/i18n/frontend-messages.json
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app', 'components', 'lib'];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p);
  }
  return out;
}

const messages = new Map(); // message -> first file
const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

for (const file of DIRS.flatMap((d) => walk(path.join(ROOT, d)))) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (s) => {
    if (s && /[A-Za-z]/.test(s) && !messages.has(s)) messages.set(s, path.relative(ROOT, file).replace(/\\/g, '/'));
  };
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const fn = n.expression.text;
      if (fn === 't' || fn === 'tr' || fn === 'm' || fn === 'tRich') {
        add(literal(n.arguments[0]));
        // t(cond ? 'a' : 'b') forms
        const a = n.arguments[0];
        if (a && ts.isConditionalExpression(a)) { add(literal(a.whenTrue)); add(literal(a.whenFalse)); }
      } else if (fn === 'tn') {
        add(literal(n.arguments[1]));
        add(literal(n.arguments[2]));
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const out = [...messages.entries()].map(([message, file]) => ({ message, file })).sort((a, b) => a.message.localeCompare(b.message));
process.stdout.write(JSON.stringify(out, null, 1));
console.error(`frontend messages: ${out.length}`);
