'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { solve } = require('./solver');

const PORT = Number(process.env.PORT || 4312);
const HOST = process.env.HOST || '0.0.0.0';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_MAP_PATH = path.join(ROOT, 'data', 'map.default.json');
const SHARES_PATH = path.join(ROOT, 'data', 'shares.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const EXAMPLE_QUERIES = {
  redPath: {
    startId: 'g(vC1)',
    endId: 'C9',
    lantern: {
      allowedColors: ['red'],
    },
    minSteps: 1,
    maxSteps: 240,
  },
  orangePath: {
    startId: 'g(vC1)',
    endId: 'C9',
    lantern: {
      allowedColors: ['orange'],
    },
    minSteps: 1,
    maxSteps: 240,
  },
  purplePath: {
    startId: 'g(vC1)',
    endId: 'C9',
    lantern: {
      allowedColors: ['purple'],
    },
    minSteps: 1,
    maxSteps: 240,
  },
  truePath: {
    startId: 'g(vC1)',
    endId: 'E8',
    lantern: {
      startColor: 'blue',
      turnRules: {
        blue: 'left',
        red: 'left',
        orange: 'right',
        purple: 'straight',
      },
    },
    maxSteps: 180,
  },
  emptyLetters: {
    startId: 'g(vC1)',
    endId: 'C9',
    startColor: 'red',
    letterMode: 'any_order',
    mustUseLetters: ['M', 'P', 'T', 'Y', 'E'],
    maxSteps: 180,
  },
  simulationExample: {
    mode: 'simulate',
    startId: 'g(vC1)',
    endId: 'E8',
    maxSteps: 120,
    simulation: {
      initialHeading: 'N',
      stopOnLoop: true,
    },
    lantern: {
      allowedColors: ['red', 'orange', 'yellow', 'green', 'blue', 'purple'],
      turnRules: {
        intersection: 'any',
        red: 'right',
        orange: 'left',
        purple: 'straight',
      },
    },
  },

  // Legacy aliases (keep compatibility with older UI buttons/scripts)
  redOnly: {
    startId: 'g(vC1)',
    endId: 'C9',
    lantern: {
      allowedColors: ['red'],
    },
    minSteps: 1,
    maxSteps: 240,
  },
  orangeOnly: {
    startId: 'g(vC1)',
    endId: 'C9',
    lantern: {
      allowedColors: ['orange'],
    },
    minSteps: 1,
    maxSteps: 240,
  },
  purpleOnly: {
    startId: 'g(vC1)',
    endId: 'C9',
    lantern: {
      allowedColors: ['purple'],
    },
    minSteps: 1,
    maxSteps: 240,
  },
  blueStartTurnRules: {
    startId: 'g(vC1)',
    endId: 'E8',
    lantern: {
      startColor: 'blue',
      turnRules: {
        blue: 'left',
        red: 'left',
        orange: 'right',
        purple: 'straight',
      },
    },
    maxSteps: 180,
  },
};

async function readDefaultMap() {
  const text = await fsp.readFile(DEFAULT_MAP_PATH, 'utf8');
  return JSON.parse(text);
}

