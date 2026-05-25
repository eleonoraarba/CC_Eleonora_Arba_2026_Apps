const { randomUUID } = require("crypto");

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const ACTIVE_LEVEL = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level) {
  return LEVELS[level] <= ACTIVE_LEVEL;
}

function readHeader(req, name) {
  if (!req || !req.headers) {
    return undefined;
  }

  return req.headers[name] || req.headers[name.toLowerCase()] || req.headers[name.toUpperCase()];
}

function getCorrelationId(req) {
  return readHeader(req, "x-correlation-id") || readHeader(req, "x-request-id") || randomUUID();
}

function emit(context, level, event, fields = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  if (level === "error" && context.log.error) {
    context.log.error(JSON.stringify(entry));
    return;
  }

  if (level === "warn" && context.log.warn) {
    context.log.warn(JSON.stringify(entry));
    return;
  }

  context.log(JSON.stringify(entry));
}

function startRequest(context, req, path) {
  const request = {
    method: req.method,
    path,
    correlationId: getCorrelationId(req),
    startedAt: Date.now(),
  };

  emit(context, "info", "request.start", {
    correlationId: request.correlationId,
    method: request.method,
    path: request.path,
  });

  return request;
}

function finishRequest(context, request, status) {
  emit(context, "info", "request.end", {
    correlationId: request.correlationId,
    method: request.method,
    path: request.path,
    status,
    durationMs: Date.now() - request.startedAt,
  });
}

function maskDeviceId(deviceId) {
  if (!deviceId) {
    return null;
  }

  if (deviceId.length <= 4) {
    return "***";
  }

  return `${deviceId.slice(0, 2)}***${deviceId.slice(-2)}`;
}

module.exports = {
  emit,
  finishRequest,
  maskDeviceId,
  startRequest,
};
