#!/usr/bin/env node
// Makes js/strings.js: the interface strings in every language, taken from the Android TV app's
// res/values*/strings.xml (already translated there) and tools/tizen-strings.json (the few
// strings only this app has).
//
//   node tools/import-strings.js <path to vi-translator-android-tv>

"use strict";
const fs = require("fs");
const path = require("path");

const android = process.argv[2];
if (!android) {
  console.error("usage: node tools/import-strings.js <path to vi-translator-android-tv>");
  process.exit(1);
}
const res = path.join(android, "app", "src", "main", "res");
const root = path.join(__dirname, "..");

// the Android strings this app uses
const USED = ["enter_code", "where_on_pc", "this_tv", "connected_to", "looking_for", "overlays_off", "disconnect"];
// Android folder name -> language tag
function tag(dir) {
  if (dir === "values") return "en";
  let t = dir.slice("values-".length);
  if (t.startsWith("b+")) return t.slice(2).split("+").join("-"); // values-b+zh+Hans -> zh-Hans
  t = t.replace("-r", "-"); // values-pt-rBR -> pt-BR
  return t === "in" ? "id" : t;
}
// where a tag's Tizen-only strings come from, when not under its own tag
const ALIAS = { "es-MX": "es-419", "zh-CN": "zh-Hans", "zh-TW": "zh-Hant", "zh-HK": "zh-Hant", tl: "fil" };

function unescape(s) {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const extra = JSON.parse(fs.readFileSync(path.join(__dirname, "tizen-strings.json"), "utf8"));
const out = {};
for (const dir of fs.readdirSync(res).filter((d) => /^values(-|$)/.test(d)).sort()) {
  const file = path.join(res, dir, "strings.xml");
  if (!fs.existsSync(file)) continue;
  const xml = fs.readFileSync(file, "utf8");
  const t = tag(dir);
  const m = {};
  for (const [, name, value] of xml.matchAll(/<string name="([a-z_]+)"[^>]*>([\s\S]*?)<\/string>/g)) {
    if (USED.includes(name)) m[name] = unescape(value);
  }
  const more = extra[t] || extra[ALIAS[t]] || extra[t.split("-")[0]];
  if (!more) throw new Error(`no Tizen strings for ${t} (tools/tizen-strings.json)`);
  Object.assign(m, more);
  out[t] = m;
}
for (const name of [...USED, "input", "menu_hint", "no_hdmi"]) {
  if (!out.en[name]) throw new Error(`no English ${name}`);
}

const js =
  "// Made by tools/import-strings.js from the Android TV app's strings.xml: don't edit by hand.\n" +
  "var STRINGS = " +
  JSON.stringify(out, null, 1) +
  ";\n";
fs.writeFileSync(path.join(root, "js", "strings.js"), js);
console.log(`js/strings.js: ${Object.keys(out).length} languages`);
