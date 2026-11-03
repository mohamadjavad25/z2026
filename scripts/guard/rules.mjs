// The hard rules of CLAUDE.md that a machine can check, as pure functions (tested in tests/unit/guardRules.test.js).
// check-rules.mjs feeds them the lines a change adds and the state of the tree; a "block" stops the commit or the
// CI run, a "warn" is printed and lets it through. Keep every rule here short and tied to a line in CLAUDE.md.

/** Files that talk ABOUT the rules (and so quote the forbidden words) are not checked for them. */
const RULE_TEXT_FILES = [/^CLAUDE(\.local)?\.md$/, /^scripts\/guard\//, /^tests\/unit\/guardRules\.test\.js$/, /^\.claude\//];
const isRuleText = (file) => RULE_TEXT_FILES.some((re) => re.test(file));

const WRONG_NAMES = /farfaroo|frfru|zibaban|زیبابان/i;
const isApp = (file) => /^app\//.test(file);
const isAdmin = (file) => /^app\/(.*\/)?admin/.test(file) || /\/admin[-\w]*\.css$/.test(file);
const isStyleOrUi = (file) => /\.(css|jsx?|mjs)$/.test(file);
// A colour written by hand: #abc / #aabbcc / #aabbccdd, or rgb()/hsl() with a literal number.
const CSS_HEX = /(^|[^&\w])#[0-9a-f]{3}([0-9a-f]{3}([0-9a-f]{2})?)?\b/i;
const JS_HEX = /["'`]#[0-9a-f]{3}([0-9a-f]{3}([0-9a-f]{2})?)?["'`]/i;
const LITERAL_FN = /\b(rgba?|hsla?)\(\s*\d/i;

/**
 * @param {{ file: string, line: number, text: string }[]} added  lines the change adds
 * @returns {{ level: "block" | "warn", rule: string, file: string, line: number, text: string }[]}
 */
export function checkAddedLines(added) {
  const out = [];
  const hit = (level, rule, a) => out.push({ level, rule, file: a.file, line: a.line, text: a.text.trim().slice(0, 140) });
  for (const a of added) {
    const { file, text } = a;
    if (!isRuleText(file) && !file.endsWith(".md") && WRONG_NAMES.test(text)) hit("block", "The name is frfro / «فرفرو»; never Farfaroo, Frfru, Zibaban or «زیبابان».", a);
    if (isApp(file) && /دنبال\s?کردن/.test(text)) hit("block", "The UI word for connecting is «وصل شدن», never «دنبال کردن».", a);
    if (file === "app/features/landing/constants.js" && /APP_DOWNLOADS_OPEN\s*=/.test(text)) hit("block", "APP_DOWNLOADS_OPEN changes only when the owner says so in this conversation.", a);
    if (/build\.gradle$/.test(file) && /^\s*versionName\b/.test(text) && !/versionName\s+"1\.0\.0"/.test(text)) hit("block", "App versionName stays \"1.0.0\" (owner's rule); raise only versionCode.", a);
    if (isApp(file) && isStyleOrUi(file) && file !== "app/styles/tokens.css" && !isAdmin(file)) {
      const code = text.replace(/\/\*.*?\*\/|\/\/.*$/g, ""); // comments may name a colour
      if (file.endsWith(".css")) {
        // CSS: a block (DESIGN_SYSTEM.md). A mask's #000 is alpha, not a colour; photo scrims and QR use their tokens.
        if (!/mask/i.test(code) && (CSS_HEX.test(code) || LITERAL_FN.test(code))) {
          hit("block", "No hard-coded colours in CSS: use a token from app/styles/tokens.css (docs/DESIGN_SYSTEM.md).", a);
        }
      } else if (JS_HEX.test(code)) {
        // JS: canvas drawings, illustrations and QR legitimately need literal colours, so only a reminder.
        hit("warn", "A colour written by hand in JS: fine for a canvas, illustration or QR; otherwise use a token.", a);
      }
    }
    if (/^app\/styles\/legacy\//.test(file)) hit("warn", "New style in app/styles/legacy (a debt in docs/HEALTH.md); put it in the feature's own CSS if you can.", a);
  }
  return out;
}

/**
 * @param {{ trackedFiles: string[], baseMigrations?: string[], newMigrations?: string[] }} tree
 *   trackedFiles: every file in the change's tree; baseMigrations: migration files on main;
 *   newMigrations: migration files this change adds
 */
export function checkTree({ trackedFiles, baseMigrations = [], newMigrations = [] }) {
  const out = [];
  const block = (rule, file = "") => out.push({ level: "block", rule, file, line: 0, text: "" });
  for (const f of trackedFiles) {
    if (/\.(jks|keystore|p12)$/i.test(f) || /keystore\.properties$/.test(f)) block("The release signing key is never committed.", f);
  }
  const num = (f) => (f.match(/^migrations\/(\d+)_/) || [])[1];
  // Old duplicates already on main (038) ran long ago; only a new migration may not share a number.
  for (const f of newMigrations) {
    const twin = trackedFiles.find((g) => g !== f && num(g) === num(f));
    if (twin) block(`Migration number ${num(f)} is already taken by ${twin}; take a number above every migration on main and open branches.`, f);
  }
  const topOnMain = Math.max(0, ...baseMigrations.map((f) => Number(num(f)) || 0));
  for (const f of newMigrations) {
    if (Number(num(f)) <= topOnMain) block(`New migration ${f} is not above the highest on main (${topOnMain}).`, f);
  }
  return out;
}

/** Turns `git diff -U0` output into added lines with their file and line number. */
export function parseAddedLines(diff) {
  const out = [];
  let file = null;
  let line = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) { file = raw.slice(4).replace(/^b\//, ""); if (file === "/dev/null") file = null; continue; }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (file && raw.startsWith("+")) { out.push({ file, line, text: raw.slice(1) }); line += 1; }
  }
  return out;
}
