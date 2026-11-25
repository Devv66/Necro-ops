import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NecroOpsEngine } from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 32 * 1024;
const LOCAL_FIXTURE_SESSION_COOKIE = 'necroops_local_fixture_state';
const LOCAL_FIXTURE_SESSION_VERSION = 2;
const LOCAL_FIXTURE_SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;
const MIN_LOCAL_FIXTURE_SESSION_SECRET_BYTES = 32;

class HttpError extends Error {
  constructor(statusCode, message, code = 'REQUEST_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function configuredLocalFixtureSessionSecret(configuredSecret) {
  const candidate = configuredSecret ?? process.env.NECROOPS_LOCAL_FIXTURE_SESSION_SECRET;
  const isBuffer = Buffer.isBuffer(candidate);
  const byteLength = isBuffer ? candidate.length : (typeof candidate === 'string' ? Buffer.byteLength(candidate, 'utf8') : 0);

  if (candidate !== undefined && candidate !== '') {
    if (byteLength < MIN_LOCAL_FIXTURE_SESSION_SECRET_BYTES) {
      throw new Error(`NECROOPS_LOCAL_FIXTURE_SESSION_SECRET must contain at least ${MIN_LOCAL_FIXTURE_SESSION_SECRET_BYTES} UTF-8 bytes.`);
    }
    return Buffer.from(candidate);
  }

  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    throw new Error('NECROOPS_LOCAL_FIXTURE_SESSION_SECRET is required in production so local-fixture session cookies remain signed across instances.');
  }

  // Local development/test fallback: it prevents client-side forgery for this
  // process, while deliberately invalidating cookies after a server restart.
  return crypto.randomBytes(MIN_LOCAL_FIXTURE_SESSION_SECRET_BYTES);
}

function signLocalFixtureSessionPayload(payload, signingKey) {
  return crypto.createHmac('sha256', signingKey).update(payload).digest('base64url');
}

function unixSeconds(now) {
  const currentTime = now();
  if (!Number.isSafeInteger(currentTime) || currentTime < 0) {
    throw new Error('Local fixture session clock must return a non-negative safe integer timestamp in milliseconds.');
  }
  return Math.floor(currentTime / 1000);
}

