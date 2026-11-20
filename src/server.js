import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NecroOpsEngine } from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 32 * 1024;

class HttpError extends Error {
  constructor(statusCode, message, code = 'REQUEST_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(text);
}

function parseJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = error => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        fail(new HttpError(413, `Request body exceeds the ${limit}-byte limit.`, 'BODY_TOO_LARGE'));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) {
        settled = true;
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new HttpError(400, 'JSON request body must be an object.', 'INVALID_JSON_SHAPE');
        }
        settled = true;
        resolve(parsed);
      } catch (error) {
        fail(error instanceof HttpError ? error : new HttpError(400, 'Malformed JSON request body.', 'MALFORMED_JSON'));
      }
    });

    req.on('error', error => fail(new HttpError(400, error.message, 'REQUEST_STREAM_ERROR')));
  });
}

function requireJsonContentType(req) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Mutation requests must use Content-Type: application/json.', 'UNSUPPORTED_MEDIA_TYPE');
  }
}

function requiredResourceId(body) {
  if (typeof body.resourceId !== 'string' || body.resourceId.trim() === '') {
    throw new HttpError(400, 'resourceId is required for this local-fixture mutation.', 'RESOURCE_ID_REQUIRED');
  }
  if (body.resourceId.length > 512) {
    throw new HttpError(400, 'resourceId is too long.', 'RESOURCE_ID_TOO_LONG');
  }
  return body.resourceId.trim();
}

function optionalReason(body) {
  if (body.reason === undefined) return undefined;
  if (typeof body.reason !== 'string' || body.reason.trim() === '' || body.reason.length > 500) {
    throw new HttpError(400, 'reason must be a non-empty string no longer than 500 characters.', 'INVALID_REASON');
  }
  return body.reason.trim();
}

function toHttpError(error) {
  if (error instanceof HttpError) return error;
  if (Number.isInteger(error?.statusCode)) {
    return new HttpError(error.statusCode, error.message, error.code || 'ENGINE_ERROR');
  }
  return new HttpError(500, 'Unexpected local server error.', 'INTERNAL_ERROR');
}

function methodNotAllowed(res, allowed) {
  res.writeHead(405, { Allow: allowed.join(', '), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }));
}

function staticIndex(res, publicDir, pathname) {
  if (pathname !== '/' && pathname !== '/index.html') {
    return sendText(res, 404, 'Not found.');
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) return sendText(res, 500, 'Dashboard asset is missing.');
  return sendText(res, 200, fs.readFileSync(indexPath, 'utf8'), 'text/html; charset=utf-8');
}

export function createServer({ engine = new NecroOpsEngine(), publicDir = PUBLIC_DIR } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const { pathname } = parsedUrl;

      if (req.method === 'OPTIONS') {
        res.writeHead(204, { Allow: 'GET, POST, OPTIONS' });
        return res.end();
      }

      if (pathname === '/api/status') {
        if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);
        return sendJson(res, 200, {
          app: 'NecroOps',
          version: '1.1.0',
          executionMode: 'local-demo-fixtures-no-aws-account',
          telemetry: engine.scanCloudPerimeter()
        });
      }

      if (pathname === '/api/scan') {
        if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);
        return sendJson(res, 200, engine.scanCloudPerimeter());
      }

      if (pathname === '/api/resurrect') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req);
        const result = engine.resurrectLegacyCode(requiredResourceId(body));
        return sendJson(res, 200, { success: true, executionMode: 'local-demo-fixture', result });
      }

      if (pathname === '/api/exorcise') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req);
        const receipt = engine.exorciseZombieResource(requiredResourceId(body), optionalReason(body));
        return sendJson(res, 200, { success: true, executionMode: 'local-demo-fixture', receipt });
      }

      if (pathname === '/api/kiro-crew/execute') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req);
        const orchestration = engine.runKiroCrewOrchestration(requiredResourceId(body));
        return sendJson(res, 200, { success: true, executionMode: 'local-demo-fixture', orchestration });
      }

      if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, { error: 'API route not found.', code: 'API_ROUTE_NOT_FOUND' });
      }

      return staticIndex(res, publicDir, pathname);
    } catch (error) {
      const publicError = toHttpError(error);
      return sendJson(res, publicError.statusCode, { error: publicError.message, code: publicError.code });
    }
  });
}

export function startServer(port = Number(process.env.PORT || 3000)) {
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`[NecroOps] Local fixture server running on http://0.0.0.0:${port}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
