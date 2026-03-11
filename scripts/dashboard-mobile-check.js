const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { hashSync } = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const nextPath = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const timestamp = Date.now();
const basePort = 3102;
const debugPort = 9226;
const baseUrl = `http://127.0.0.1:${basePort}`;
const outputPath = path.join(process.cwd(), ".tmp-dashboard-mobile-check.json");
const progressPath = path.join(process.cwd(), ".tmp-dashboard-mobile-check.log");
const serverOutPath = path.join(process.cwd(), ".tmp-dashboard-mobile-check.server.out.log");
const serverErrPath = path.join(process.cwd(), ".tmp-dashboard-mobile-check.server.err.log");
const userDataDir = path.join(process.cwd(), `.tmp-dashboard-mobile-browser-${timestamp}`);

const mobileViewport = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
};

const seeded = {
  adminEmail: `mobile-dashboard-admin-${timestamp}@example.com`,
  adminPassword: "TempPass123!",
  adminName: `Mobile QA Admin ${timestamp}`,
  publicName: `Mobile QA Public ${timestamp}`,
  privateName: `Mobile QA Private ${timestamp}`,
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logProgress(message) {
  fs.appendFileSync(progressPath, `${new Date().toISOString()} ${message}\n`);
}

function formatDateInput(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createUtcDateDaysAgo(daysAgo) {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 12, 0, 0));
}

