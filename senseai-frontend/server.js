/**
 * HTTPS dev server: runs Next.js in a separate process and proxies to it.
 * Avoids app.prepare() hanging with custom server + Turbopack/Webpack.
 */
const { createServer } = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of ["en0", "en1", "eth0"]) {
    const list = nets[name];
    if (!list) continue;
    for (const n of list) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return null;
}

const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const nextPort = parseInt(process.env.NEXT_DEV_PORT || "3001", 10);
const target = `http://127.0.0.1:${nextPort}`;

// 1) SSL certs – use cert that includes LAN IP if present (localhost+4), else localhost+3
function findCerts() {
  const base = __dirname;
  for (const name of ["localhost+4", "localhost+3"]) {
    const k = path.join(base, name + "-key.pem");
    const c = path.join(base, name + ".pem");
    if (fs.existsSync(k) && fs.existsSync(c)) return { key: k, cert: c };
  }
  return null;
}
const certs = findCerts();
if (!certs) {
  console.error("SSL certificates missing. From senseai-frontend run:");
  console.error("  mkcert localhost 127.0.0.1 ::1");
  console.error("For LAN access (https://YOUR_IP:3000) also run:");
  console.error("  mkcert localhost 127.0.0.1 ::1 10.91.174.93");
  process.exit(1);
}

let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync(certs.key),
    cert: fs.readFileSync(certs.cert),
  };
} catch (err) {
  console.error("Failed to read SSL certs:", err.message);
  process.exit(1);
}

// 2) Wait for Next dev server to respond
function waitForNext(maxWaitMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryOnce() {
      const req = http.get(target, (res) => {
        res.resume(); // consume body
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > maxWaitMs) {
          reject(new Error("Next.js dev server did not become ready in time. Stop any other 'next dev' or 'npm run dev:http' and try again."));
          return;
        }
        setTimeout(tryOnce, 500);
      });
      req.setTimeout(3000, () => {
        req.destroy();
        if (Date.now() - start > maxWaitMs) reject(new Error("Timeout waiting for Next.js"));
        else setTimeout(tryOnce, 500);
      });
    }
    tryOnce();
  });
}

// 3) Start Next.js dev server in subprocess
console.log("Starting HTTPS server...");
console.log("Spawning Next.js on port", nextPort, "(ensure no other 'npm run dev:http' is running)...");

const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");
const nextDev = spawn(
  process.execPath,
  [nextBin, "dev", "-p", String(nextPort), "-H", "127.0.0.1"],
  {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(nextPort) },
  }
);

nextDev.stdout.on("data", (chunk) => {
  const line = chunk.toString();
  if (line.includes("Ready") || line.includes("started")) {
    process.stdout.write("[Next] " + line);
  }
});
nextDev.stderr.on("data", (chunk) => process.stderr.write("[Next] " + chunk));
nextDev.on("error", (err) => {
  console.error("Failed to start Next.js:", err);
  process.exit(1);
});
nextDev.on("exit", (code, signal) => {
  if (code != null && code !== 0) {
    console.error("Next.js exited with code", code);
    process.exit(code);
  }
});

// 4) When Next is ready, start HTTPS proxy
waitForNext()
  .then(() => {
    const HttpProxy = require("http-proxy");
    const proxy = HttpProxy.createProxyServer({ target, ws: true });

    const server = createServer(httpsOptions, (req, res) => {
      // So Next.js sees the original host and protocol (for redirects / allowedDevOrigins)
      req.headers["x-forwarded-host"] = req.headers.host || "";
      req.headers["x-forwarded-proto"] = "https";
      proxy.web(req, res, { target }, (err) => {
        console.error("Proxy error:", err?.message || err);
        res.statusCode = 502;
        res.end("Bad Gateway");
      });
    });

    server.on("upgrade", (req, socket, head) => {
      // changeOrigin so Next receives Host: 127.0.0.1:3001 (avoids "Expected HTTP/" parse errors)
      proxy.ws(req, socket, head, { target, changeOrigin: true }, (err) => {
        // HMR from LAN often triggers this; log once per minute to avoid spam
        if (err && !server._lastWsErrLog) server._lastWsErrLog = 0;
        if (err && Date.now() - server._lastWsErrLog > 60000) {
          server._lastWsErrLog = Date.now();
          console.error("Proxy WS error (HMR from LAN may fail):", err?.message || err);
        }
      });
    });

    server.on("error", (err) => {
      console.error("HTTPS server error:", err.message);
      if (err.code === "EADDRINUSE") {
        console.error("Port", port, "is in use. Try PORT=3002 npm run dev");
      }
      process.exit(1);
    });

    server.listen(port, hostname, () => {
      const lan = getLanIp();
      console.log("> Ready on https://localhost:" + port);
      if (lan) console.log("> LAN: https://" + lan + ":" + port + " (use cert with this IP: mkcert localhost 127.0.0.1 ::1 " + lan + ")");
    });
  })
  .catch((err) => {
    console.error(err.message);
    nextDev.kill();
    process.exit(1);
  });

// Forward kill to child
process.on("SIGINT", () => {
  nextDev.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  nextDev.kill();
  process.exit(0);
});
