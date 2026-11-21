import { createServer } from '../src/server.js';

// Existing Node server hi request behavior ka single source hai.
// Vercel warm function instance ke lifetime tak in-memory state reuse hoti hai.
const localFixtureServer = createServer();
const ROUTE_PARAM = '__necroops_path';

function restoreOriginalPath(req) {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rewrittenPath = parsed.searchParams.get(ROUTE_PARAM);

  if (rewrittenPath === null) return;

  parsed.searchParams.delete(ROUTE_PARAM);

  const query = parsed.searchParams.toString();
  const normalizedPath = `/${rewrittenPath.replace(/^\/+/, '')}`;

  req.url = `${normalizedPath}${query ? `?${query}` : ''}`;
}

export default function handler(req, res) {
  restoreOriginalPath(req);

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const fail = error => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    res.once('finish', finish);
    res.once('error', fail);

    localFixtureServer.emit('request', req, res);
  });
}