function decodeVerifiedLocalFixtureSession(encoded, signingKey) {
  if (typeof encoded !== 'string') return null;
  const [payload, signature, ...extraParts] = encoded.split('.');
  if (!payload || !signature || extraParts.length !== 0) return null;

  const expectedSignature = crypto.createHmac('sha256', signingKey).update(payload).digest();
  let suppliedSignature;
  try {
    suppliedSignature = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (suppliedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(suppliedSignature, expectedSignature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function validLocalFixtureSession(envelope, now) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return null;
  if (envelope.version !== LOCAL_FIXTURE_SESSION_VERSION) return null;
  if (!Number.isSafeInteger(envelope.issuedAt) || !Number.isSafeInteger(envelope.expiresAt)) return null;
  if (envelope.issuedAt < 0 || envelope.expiresAt <= envelope.issuedAt) return null;
  if (envelope.expiresAt - envelope.issuedAt !== LOCAL_FIXTURE_SESSION_MAX_AGE_SECONDS) return null;

  const currentTime = unixSeconds(now);
  if (envelope.issuedAt > currentTime || envelope.expiresAt <= currentTime) return null;
  if (!Array.isArray(envelope.exorcisedFixtureIds)) return null;

  return envelope;
}

function decodeSignedLocalFixtureSession(encoded, signingKey, now) {
  // HMAC verification deliberately occurs before JSON fields are trusted.
  const envelope = decodeVerifiedLocalFixtureSession(encoded, signingKey);
  return validLocalFixtureSession(envelope, now);
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...extraHeaders
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
     'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  res.end(text);
}

function parseJsonBody(req, { limit = MAX_BODY_BYTES, allowEmptyBody = true } = {}) {
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
        if (!allowEmptyBody) {
          fail(new HttpError(400, 'Reset requests must contain an empty JSON object.', 'RESET_BODY_MUST_BE_EMPTY_OBJECT'));
          return;
        }
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
  const mediaType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new HttpError(415, 'Mutation requests must use Content-Type: application/json.', 'UNSUPPORTED_MEDIA_TYPE');
  }
}

function requireEmptyObject(body) {
  if (Object.keys(body).length !== 0) {
    throw new HttpError(400, 'Reset requests must contain an empty JSON object.', 'RESET_BODY_MUST_BE_EMPTY_OBJECT');
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
  res.writeHead(405, {
    Allow: allowed.join(', '),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
     'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  res.end(JSON.stringify({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }));
}

function parseCookies(req) {
  const rawCookie = req.headers.cookie || '';
  return Object.fromEntries(rawCookie.split(';').map(entry => {
    const separator = entry.indexOf('=');
    if (separator < 0) return [entry.trim(), ''];
    return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
  }).filter(([name]) => name));
}

function engineFromLocalFixtureSession(req, signingKey, now) {
  const engine = new NecroOpsEngine();
  const encoded = parseCookies(req)[LOCAL_FIXTURE_SESSION_COOKIE];
  if (!encoded) return { engine, session: null };

  const session = decodeSignedLocalFixtureSession(encoded, signingKey, now);
  if (session && engine.restoreLocalFixtureSession({
    version: 1,
    exorcisedFixtureIds: session.exorcisedFixtureIds
  })) {
    return { engine, session };
  }

  // An absent, expired, legacy-version, malformed, tampered, or semantically
  // rejected session intentionally falls back to the default catalog; no
  // client-supplied state is trusted.
  return { engine, session: null };
}

function localFixtureSessionHeader(req, engine, signingKey, now, productionRuntime, existingSession) {
  const currentTime = unixSeconds(now);
  const session = existingSession
    ? {
        version: LOCAL_FIXTURE_SESSION_VERSION,
        issuedAt: existingSession.issuedAt,
        expiresAt: existingSession.expiresAt,
        exorcisedFixtureIds: engine.exportLocalFixtureSession().exorcisedFixtureIds
      }
    : {
        version: LOCAL_FIXTURE_SESSION_VERSION,
        issuedAt: currentTime,
        expiresAt: currentTime + LOCAL_FIXTURE_SESSION_MAX_AGE_SECONDS,
        exorcisedFixtureIds: engine.exportLocalFixtureSession().exorcisedFixtureIds
      };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = signLocalFixtureSessionPayload(payload, signingKey);
  const isHttps = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
  const secureCookie = productionRuntime || isHttps;
  const remainingLifetime = session.expiresAt - currentTime;

  return {
    'Set-Cookie': `${LOCAL_FIXTURE_SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${remainingLifetime}; HttpOnly; SameSite=Lax${secureCookie ? '; Secure' : ''}`
  };
}

function staticIndex(res, publicDir, pathname) {
  if (pathname !== '/' && pathname !== '/index.html') {
    return sendText(res, 404, 'Not found.');
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) return sendText(res, 500, 'Dashboard asset is missing.');
  return sendText(res, 200, fs.readFileSync(indexPath, 'utf8'), 'text/html; charset=utf-8');
}

export function createServer({ engine: sharedEngine, publicDir = PUBLIC_DIR, sessionSecret, now = Date.now } = {}) {
  const useBrowserLocalFixtureSession = !sharedEngine;
  const localFixtureSessionSigningKey = useBrowserLocalFixtureSession
    ? configuredLocalFixtureSessionSecret(sessionSecret)
    : null;
  const productionRuntime = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  return http.createServer(async (req, res) => {
    const sessionContext = sharedEngine
      ? null
      : engineFromLocalFixtureSession(req, localFixtureSessionSigningKey, now);
    const engine = sharedEngine || sessionContext.engine;
    const sendApiJson = (statusCode, data) => sendJson(
      res,
      statusCode,
      data,
      useBrowserLocalFixtureSession
        ? localFixtureSessionHeader(req, engine, localFixtureSessionSigningKey, now, productionRuntime, sessionContext.session)
        : undefined
    );

    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const { pathname } = parsedUrl;

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          Allow: 'GET, POST, OPTIONS',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
           'Referrer-Policy': 'no-referrer',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "frame-ancestors 'none'",
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        });
        return res.end();
      }

      if (pathname === '/api/status') {
        if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);
        return sendApiJson(200, {
          app: 'NecroOps',
          version: '1.2.0',
          executionMode: 'local-demo-fixtures-no-aws-account',
          telemetry: engine.scanCloudPerimeter()
        });
      }

      if (pathname === '/api/scan') {
        if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);
        return sendApiJson(200, engine.scanCloudPerimeter());
      }

      if (pathname === '/api/resurrect') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req);
        const result = engine.resurrectLegacyCode(requiredResourceId(body));
        return sendApiJson(200, { success: true, executionMode: 'local-demo-fixture', result });
      }

      if (pathname === '/api/exorcise') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req);
        const receipt = engine.exorciseZombieResource(requiredResourceId(body), optionalReason(body));
        return sendApiJson(200, { success: true, executionMode: 'local-demo-fixture', receipt });
      }

      if (pathname === '/api/reset') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req, { allowEmptyBody: false });
        requireEmptyObject(body);
        const reset = engine.resetLocalFixtureScenario();
        return sendApiJson(200, { success: true, executionMode: 'local-demo-fixture', reset });
      }

      if (pathname === '/api/kiro-crew/execute') {
        if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
        requireJsonContentType(req);
        const body = await parseJsonBody(req);
        const orchestration = engine.runKiroCrewOrchestration(requiredResourceId(body));
        return sendApiJson(200, { success: true, executionMode: 'local-demo-fixture', orchestration });
      }

      if (pathname.startsWith('/api/')) {
        return sendApiJson(404, { error: 'API route not found.', code: 'API_ROUTE_NOT_FOUND' });
      }

      return staticIndex(res, publicDir, pathname);
    } catch (error) {
      const publicError = toHttpError(error);
      return sendApiJson(publicError.statusCode, { error: publicError.message, code: publicError.code });
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
