const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// ─── Runtime Error Logger ──────────────────────────────────────────────────
// Metro forwards every console.error / console.warn from the device as a
// `client_log` event. We capture those here and write them to
// logs/runtime-errors.md in the project root — no ADB or separate server needed.
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "runtime-errors.md");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/** @type {Map<string, Array<{level:string,timestamp:string,message:string}>>} */
const grouped = new Map();
let totalCount = 0;
let flushTimer = null;

function extractSource(data) {
  const stack = data.find((d) => typeof d === "string" && d.includes("\n    at ")) || "";
  if (!stack) return "unknown";
  const lines = stack.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("at ")) continue;
    if (trimmed.includes("node_modules")) continue;
    if (trimmed.includes("ErrorLogService")) continue;
    return trimmed.replace(/^at\s+/, "").replace(/\?.*$/, "");
  }
  return "unknown";
}

function formatMessage(data) {
  return data
    .map((d) => (typeof d === "string" ? d : JSON.stringify(d)))
    .join(" ")
    .split("\n")[0]
    .slice(0, 300);
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(writeLog, 600);
}

function writeLog() {
  flushTimer = null;
  const lines = [
    "# Ourlime Mobile — Runtime Error Log",
    "",
    `> Last updated: ${new Date().toISOString()}`,
    `> Total entries: ${totalCount}`,
    "",
    "---",
    "",
  ];

  if (grouped.size === 0) {
    lines.push("_No errors or warnings captured yet._");
  } else {
    for (const [source, entries] of grouped) {
      lines.push(`## \`${source}\``);
      lines.push("");
      for (const e of entries) {
        const badge = e.level === "error" ? "🔴 ERROR" : "🟡 WARN";
        lines.push(`### ${badge} — ${e.timestamp}`);
        lines.push("");
        lines.push("```");
        lines.push(e.message);
        lines.push("```");
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }
  }

  try {
    fs.writeFileSync(LOG_FILE, lines.join("\n"), "utf8");
  } catch {
    // Never crash Metro from a logging failure.
  }
}

// Preserve existing reporter instance for NativeWind compatibility
if (config.reporter && typeof config.reporter.update === "function") {
  const originalUpdate = config.reporter.update.bind(config.reporter);
  config.reporter.update = function (event) {
    originalUpdate(event);
    if (
      event.type === "client_log" &&
      (event.level === "error" || event.level === "warn")
    ) {
      const data = Array.isArray(event.data) ? event.data : [String(event.data)];
      const source = extractSource(data);
      const message = formatMessage(data);
      const entry = {
        level: event.level,
        timestamp: new Date().toISOString(),
        message,
      };

      if (!grouped.has(source)) grouped.set(source, []);
      grouped.get(source).push(entry);
      totalCount++;

      if (totalCount > 500) {
        const firstKey = grouped.keys().next().value;
        const bucket = grouped.get(firstKey);
        bucket.shift();
        if (bucket.length === 0) grouped.delete(firstKey);
        totalCount--;
      }

      scheduleFlush();
    }
  };
}
// ─── End Runtime Error Logger ──────────────────────────────────────────────

// Update the resolver to handle SVG files
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

// Alias native codegen imports to our web-compatible shim
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath && context.originModulePath.includes("lib/shims")) {
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  }

  if (
    (moduleName.includes("codegenNativeComponent") ||
      moduleName.includes("codegenNativeCommands") ||
      moduleName.includes("codegenNative")) &&
    platform === "web"
  ) {
    return {
      filePath: path.resolve(__dirname, "lib/shims/codegenNativeComponent.js"),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./app/globals.css" });
