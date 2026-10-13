// Preload only in the authenticated Firebase CLI secret-read subprocess.
// The CLI normally logs the returned secret to a temporary debug file. Disable
// its file transport before CLI initialization, while keeping captured stdout.
const Module = require("node:module");
const load = Module._load;
let disabled = false;
Module._load = function (request, parent, isMain) {
  const value = load.call(this, request, parent, isMain);
  let filename;
  try { filename = Module._resolveFilename(request, parent); } catch { return value; }
  if (typeof filename === "string" && /[/\\]firebase-tools[/\\]lib[/\\]logger\.js$/.test(filename) &&
      typeof value.useFileLogger === "function" && typeof value.findAvailableLogFile === "function") {
    value.useFileLogger = () => undefined;
    disabled = true;
    process.stderr.write("HORIZON_EVAL_FILE_LOGGER_DISABLED\n");
  }
  if (typeof filename === "string" && /[/\\]firebase-tools[/\\]lib[/\\]bin[/\\]cli\.js$/.test(filename) && typeof value.cli === "function") {
    const cli = value.cli;
    value.cli = function (...args) {
      if (!disabled) throw new Error("Evaluation requires Firebase file logging to be disabled before CLI initialization");
      return cli.apply(this, args);
    };
  }
  return value;
};
