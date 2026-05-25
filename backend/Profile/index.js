const {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
} = require("../shared/auth");
const { emit, finishRequest, maskDeviceId, startRequest } = require("../shared/logging");

module.exports = async function profile(context, req) {
  const request = startRequest(context, req, "/api/profile");

  if (req.method === "OPTIONS") {
    context.res = preflightResponse(request.correlationId);
    finishRequest(context, request, 204);
    return;
  }

  try {
    const auth = await authenticate(req);

    emit(context, "info", "auth.success", {
      correlationId: request.correlationId,
      path: "/api/profile",
      role: auth.claims.role,
      deviceIdMasked: maskDeviceId(auth.claims.device_id),
    });

    context.res = jsonResponseWithCorrelation(200, auth.claims, request.correlationId);
    finishRequest(context, request, 200);
  } catch (error) {
    const normalized = normalizeError(error);
    emit(context, normalized.status >= 500 ? "error" : "warn", "auth.failed", {
      correlationId: request.correlationId,
      path: "/api/profile",
      code: normalized.code,
      reason: normalized.logMessage,
    });
    context.res = jsonResponseWithCorrelation(
      normalized.status,
      { error: normalized.clientMessage },
      request.correlationId
    );
    finishRequest(context, request, normalized.status);
  }
};
