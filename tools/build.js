#!/usr/bin/env node
// Packs the app: copies its files (not the tools, the README, git …) to build/app, then signs and
// packs them into build/VITranslator.wgt with the Tizen CLI and a certificate profile made in
// Tizen Studio's Certificate Manager.
//
//   node tools/build.js <certificate profile>
//
// The Tizen CLI is tizen-studio/tools/ide/bin/tizen(.bat): on the PATH, or found from TIZEN_STUDIO.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const profile = process.argv[2];
if (!profile) {
  console.error("usage: node tools/build.js <certificate profile>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const out = path.join(root, "build", "app");
const FILES = ["config.xml", "index.html", "icon.png", "logo.png", "FONT-LICENSE-Changa.txt", "css", "js", "fonts"];

fs.rmSync(path.join(root, "build"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });

const win = process.platform === "win32";
const home = process.env.TIZEN_STUDIO || (win ? "C:\\tizen-studio" : path.join(require("os").homedir(), "tizen-studio"));
let cli = path.join(home, "tools", "ide", "bin", win ? "tizen.bat" : "tizen");
if (!fs.existsSync(cli)) cli = win ? "tizen.bat" : "tizen";

execFileSync(cli, ["package", "-t", "wgt", "-s", profile, "--", out], { stdio: "inherit", shell: win });
const wgt = fs.readdirSync(out).find((f) => f.endsWith(".wgt"));
if (!wgt) throw new Error("no .wgt made");
fs.renameSync(path.join(out, wgt), path.join(root, "build", "VITranslator.wgt"));
console.log("build/VITranslator.wgt");