async function waitFor(task, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }

  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ""}`);
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();

    this.ws.addEventListener("message", async (event) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : event.data instanceof ArrayBuffer
              ? Buffer.from(event.data).toString("utf8")
              : ArrayBuffer.isView(event.data)
                ? Buffer.from(event.data.buffer, event.data.byteOffset, event.data.byteLength).toString("utf8")
                : typeof event.data?.text === "function"
                  ? await event.data.text()
                  : Buffer.isBuffer(event.data)
                    ? event.data.toString("utf8")
                    : String(event.data);
        const payload = JSON.parse(raw);

        if (!payload.id) {
          return;
        }

        const pending = this.pending.get(payload.id);

        if (!pending) {
          return;
        }

        this.pending.delete(payload.id);

        if (payload.error) {
          pending.reject(new Error(payload.error.message));
          return;
        }

        pending.resolve(payload.result);
      } catch (error) {
        logProgress(`cdp-message-error ${error.message}`);
      }
    });
  }

  async waitForOpen() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        this.ws.removeEventListener("open", onOpen);
        this.ws.removeEventListener("error", onError);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (event) => {
        cleanup();
        reject(event.error ?? event);
      };

      this.ws.addEventListener("open", onOpen);
      this.ws.addEventListener("error", onError);
    });
  }

  send(method, params = {}, sessionId, timeoutMs = 10000) {
    const id = ++this.nextId;
    const payload = { id, method, params };

    if (sessionId) {
      payload.sessionId = sessionId;
    }

    this.ws.send(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(client, expression, sessionId) {
  const response = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
    15000,
  );

  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "Evaluation failed",
    );
  }

  return response.result?.value;
}

async function setupPage(client, sessionId) {
  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Network.enable", {}, sessionId);
  await client.send("DOM.enable", {}, sessionId);
  await client.send("Emulation.setDeviceMetricsOverride", mobileViewport, sessionId);
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await client.send(
    "Emulation.setUserAgentOverride",
    {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    },
    sessionId,
  );
}

async function createPage(client, url) {
  const { targetId } = await client.send("Target.createTarget", { url });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  await client.send("Target.activateTarget", { targetId });
  await setupPage(client, sessionId);

  return { targetId, sessionId };
}

async function closeTarget(client, targetId) {
  await client.send("Target.closeTarget", { targetId }).catch(() => null);
}

function parseCookieHeader(cookieHeader) {
  const segments = cookieHeader.split(";").map((part) => part.trim());
  const [nameValue, ...attributeParts] = segments;
  const separatorIndex = nameValue.indexOf("=");
  const name = nameValue.slice(0, separatorIndex);
  const value = nameValue.slice(separatorIndex + 1);
  const attributes = {
    name,
    value,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  };

  for (const part of attributeParts) {
    const [rawKey, rawValue] = part.split("=");
    const key = rawKey.toLowerCase();
    const valuePart = rawValue ?? "";

    if (key === "path") {
      attributes.path = valuePart;
    } else if (key === "httponly") {
      attributes.httpOnly = true;
    } else if (key === "secure") {
      attributes.secure = true;
    } else if (key === "samesite") {
      attributes.sameSite = valuePart.charAt(0).toUpperCase() + valuePart.slice(1).toLowerCase();
    }
  }

  return attributes;
}

async function createSessionCookies(email, password) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfPayload = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie();
  const body = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/dashboard`,
    json: "true",
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials?json=true`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: csrfCookies.join("; "),
    },
    body,
    redirect: "manual",
  });
  const loginCookies = loginResponse.headers.getSetCookie();

  if (!loginCookies.length) {
    throw new Error("No session cookies were returned from login");
  }

  return loginCookies.map(parseCookieHeader);
}

async function applySessionCookies(client, cookies) {
  const { targetId, sessionId } = await createPage(client, "about:blank");

  for (const cookie of cookies) {
    await client.send(
      "Network.setCookie",
      {
        name: cookie.name,
        value: cookie.value,
        url: baseUrl,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      },
      sessionId,
    );
  }

  await closeTarget(client, targetId);
}

async function ensureServerReady() {
  fs.writeFileSync(serverOutPath, "");
  fs.writeFileSync(serverErrPath, "");

  const env = {
    ...process.env,
    PORT: String(basePort),
    NEXTAUTH_URL: baseUrl,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "mobile-check-secret",
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: "",
  };

  const server = spawn(process.execPath, [nextPath, "start", "-p", String(basePort)], {
    cwd: process.cwd(),
    env,
    stdio: [
      "ignore",
      fs.openSync(serverOutPath, "a"),
      fs.openSync(serverErrPath, "a"),
    ],
  });

  await waitFor(async () => {
    const response = await fetch(`${baseUrl}/login`);

    if (response.ok) {
      return true;
    }

    throw new Error(`HTTP ${response.status}`);
  }, 30000, "mobile dashboard server");

  return server;
}

async function seedDatabase() {
  await prisma.user.deleteMany({
    where: {
      name: {
        startsWith: "Mobile QA ",
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: seeded.adminName,
      email: seeded.adminEmail,
      passwordHash: hashSync(seeded.adminPassword, 10),
      isAdmin: true,
      isParticipant: false,
    },
  });

  const publicStart = createUtcDateDaysAgo(35);
  const publicRecent = createUtcDateDaysAgo(2);
  const privateStart = createUtcDateDaysAgo(42);
  const privateRecent = createUtcDateDaysAgo(3);

  await prisma.user.create({
    data: {
      name: seeded.publicName,
      email: `mobile-dashboard-public-${timestamp}@example.com`,
      passwordHash: hashSync("SomePass123!", 10),
      isParticipant: true,
      isPrivate: false,
      startWeight: 86.5,
      targetWeight: 76.5,
      targetLossKg: 10,
      monthlyLossTargetKg: 2,
      monthlyPenaltyRm: 30,
      heightCm: 168,
      challengeStartDate: createUtcDateDaysAgo(60),
      weightEntries: {
        create: [
          {
            entryType: "ABSOLUTE",
            weight: 86.5,
            date: publicStart,
          },
          {
            entryType: "ABSOLUTE",
            weight: 84.8,
            date: publicRecent,
          },
        ],
      },
    },
  });

  await prisma.user.create({
    data: {
      name: seeded.privateName,
      email: `mobile-dashboard-private-${timestamp}@example.com`,
      passwordHash: hashSync("SomePass123!", 10),
      isParticipant: true,
      isPrivate: true,
      startWeight: 74.2,
      targetWeight: 68.2,
      targetLossKg: 6,
      monthlyLossTargetKg: 1,
      monthlyPenaltyRm: 30,
      challengeStartDate: createUtcDateDaysAgo(60),
      weightEntries: {
        create: [
          {
            entryType: "LOSS_DELTA",
            lossKg: 1.2,
            date: privateStart,
          },
          {
            entryType: "LOSS_DELTA",
            lossKg: 0.55,
            date: privateRecent,
          },
        ],
      },
    },
  });

  return admin.id;
}

async function cleanupDatabase() {
  await prisma.user.deleteMany({
    where: {
      name: {
        startsWith: "Mobile QA ",
      },
    },
  });
}

async function main() {
  fs.writeFileSync(progressPath, "");
  fs.rmSync(outputPath, { force: true });
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}

  let server = null;
  let browser = null;
  let client = null;

  try {
    await cleanupDatabase();
    await seedDatabase();
    server = await ensureServerReady();

    browser = spawn(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        `--remote-debugging-port=${debugPort}`,
        "--remote-debugging-address=127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${userDataDir}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    const browserInfo = await waitFor(
      () => fetchJson(`http://127.0.0.1:${debugPort}/json/version`),
      15000,
      "browser debug port",
    );

    client = new CDPClient(browserInfo.webSocketDebuggerUrl);
    await client.waitForOpen();

    const cookies = await createSessionCookies(seeded.adminEmail, seeded.adminPassword);
    await applySessionCookies(client, cookies);

    const { targetId, sessionId } = await createPage(client, `${baseUrl}/dashboard`);
    await waitFor(
      async () => {
        const state = await evaluate(
          client,
          "({ path: location.pathname, readyState: document.readyState })",
          sessionId,
        );

        if (state?.path === "/dashboard" && state.readyState === "complete") {
          return true;
        }

        throw new Error(`Current state ${JSON.stringify(state)}`);
      },
      30000,
      "dashboard ready",
    );

    await delay(1500);

    const result = await evaluate(
      client,
      `(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
        const visible = (node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();

          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const visibleElements = Array.from(document.querySelectorAll('body *')).filter((element) => visible(element));
        const userCards = Array.from(document.querySelectorAll('article')).filter((article) =>
          visible(article) && Array.from(article.querySelectorAll('a')).some((link) => normalize(link.textContent || '') === 'View profile'),
        );

        const overflowOffenders = visibleElements
          .map((element) => {
            const rect = element.getBoundingClientRect();

            return {
              tag: element.tagName.toLowerCase(),
              text: normalize(element.innerText || element.textContent || '').slice(0, 80),
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })
          .filter((item) => item.left < -2 || item.right > viewportWidth + 2)
          .slice(0, 10);

        return {
          path: location.pathname,
          viewportWidth,
          viewportHeight,
          docScrollWidth: document.documentElement.scrollWidth,
          hasPageHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
          userCardCount: userCards.length,
          userCardHeights: userCards.map((card) => Math.round(card.getBoundingClientRect().height)),
          headerHeight: Math.round(document.querySelector('header')?.getBoundingClientRect().height || 0),
          summaryTileCount: document.querySelectorAll('section .panel').length,
          overflowOffenders,
          dashboardTextSample: normalize(document.body.innerText || '').slice(0, 500),
        };
      })()`,
      sessionId,
    );

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));

    await closeTarget(client, targetId);
  } finally {
    if (client) {
      client.close();
    }

    if (browser) {
      browser.kill("SIGTERM");
    }

    if (server) {
      server.kill("SIGTERM");
    }

    await cleanupDatabase();
    await prisma.$disconnect();

    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(async (error) => {
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        status: "failed",
        error: error.message,
      },
      null,
      2,
    ),
  );
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  process.exitCode = 1;
});