async function readShares() {
  try {
    const text = await fsp.readFile(SHARES_PATH, 'utf8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw err;
  }
}

let shareWriteQueue = Promise.resolve();

function writeShares(shares) {
  const text = `${JSON.stringify(shares, null, 2)}\n`;
  shareWriteQueue = shareWriteQueue.then(() => fsp.writeFile(SHARES_PATH, text, 'utf8'));
  return shareWriteQueue;
}

function createShareId(existingShares) {
  for (let i = 0; i < 10; i += 1) {
    const shareId = crypto.randomBytes(4).toString('base64url');
    if (!existingShares[shareId]) return shareId;
  }

  throw new Error('Failed to generate unique share id');
}

function withKnownPathExamples(baseExamples, map) {
  const out = JSON.parse(JSON.stringify(baseExamples || {}));
  const knownPaths =
    (map && typeof map === 'object' && map.knownPaths && typeof map.knownPaths === 'object')
      ? map.knownPaths
      : {};

  // IMPORTANT: known paths are metadata for verification, not hard constraints for solving.
  for (const [key, known] of Object.entries(knownPaths)) {
    if (!known || typeof known !== 'object' || !Array.isArray(known.nodes) || known.nodes.length === 0) {
      continue;
    }

    if (!out[key]) out[key] = {};

    out[key].expectedKnownPathId = key;
    out[key].expectedNodeCount = known.nodes.length;
  }

  return out;
}

function stripExampleMetadata(query) {
  if (!query || typeof query !== 'object') return {};

  const out = JSON.parse(JSON.stringify(query));
  delete out.expectedKnownPathId;
  delete out.expectedNodeCount;
  return out;
}

function isOrderedSubsequence(expectedNodes, actualNodes) {
  const expected = Array.isArray(expectedNodes) ? expectedNodes : [];
  const actual = Array.isArray(actualNodes) ? actualNodes : [];

  let i = 0;
  for (const node of actual) {
    if (i < expected.length && node === expected[i]) i += 1;
  }

  return i === expected.length;
}

function comparePaths(expectedNodes, actualNodes) {
  const expected = Array.isArray(expectedNodes) ? expectedNodes : [];
  const actual = Array.isArray(actualNodes) ? actualNodes : [];

  const exactLength = expected.length === actual.length;
  let firstDiffIndex = -1;

  const upto = Math.min(expected.length, actual.length);
  for (let i = 0; i < upto; i += 1) {
    if (expected[i] !== actual[i]) {
      firstDiffIndex = i;
      break;
    }
  }

  if (firstDiffIndex === -1 && !exactLength) {
    firstDiffIndex = upto;
  }

  return {
    exactMatch: firstDiffIndex === -1 && exactLength,
    orderedSubsequenceMatch: isOrderedSubsequence(expected, actual),
    expectedCount: expected.length,
    actualCount: actual.length,
    firstDiffIndex,
    expectedAtDiff: firstDiffIndex >= 0 ? expected[firstDiffIndex] || null : null,
    actualAtDiff: firstDiffIndex >= 0 ? actual[firstDiffIndex] || null : null,
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function parseBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

async function serveStatic(reqPath, res) {
  let relPath = reqPath;
  if (relPath === '/') relPath = '/index.html';

  const safePath = path.normalize(relPath).replace(/^\.+/, '');
  const absolutePath = path.join(PUBLIC_DIR, safePath);

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fsp.stat(absolutePath);
    if (!stat.isFile()) {
      sendText(res, 404, 'Not Found');
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(absolutePath);
    res.writeHead(200, { 'Content-Type': mime });
    stream.pipe(res);
  } catch {
    sendText(res, 404, 'Not Found');
  }
}

async function handler(req, res) {
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'blue-prince-solver' });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/default-map') {
      const map = await readDefaultMap();
      sendJson(res, 200, map);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/examples') {
      const map = await readDefaultMap();
      const examples = withKnownPathExamples(EXAMPLE_QUERIES, map);
      sendJson(res, 200, examples);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/known-paths') {
      const map = await readDefaultMap();
      sendJson(res, 200, map.knownPaths || {});
      return;
    }

    if (req.method === 'GET' && pathname === '/api/verify-known') {
      const map = await readDefaultMap();
      const pathId = String(reqUrl.searchParams.get('pathId') || '').trim();

      if (!pathId) {
        sendJson(res, 400, {
          ok: false,
          error: 'Missing pathId query param',
        });
        return;
      }

      const knownPaths =
        map && typeof map === 'object' && map.knownPaths && typeof map.knownPaths === 'object'
          ? map.knownPaths
          : {};

      const known = knownPaths[pathId];
      if (!known || !Array.isArray(known.nodes) || known.nodes.length === 0) {
        sendJson(res, 404, {
          ok: false,
          error: `Known path "${pathId}" not found`,
        });
        return;
      }

      const examples = withKnownPathExamples(EXAMPLE_QUERIES, map);
      const baseQuery = stripExampleMetadata(examples[pathId] || {});

      let solveResult;
      try {
        solveResult = solve(map, baseQuery);
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err.message || String(err),
        });
        return;
      }

      const actualNodesRaw = solveResult && solveResult.path && Array.isArray(solveResult.path.nodes)
        ? solveResult.path.nodes
        : [];

      const expectedSet = new Set(known.nodes || []);
      const actualNodes = actualNodesRaw.filter((nodeId) => {
        const kind = map.nodes && map.nodes[nodeId] ? map.nodes[nodeId].kind : null;
        if (kind !== 'intersection') return true;
        return expectedSet.has(nodeId);
      });

      const comparison = comparePaths(known.nodes, actualNodes);

      sendJson(res, 200, {
        ok: true,
        pathId,
        query: baseQuery,
        solveSuccess: !!solveResult.success,
        solveResult,
        actualNodesRaw,
        actualNodesCompared: actualNodes,
        comparison,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/save-map') {
      const body = await parseBody(req, 8 * 1024 * 1024);
      const map =
        body && typeof body === 'object' && body.map && typeof body.map === 'object'
          ? body.map
          : (body && typeof body === 'object' ? body : null);

      if (!map || typeof map !== 'object' || (!map.nodes && !map.rooms)) {
        sendJson(res, 400, {
          ok: false,
          error: 'Body must include map object with nodes or rooms',
        });
        return;
      }

      const text = `${JSON.stringify(map, null, 2)}\n`;
      await fsp.writeFile(DEFAULT_MAP_PATH, text, 'utf8');

      sendJson(res, 200, {
        ok: true,
        path: DEFAULT_MAP_PATH,
        bytes: Buffer.byteLength(text),
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/share') {
      const body = await parseBody(req, 8 * 1024 * 1024);
      const query =
        body && typeof body === 'object' && body.query && typeof body.query === 'object'
          ? body.query
          : null;
      const map =
        body && typeof body === 'object' && body.map && typeof body.map === 'object'
          ? body.map
          : null;
      const result =
        body && typeof body === 'object' && body.result && typeof body.result === 'object'
          ? body.result
          : null;

      if (!query || !map) {
        sendJson(res, 400, {
          ok: false,
          error: 'Body must include query and map objects',
        });
        return;
      }

      const shares = await readShares();
      const shareId = createShareId(shares);
      shares[shareId] = {
        query,
        result,
        map,
        createdAt: new Date().toISOString(),
      };

      await writeShares(shares);

      sendJson(res, 200, {
        ok: true,
        shareId,
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/share') {
      const shareId = String(reqUrl.searchParams.get('id') || '').trim();
      if (!shareId) {
        sendJson(res, 400, {
          ok: false,
          error: 'Missing id query param',
        });
        return;
      }

      const shares = await readShares();
      const share = shares[shareId];
      if (!share || typeof share !== 'object') {
        sendJson(res, 404, {
          ok: false,
          error: `Share "${shareId}" not found`,
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        share: {
          query: share.query || null,
          result: share.result || null,
          map: share.map || null,
          createdAt: share.createdAt || null,
        },
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/solve') {
      const body = await parseBody(req);
      const defaultMap = await readDefaultMap();

      let map = defaultMap;
      let query = {};

      if (body && typeof body === 'object') {
        if (body.map && typeof body.map === 'object') {
          map = body.map;
        }

        if (body.query && typeof body.query === 'object') {
          query = body.query;
        } else if (!body.map) {
          // convenience mode: body is query directly
          query = body;
        }
      }

      let result;
      try {
        result = solve(map, query);
      } catch (err) {
        sendJson(res, 400, {
          success: false,
          error: err.message || String(err),
        });
        return;
      }

      sendJson(res, 200, result);
      return;
    }

    await serveStatic(pathname, res);
  } catch (err) {
    sendJson(res, 500, {
      success: false,
      error: err.message || String(err),
    });
  }
}

const server = http.createServer(handler);
server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Blue Prince solver running at http://localhost:${PORT}`);
});
