const fs = require("fs");
const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

const {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
} = require("../shared/auth");
const { emit, finishRequest, maskDeviceId, startRequest } = require("../shared/logging");

const csvPath = "/app/docs/datasets/energy_usage_large.csv";

let cachedData = null;

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}


async function readDatasetCsvFromCloud(blobName = "energy_usage_large.csv") {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const containerName = process.env.DATASETS_CONTAINER_NAME;

  if (!accountName || !containerName) {
    throw new Error("Missing STORAGE_ACCOUNT_NAME or DATASETS_CONTAINER_NAME");
  }

  const client = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new DefaultAzureCredential()
  );

  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download();

  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function parseCsvContent(fileContent) {
  const lines = fileContent.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index].trim() : "";
    });

    if (row.kwh !== undefined) {
      const parsedKwh = Number(row.kwh);
      row.kwh = Number.isNaN(parsedKwh) ? row.kwh : parsedKwh;
    }

    return row;
  });
}

async function loadCsvData() {
  if (cachedData) {
    return cachedData;
  }

  try{
    const fileContent = await readDatasetCsvFromCloud();
    cachedData = parseCsvContent(fileContent);
    return cachedData;
  }catch(error){
    const fileContent = fs.readFileSync(csvPath, "utf8");
    cachedData = parseCsvContent(fileContent);
    return cachedData;
  }
}

module.exports = async function data(context, req) {
  const request = startRequest(context, req, "/api/data");

  if (req.method === "OPTIONS") {
    context.res = preflightResponse(request.correlationId);
    finishRequest(context, request, 204);
    return;
  }

  try {
    const auth = await authenticate(req);
    const { role, device_id } = auth.claims;

    const allData = await loadCsvData();
    let visibleData;

    if (role === "admin") {
      visibleData = allData;
    } else if (role === "user") {
      if (!device_id) {
        emit(context, "warn", "authz.denied", {
          correlationId: request.correlationId,
          path: "/api/data",
          code: "missing_device_id",
          role,
        });
        context.res = jsonResponseWithCorrelation(
          403,
          {
            error: "No device_id associated with this account",
          },
          request.correlationId
        );
        finishRequest(context, request, 403);
        return;
      }

      visibleData = allData.filter((item) => item.device_id === device_id);
    } else {
      emit(context, "warn", "authz.denied", {
        correlationId: request.correlationId,
        path: "/api/data",
        code: "unknown_role",
        role,
      });
      context.res = jsonResponseWithCorrelation(
        403,
        { error: "Insufficient permissions" },
        request.correlationId
      );
      finishRequest(context, request, 403);
      return;
    }

    emit(context, "info", "authz.allowed", {
      correlationId: request.correlationId,
      path: "/api/data",
      role,
      deviceIdMasked: maskDeviceId(device_id),
      returnedCount: visibleData.length,
    });

    context.res = jsonResponseWithCorrelation(
      200,
      {
        role,
        device_id,
        data: visibleData,
      },
      request.correlationId
    );
    finishRequest(context, request, 200);
  } catch (error) {
    const normalized = normalizeError(error);
    emit(context, normalized.status >= 500 ? "error" : "warn", "auth.failed", {
      correlationId: request.correlationId,
      path: "/api/data",
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
