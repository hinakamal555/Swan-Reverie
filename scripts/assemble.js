#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CORE = path.join(ROOT, "core");
const TEMPLATE = path.join(ROOT, "template");
const SITE = path.join(ROOT, "site");

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeMeta(config) {
  const serverMeta = `module.exports = ${JSON.stringify({
    templateId: config.templateId,
    name: config.name,
    version: config.version,
    siteTitle: config.siteTitle,
    brandName: config.brandName,
    supportedFeatures: config.supportedFeatures || [],
    editor: config.editor || { sections: [], features: [] },
  }, null, 2)};\n`;
  write(path.join(SITE, "server", "lib", "template-meta.js"), serverMeta);

  const clientMeta = `window.__INVITE_TEMPLATE_ID__ = ${JSON.stringify(config.templateId)};
window.__INVITE_TEMPLATE_NAME__ = ${JSON.stringify(config.name)};
window.__INVITE_SITE_TITLE__ = ${JSON.stringify(config.siteTitle || config.name)};
window.__INVITE_BRAND_NAME__ = ${JSON.stringify(config.brandName || "Invitation Editor")};
window.__INVITE_EDITOR__ = ${JSON.stringify(config.editor || { sections: [], features: [] })};
window.__INVITE_SUPPORTED_FEATURES__ = ${JSON.stringify(config.supportedFeatures || [])};
window.__INVITE_DEFAULT_MUSIC_URL__ = ${JSON.stringify(config.defaultMusicUrl || "")};
`;
  write(path.join(SITE, "public", "js", "template-meta.js"), clientMeta);
}

function write(file, content) {
  mkdirp(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function patchHtml(filePath, config) {
  let html = fs.readFileSync(filePath, "utf8");
  html = html.replace(/__SITE_TITLE__/g, config.siteTitle || config.name);
  html = html.replace(/__BRAND_NAME__/g, config.brandName || "Invitation Editor");
  if (fs.existsSync(path.join(TEMPLATE, "styles.css"))) {
    if (!html.includes("/css/template.css")) {
      html = html.replace(
        "</head>",
        '  <link rel="stylesheet" href="/css/template.css">\n</head>'
      );
    }
  }
  if (!html.includes("/js/template-meta.js")) {
    const metaScript = '<script src="/js/template-meta.js"></script>';
    if (html.includes('<script src="/js/clerk-init.js"></script>')) {
      html = html.replace(
        '<script src="/js/clerk-init.js"></script>',
        `<script src="/js/clerk-init.js"></script>\n  ${metaScript}`
      );
    } else {
      html = html.replace(
        '<script src="/js/lib.js"></script>',
        `${metaScript}\n  <script src="/js/lib.js"></script>`
      );
    }
  }
  html = html.replace(
    /<script src="\/js\/templates\/(?!registry\.js|template\.js)[^"]+\"><\/script>\n?/g,
    ""
  );
  if (!html.includes("/js/templates/registry.js")) {
    const anchor = html.includes("/js/template-meta.js")
      ? '<script src="/js/template-meta.js"></script>'
      : '<script src="/js/lib.js"></script>';
    html = html.replace(
      anchor,
      `${anchor}\n  <script src="/js/templates/registry.js"></script>`
    );
  }
  if (!html.includes("/js/templates/template.js")) {
    html = html.replace(
      '<script src="/js/templates/registry.js"></script>',
      '<script src="/js/templates/registry.js"></script>\n  <script src="/js/templates/template.js"></script>'
    );
  }
  write(filePath, html);
}

function patchRender() {
  const src = path.join(TEMPLATE, "render.js");
  let code = fs.readFileSync(src, "utf8");
  code = code.replace(
    /window\.InvitationTemplates\.register\(\s*["'][^"']+["']/,
    "window.InvitationTemplates.register(window.__INVITE_TEMPLATE_ID__"
  );
  write(path.join(SITE, "public", "js", "templates", "template.js"), code);
}

function patchDefaults(config) {
  const src = path.join(TEMPLATE, "defaults.js");
  let code = fs.readFileSync(src, "utf8");
  code = code.replace(/const TEMPLATE_ID = "[^"]+";/, `const TEMPLATE_ID = "${config.templateId}";`);
  code = code.replace(/const TEMPLATE_VERSION = "[^"]+";/, `const TEMPLATE_VERSION = "${config.version}";`);
  write(path.join(SITE, "server", "lib", "defaults.js"), code);
}

function main() {
  const configPath = path.join(TEMPLATE, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("Missing template/config.json");
    process.exit(1);
  }
  const config = readJson(configPath);

  console.log(`Assembling site for template: ${config.templateId}`);
  rm(SITE);
  mkdirp(SITE);

  copyDir(path.join(CORE, "server"), path.join(SITE, "server"));
  copyDir(path.join(CORE, "public"), path.join(SITE, "public"));
  copyDir(path.join(CORE, "netlify"), path.join(SITE, "netlify"));
  patchDefaults(config);
  copyDir(path.join(TEMPLATE, "assets"), path.join(SITE, "public", "assets"));

  if (fs.existsSync(path.join(TEMPLATE, "styles.css"))) {
    copyFile(path.join(TEMPLATE, "styles.css"), path.join(SITE, "public", "css", "template.css"));
  }

  writeMeta(config);
  patchRender();

  for (const file of ["editor.html", "invitation.html", "index.html"]) {
    patchHtml(path.join(SITE, "public", file), config);
  }

  copyFile(path.join(ROOT, "package.site.json"), path.join(SITE, "package.json"));
  if (fs.existsSync(path.join(ROOT, ".env"))) {
    copyFile(path.join(ROOT, ".env"), path.join(SITE, ".env"));
  }

  console.log(`Done. Deploy folder: ${SITE}`);
  console.log("Run: npm run dev");
}

main();
