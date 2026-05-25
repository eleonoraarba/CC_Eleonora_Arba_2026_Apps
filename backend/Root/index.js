const { jsonResponseWithCorrelation, preflightResponse } = require("../shared/auth");
const { finishRequest, startRequest } = require("../shared/logging");

module.exports = async function root(context, req) {
  const request = startRequest(context, req, "/");

  if (req.method === "OPTIONS") {
    context.res = preflightResponse(request.correlationId);
    finishRequest(context, request, 204);
    return;
  }

  context.res = jsonResponseWithCorrelation(
    200,
    { message: "Hello world. Use /api/profile or /api/data endpoints." },
    request.correlationId
  );
  finishRequest(context, request, 200);
};
