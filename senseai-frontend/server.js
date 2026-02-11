/**
 * Stable HTTPS dev launcher:
 * - Runs Next.js on local HTTP (127.0.0.1:3100)
 * - Serves HTTPS on 0.0.0.0:3000 via reverse proxy
 *
 * This avoids Next experimental HTTPS instability while still enabling
 * secure-context camera/mic + LAN testing.
 */
const { createServer } = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const list = nets[name];
    if (!Array.isArray(list)) continue;
    for (const n of list) {
      if (n.family !== "IPv4" || n.internal) continue;
      if (typeof n.address !== "string") continue;
      if (n.address.startsWith("169.254.")) continue;
      return n.address;
    }
  }
  return null;
}

function findCerts() {
  const roots = [__dirname, path.resolve(__dirname, "../backend")];
  const preferred = ["localhost+4", "localhost+3", "localhost+2"];

  for (const root of roots) {
    for (const name of preferred) {
      const key = path.join(root, `${name}-key.pem`);
      const cert = path.join(root, `${name}.pem`);
      if (fs.existsSync(key) && fs.existsSync(cert)) return { key, cert };
    }
  }
  return null;
}

function cleanupNextDevState() {
  const nextDevDir = path.join(__dirname, ".next", "dev");
  try {
    fs.rmSync(nextDevDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors; next dev can recreate when possible.
  }
}

function waitForNextReady(target, maxWaitMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(target, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > maxWaitMs) {
          reject(new Error("Next.js dev server did not become ready in time."));
          return;
        }
        setTimeout(tryOnce, 400);
      });
      req.setTimeout(2500, () => {
        req.destroy();
        if (Date.now() - start > maxWaitMs) reject(new Error("Timeout waiting for Next.js"));
        else setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

const certs = findCerts();
if (!certs) {
  console.error("SSL certificates missing. From senseai-frontend run:");
  console.error("  npm run ssl:lan");
  process.exit(1);
}

let HttpProxy;
try {
  HttpProxy = require("http-proxy");
} catch {
  console.error("Missing dependency: http-proxy");
  console.error("Run: npm install");
  process.exit(1);
}

cleanupNextDevState();

const host = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const nextPort = parseInt(process.env.NEXT_DEV_PORT || "3100", 10);
const nextTarget = `http://127.0.0.1:${nextPort}`;

console.log("Starting HTTPS server...");
console.log("Using cert:", certs.cert);
console.log("Spawning Next.js on port", nextPort);

const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");
const nextDev = spawn(
  process.execPath,
  [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", String(nextPort)],
  {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(nextPort),
      NEXT_DISABLE_WEBPACK_CACHE: process.env.NEXT_DISABLE_WEBPACK_CACHE || "1",
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
    },
  }
);

nextDev.stdout.on("data", (chunk) => process.stdout.write("[Next] " + chunk.toString()));
nextDev.stderr.on("data", (chunk) => process.stderr.write("[Next] " + chunk.toString()));
nextDev.on("error", (err) => {
  console.error("Failed to start Next.js:", err.message);
  process.exit(1);
});
nextDev.on("exit", (code) => {
  if (code && code !== 0) {
    console.error("Next.js exited with code", code);
    process.exit(code);
  }
});

waitForNextReady(nextTarget)
  .then(() => {
    const proxy = HttpProxy.createProxyServer({
      target: nextTarget,
      ws: true,
      xfwd: true,
    });

    const server = createServer(
      {
        key: fs.readFileSync(certs.key),
        cert: fs.readFileSync(certs.cert),
      },
      (req, res) => {
        req.headers["x-forwarded-host"] = req.headers.host || "";
        req.headers["x-forwarded-proto"] = "https";
        proxy.web(req, res, { target: nextTarget }, (err) => {
          console.error("Proxy error:", err?.message || err);
          res.statusCode = 502;
          res.end("Bad Gateway");
        });
      }
    );

    server.on("upgrade", (req, socket, head) => {
      proxy.ws(req, socket, head, { target: nextTarget }, (err) => {
        if (!server._lastWsErrLog) server._lastWsErrLog = 0;
        if (err && Date.now() - server._lastWsErrLog > 30000) {
          server._lastWsErrLog = Date.now();
          console.error("Proxy WS warning:", err?.message || err);
        }
      });
    });

    server.on("error", (err) => {
      console.error("HTTPS server error:", err.message);
      if (err.code === "EADDRINUSE") {
        console.error("Port", port, "is already in use.");
      }
      process.exit(1);
    });

    server.listen(port, host, () => {
      const lan = getLanIp();
      console.log("> Ready on https://localhost:" + port);
      if (lan) console.log("> LAN: https://" + lan + ":" + port);
    });
  })
  .catch((err) => {
    console.error(err.message);
    nextDev.kill();
    process.exit(1);
  });

process.on("SIGINT", () => {
  nextDev.kill("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  nextDev.kill("SIGTERM");
  process.exit(0);
});
