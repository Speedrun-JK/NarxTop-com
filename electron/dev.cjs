/* `npm run electron:dev` — starts the Vite dev server, waits for it, then opens the desktop window on it.
 * (No extra dependencies: just child_process + net.) */
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 5173; // must match vite.config.js
const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

const vite = spawn(isWin ? "npx.cmd" : "npx", ["vite"], { cwd: root, stdio: "inherit", shell: isWin });

function waitForPort(tries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const socket = net.connect(PORT, HOST);
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("error", () => {
        socket.destroy();
        if (left <= 0) reject(new Error("Vite did not start on port " + PORT));
        else setTimeout(() => attempt(left - 1), 500);
      });
    };
    attempt(tries);
  });
}

waitForPort().then(() => {
  const electronBin = require("electron"); // path to the electron executable
  const app = spawn(electronBin, ["."], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NARX_DEV_URL: `http://${HOST}:${PORT}` },
  });
  app.on("exit", () => { vite.kill(); process.exit(0); });
}).catch((error) => { console.error(error.message); vite.kill(); process.exit(1); });

process.on("SIGINT", () => { vite.kill(); process.exit(0); });
