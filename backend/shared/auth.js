const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const IS_PROD = process.env.NODE_ENV === "production";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const REGION = requiredEnv("COGNITO_REGION");
const USER_POOL_ID = requiredEnv("COGNITO_USER_POOL_ID");
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const client = jwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
});

class ApiError extends Error {
  constructor(status, code, clientMessage, logMessage) {
    super(clientMessage);
    this.status = status;
    this.code = code;
    this.clientMessage = clientMessage;
    this.logMessage = logMessage || clientMessage;
  }
}

function getKey(header, callback) {
  client.getSigningKey(header.kid, function onSigningKey(err, key) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, key.getPublicKey());
  });
}

function verifyToken(token) {
  const issuer = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer,
      },
      (err, decoded) => {
        if (err) {
          reject(
            new ApiError(
              401,
              "invalid_token",
              IS_PROD ? "Unauthorized" : "Invalid or expired token",
              "JWT verification failed"
            )
          );
          return;
        }

        if (
          CLIENT_ID &&
          ((decoded.client_id && decoded.client_id !== CLIENT_ID) ||
            (decoded.aud && decoded.aud !== CLIENT_ID))
        ) {
          reject(
            new ApiError(
              401,
              "wrong_audience",
              IS_PROD ? "Unauthorized" : "Token not issued for this client",
              "Token audience/client_id mismatch"
            )
          );
          return;
        }

        resolve(decoded);
      }
    );
  });
}

async function authenticate(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring("Bearer ".length) : null;

  if (!token) {
    throw new ApiError(
      401,
      "missing_token",
      IS_PROD ? "Unauthorized" : "Missing Authorization: Bearer <token>",
      "Missing bearer token"
    );
  }

  const decoded = await verifyToken(token);
  const groups = decoded["cognito:groups"] || [];
  const role = groups.includes("admin") ? "admin" : groups.includes("user") ? "user" : "unknown";

  return {
    user: decoded,
    claims: {
      role,
      device_id: decoded["custom:device_id"] || null,
    },
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Expose-Headers": "x-correlation-id",
  };
}

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

function jsonResponseWithCorrelation(status, body, correlationId) {
  const response = jsonResponse(status, body);
  if (correlationId) {
    response.headers["x-correlation-id"] = correlationId;
  }
  return response;
}

function preflightResponse(correlationId) {
  const response = {
    status: 204,
    headers: corsHeaders(),
  };
  if (correlationId) {
    response.headers["x-correlation-id"] = correlationId;
  }
  return response;
}

function normalizeError(error) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      clientMessage: error.clientMessage,
      logMessage: error.logMessage,
    };
  }

  return {
    status: 500,
    code: "internal_error",
    clientMessage: "Internal server error",
    logMessage: error && error.message ? error.message : "Unknown error",
  };
}

module.exports = {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
};
