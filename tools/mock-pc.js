#!/usr/bin/env node
// A stand-in for VI Translator on the PC, to try the app in a browser (or the TV emulator)
// without the PC app: the TV side of the protocol, with a translation that changes every few
// seconds.
//
//   node tools/mock-pc.js [code] [port]
//
// - :8791 (or [port]) is "the PC": POST /vit-tv/offer, /tv, /tv.json, /tv/forget. With a code given, it
//   accepts that code as if typed in "Connect a TV" (otherwise GET /mock/connect?code=123456).
//   GET /mock/remove removes the TV (its next request gets a 403).
// - It also serves this app's files, for a browser: open http://<this PC's address>:<port>/.
//   In a browser there's no TV to say its address: the app tries the address it was opened at
//   (port 8791), or the one in ?pc=<address>:<port>.
//
// Browsers need CORS; the TV doesn't (its app may ask any host it lists in config.xml), so the
// headers below are for the browser only.

"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let pending = process.argv[2] || ""; // the code typed on the PC, while connecting
const PORT = +(process.argv[3] || 8791);
let wrong = 0;
const tokens = new Set();
const root = path.join(__dirname, "..");

function send(res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "X-VIT, Content-Type",
  });
  res.end(body);
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:sans-serif}
#t{position:absolute;left:0;right:0;bottom:12%;text-align:center;font-size:52px;color:#fff;
text-shadow:0 0 6px #000,0 0 3px #000}</style></head><body><div id="t"></div><script>
var k=new URLSearchParams(location.search).get("t");
setInterval(function(){fetch("tv.json?h=&t="+k,{cache:"no-store"}).then(function(r){return r.json()})
.then(function(s){document.getElementById("t").textContent=s.line})},1000);
</script></body></html>`;

const LINES = ["Mock PC: Welcome to Vice City.", "مرحبًا بك في فايس سيتي", "Bienvenido a Vice City."];

http
  .createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const t = u.searchParams.get("t") || "";
    if (req.method === "OPTIONS") return send(res, 204, "text/plain", "");
    if (u.pathname === "/mock/connect") {
      pending = u.searchParams.get("code") || "";
      wrong = 0;
      return send(res, 200, "text/plain", "waiting for " + pending + "\n");
    }
    if (u.pathname === "/mock/remove") {
      tokens.clear();
      return send(res, 200, "text/plain", "removed\n");
    }
    if (u.pathname === "/vit-tv/offer" && req.method === "POST") {
      if (req.headers["x-vit"] !== "1") return send(res, 403, "application/json", "{}");
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        let o = {};
        try {
          o = JSON.parse(body);
        } catch (e) {
          return send(res, 400, "application/json", "{}");
        }
        console.log("offer", o);
        if (!pending) return send(res, 404, "application/json", "{}");
        if (o.code !== pending) {
          if (++wrong >= 20) pending = "";
          return send(res, 403, "application/json", "{}");
        }
        pending = "";
        const token = crypto.randomBytes(32).toString("hex");
        tokens.add(token);
        console.log("connected", o.name);
        send(res, 200, "application/json", JSON.stringify({ pc_name: "MOCK-PC", token }));
      });
      return;
    }
    if (["/tv", "/tv.json", "/tv/forget"].includes(u.pathname) && !tokens.has(t)) return send(res, 403, "text/plain", "");
    if (u.pathname === "/tv") return send(res, 200, "text/html", PAGE);
    if (u.pathname === "/tv.json") {
      const line = LINES[Math.floor(Date.now() / 4000) % LINES.length];
      return send(res, 200, "application/json", JSON.stringify({ overlays: true, areas: [], line }));
    }
    if (u.pathname === "/tv/forget") {
      tokens.delete(t);
      return send(res, 200, "application/json", "{}");
    }
    if (req.method === "GET" && serveApp(u.pathname, res)) return;
    send(res, 404, "application/json", "{}");
  })
  .listen(PORT, "0.0.0.0", () => console.log("mock PC on :" + PORT + (pending ? ", accepting code " + pending : "")));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf" };
/** This app's files, next to "the PC" (one origin: nothing for the browser to block). */
function serveApp(pathname, res) {
  const p = path.normalize(decodeURIComponent(pathname)).replace(/^[\\/]+/, "") || "index.html";
  if (!/^(index\.html|logo\.png|css[\\/]|js[\\/]|fonts[\\/])/.test(p)) return false;
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return false;
  send(res, 200, TYPES[path.extname(f)] || "application/octet-stream", fs.readFileSync(f));
  return true;
}
