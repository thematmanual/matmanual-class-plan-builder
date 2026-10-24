// Class Plan Builder splice: keeps index.html self-contained.
// Splices logic.js into the <script id="logic"> block of index.html
// and verifies the inline copy is byte-identical to logic.js.
// Run: node splice.js [--check]   (--check verifies without writing)
const fs = require("fs");
const DIR = process.env.CPB_DIR || __dirname;
const htmlPath = DIR + "/index.html";
const checkOnly = process.argv.includes("--check");

const logic = fs.readFileSync(DIR + "/logic.js", "utf8");
let html = fs.readFileSync(htmlPath, "utf8");

const logicRe = /(<script id="logic">\n)([\s\S]*?)(\n<\/script>)/;
if (!logicRe.test(html)) { console.error("logic script block not found"); process.exit(1); }

const logicBody = logic.replace(/\n$/, "");
let changed = false;
if (html.match(logicRe)[2] !== logicBody) {
  html = html.replace(logicRe, (all, pre, body, post) => pre + logicBody + post);
  changed = true;
}
if (changed && !checkOnly) {
  fs.writeFileSync(htmlPath, html);
  console.log("spliced (index.html updated)");
} else {
  console.log(changed ? "STALE — index.html differs from logic.js (run without --check)" : "already in sync");
}

const finalHtml = checkOnly ? html : fs.readFileSync(htmlPath, "utf8");
const logicOk = finalHtml.match(logicRe)[2] === logicBody;
console.log("byte-identical inline logic:", logicOk);
if (!logicOk) process.exit(1);
