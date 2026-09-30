/**
 * Minimal structured logging: one JSON line per event to stdout/stderr.
 * Deliberately dependency-free -- on Vercel (and most container hosts)
 * stdout/stderr is already ingested as structured logs, so a logging
 * service integration isn't needed just to get past bare `console.error`
 * calls scattered with no consistent shape.
 */
function log(level, message, extra = {}) {
  const { error: err, ...rest } = extra;
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...rest
  };
  if (err) {
    entry.error = { message: err.message, stack: err.stack, ...(err.code ? { code: err.code } : {}) };
  }
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message, extra) => log("info", message, extra),
  warn: (message, extra) => log("warn", message, extra),
  error: (message, extra) => log("error", message, extra)
};
