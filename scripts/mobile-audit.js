const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const nextPath = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const debugPort = 9222;
const baseUrl = "http://127.0.0.1:3000";
const outputPath = path.join(process.cwd(), ".tmp-mobile-audit.json");
const progressPath = path.join(process.cwd(), ".tmp-mobile-audit-progress.log");
const serverOutPath = path.join(process.cwd(), ".tmp-mobile-server.out.log");
const serverErrPath = path.join(process.cwd(), ".tmp-mobile-server.err.log");
const userDataDir = path.join(process.cwd(), ".tmp-mobile-browser");

const mobileViewport = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logProgress(message) {
  fs.appendFileSync(progressPath, `${new Date().toISOString()} ${message}\n`);
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

async function ensureServerReady() {
  try {
    const response = await fetch(`${baseUrl}/login`);

    if (response.ok) {
      logProgress("server already ready");
      return null;
    }
  } catch {}

  logProgress("starting production server");
  fs.writeFileSync(serverOutPath, "");
  fs.writeFileSync(serverErrPath, "");
  const server = spawn(process.execPath, [nextPath, "start", "-p", "3000"], {
    cwd: process.cwd(),
    stdio: [
      "ignore",
      fs.openSync(serverOutPath, "a"),
      fs.openSync(serverErrPath, "a"),
    ],
  });

  server.on("error", (error) => {
    throw error;
  });

  await waitFor(async () => {
    const response = await fetch(`${baseUrl}/login`);

    if (response.ok) {
      return true;
    }

    throw new Error(`HTTP ${response.status}`);
  }, 30000, "app server");

  logProgress("production server ready");
  return server;
}

async function createPageTarget(url = "about:blank") {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  }).catch(async () =>
    fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`),
  );

  if (!response.ok) {
    throw new Error(`Unable to create page target: HTTP ${response.status}`);
  }

  return response.json();
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();

    this.ws.addEventListener("error", (event) => {
      logProgress(`websocket-error ${event.error?.message ?? "unknown"}`);
    });

    this.ws.addEventListener("close", () => {
      logProgress("websocket-close");
    });

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

        if (payload.id) {
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
          return;
        }

        const listeners = this.listeners.get(payload.method) ?? [];

        for (const listener of listeners) {
          if (listener.sessionId && listener.sessionId !== payload.sessionId) {
            continue;
          }

          listener.handler(payload.params ?? {}, payload.sessionId);
        }
      } catch (error) {
        logProgress(`message-parse-error ${error.message}`);
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

  send(method, params = {}, sessionId, timeoutMs = 5000) {
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

  on(method, handler, sessionId) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push({ handler, sessionId });
    this.listeners.set(method, listeners);

    return () => {
      const next = (this.listeners.get(method) ?? []).filter((entry) => entry.handler !== handler);
      this.listeners.set(method, next);
    };
  }

  waitForEvent(method, timeoutMs = 30000, sessionId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      const unsubscribe = this.on(method, (params) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(params);
      }, sessionId);
    });
  }

  close() {
    this.ws.close();
  }
}

async function setupPage(client, sessionId) {
  logProgress("Page.enable");
  await client.send("Page.enable", {}, sessionId);
  logProgress("Runtime.enable");
  await client.send("Runtime.enable", {}, sessionId);
  logProgress("Network.enable");
  await client.send("Network.enable", {}, sessionId);
  logProgress("DOM.enable");
  await client.send("DOM.enable", {}, sessionId);
  logProgress("Page.setLifecycleEventsEnabled");
  await client.send("Page.setLifecycleEventsEnabled", { enabled: true }, sessionId);
  logProgress("Emulation.setDeviceMetricsOverride");
  await client.send("Emulation.setDeviceMetricsOverride", mobileViewport, sessionId);
  logProgress("Emulation.setTouchEmulationEnabled");
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  logProgress("Emulation.setUserAgentOverride");
  await client.send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    platform: "iPhone",
  }, sessionId);
}

async function evaluate(client, expression, sessionId) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);

  return response.result?.value;
}

async function openTarget(client, url) {
  const expectedPath = new URL(url).pathname;
  const { targetId } = await client.send("Target.createTarget", { url });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await client.send("Target.activateTarget", { targetId });
  logProgress(`target attached ${expectedPath}`);
  await setupPage(client, sessionId);
  await waitFor(async () => {
    const state = await evaluate(
      client,
      "({ path: location.pathname, readyState: document.readyState, title: document.title })",
      sessionId,
    );

    if (state?.path === expectedPath && state?.readyState === "complete") {
      return state;
    }

    throw new Error(`Current state ${JSON.stringify(state)}`);
  }, 30000, `open ${expectedPath}`);

  return { targetId, sessionId };
}

async function closeTarget(client, targetId) {
  await client.send("Target.closeTarget", { targetId }).catch(() => null);
}

async function applySessionCookies(client, cookies) {
  const { targetId, sessionId } = await openTarget(client, "about:blank");

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

async function auditPage(client, label, url) {
  const { targetId, sessionId } = await openTarget(client, url);

  const result = await evaluate(
    client,
    `(() => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const describe = (element) => ({
        tag: element.tagName.toLowerCase(),
        className: String(element.className || '').trim().slice(0, 120),
        text: (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90),
      });

      const visibleElements = Array.from(document.querySelectorAll('body *')).filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });

      const overflowOffenders = visibleElements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            ...describe(element),
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            overflowX: style.overflowX,
          };
        })
        .filter((item) => item.left < -2 || item.right > viewportWidth + 2)
        .slice(0, 12);

      const scrollContainers = visibleElements
        .filter((element) => {
          const style = getComputedStyle(element);
          return /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2;
        })
        .map((element) => ({
          ...describe(element),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }))
        .slice(0, 12);

      const crampedControls = Array.from(document.querySelectorAll('input, select, button, textarea, a'))
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) {
            return false;
          }

          return rect.width < 120 && /^(input|select|button|textarea|a)$/i.test(element.tagName);
        })
        .map((element) => ({
          ...describe(element),
          width: Math.round(element.getBoundingClientRect().width * 100) / 100,
        }))
        .slice(0, 12);

      return {
        path: location.pathname,
        title: document.title,
        viewportWidth,
        viewportHeight,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hasPageHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
        overflowOffenders,
        scrollContainers,
        crampedControls,
      };
    })()`,
    sessionId,
  );

  await closeTarget(client, targetId);

  return {
    label,
    url,
    ...result,
  };
}

async function main() {
  fs.writeFileSync(progressPath, "");
  logProgress("starting mobile audit");
  fs.rmSync(userDataDir, { recursive: true, force: true });
  const server = await ensureServerReady();
  const browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=9222",
      "--remote-debugging-address=127.0.0.1",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  browser.on("error", (error) => {
    throw error;
  });

  try {
    logProgress("waiting for browser debug port");
    const browserInfo = await waitFor(
      () => fetchJson(`http://127.0.0.1:${debugPort}/json/version`),
      15000,
      "browser debug port",
    );
    logProgress("browser debug port ready");
    if (!browserInfo?.webSocketDebuggerUrl) {
      throw new Error("Browser websocket debugger URL was unavailable");
    }

    const publicUser = await prisma.user.findFirst({
      where: { isParticipant: true, isPrivate: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    const privateUser = await prisma.user.findFirst({
      where: { isParticipant: true, isPrivate: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    const client = new CDPClient(browserInfo.webSocketDebuggerUrl);
    logProgress("waiting for websocket open");
    await client.waitForOpen();
    logProgress("websocket open");
    const { targetId: smokeTargetId, sessionId: smokeSessionId } = await openTarget(client, "about:blank");
    logProgress("page setup complete");
    const smokeValue = await evaluate(client, "1 + 1", smokeSessionId);
    logProgress(`runtime smoke ${smokeValue}`);
    await closeTarget(client, smokeTargetId);

    const results = [];
    logProgress("auditing login");
    results.push(await auditPage(client, "login", `${baseUrl}/login`));
    logProgress("auditing signup");
    results.push(await auditPage(client, "signup", `${baseUrl}/signup`));
    logProgress("creating auth session cookies");
    const sessionCookies = await createSessionCookies("mobile-qa-admin@example.com", "TempPass123!");
    logProgress(`received ${sessionCookies.length} auth cookies`);
    await applySessionCookies(client, sessionCookies);
    logProgress("auth cookies applied");
    logProgress("auditing dashboard");
    results.push(await auditPage(client, "dashboard", `${baseUrl}/dashboard`));
    logProgress("auditing admin");
    results.push(await auditPage(client, "admin", `${baseUrl}/admin`));

    if (publicUser) {
      logProgress(`auditing public profile ${publicUser.name}`);
      results.push(
        await auditPage(
          client,
          `public-profile:${publicUser.name}`,
          `${baseUrl}/users/${publicUser.id}`,
        ),
      );
    }

    if (privateUser) {
      logProgress(`auditing private profile ${privateUser.name}`);
      results.push(
        await auditPage(
          client,
          `private-profile:${privateUser.name}`,
          `${baseUrl}/users/${privateUser.id}`,
        ),
      );
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    logProgress("audit complete");
    console.log(JSON.stringify(results, null, 2));
    client.close();
  } finally {
    logProgress("shutting down browser");
    browser.kill("SIGTERM");
    if (server) {
      logProgress("shutting down app server");
      server.kill("SIGTERM");
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
