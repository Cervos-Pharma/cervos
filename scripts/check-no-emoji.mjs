#!/usr/bin/env node
// Fails if any emoji or pictograph appears in source files.
// Usage: node scripts/check-no-emoji.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src", "packages"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md", ".css"]);
const SKIP = new Set(["node_modules", ".next", "dist", "build", "coverage"]);
// Pictographs, dingbats, symbols, emoji modifiers, variation selector 16.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu;

const hits = [];
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (EXTS.has(extname(name))) {
      const lines = readFileSync(full, "utf8").split("\n");
      lines.forEach((line, i) => {
        const found = line.match(EMOJI);
        if (found) hits.push(`${full}:${i + 1}  ${found.join(" ")}`);
      });
    }
  }
}

ROOTS.forEach(walk);
if (hits.length) {
  console.log(`Emoji found: ${hits.length} line(s)`);
  hits.slice(0, 200).forEach((h) => console.log("  " + h));
  process.exit(1);
}
console.log("Emoji found: 0");
