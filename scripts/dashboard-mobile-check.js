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
  publicEmail: `mobile-dashboard-public-${timestamp}@example.com`,
  publicPassword: "SomePass123!",
  publicName: `Mobile QA Public ${timestamp}`,
  privateName: `Mobile QA Private ${timestamp}`,
  privateEmail: `mobile-dashboard-private-${timestamp}@example.com`,
  thirdName: `Mobile QA Third ${timestamp}`,
  thirdEmail: `mobile-dashboard-third-${timestamp}@example.com`,
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

async function waitForPath(client, sessionId, pathname, timeoutMs = 30000) {
  return waitFor(
    async () => {
      const state = await evaluate(
        client,
        "({ pathname: location.pathname, readyState: document.readyState })",
        sessionId,
      );

      if (state?.pathname === pathname && state.readyState === "complete") {
        return state;
      }

      throw new Error(`Current page state ${JSON.stringify(state)}`);
    },
    timeoutMs,
    `path ${pathname}`,
  );
}

async function clickByRoleAndName(client, sessionId, role, name) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const selector =
        ${JSON.stringify(role)} === 'button'
          ? 'button, [role="button"]'
          : ${JSON.stringify(role)} === 'link'
            ? 'a[href], [role="link"]'
            : '[role="' + ${JSON.stringify(role)} + '"]';
      const target = Array.from(document.querySelectorAll(selector)).find((node) => {
        const accessibleName = normalize(node.getAttribute('aria-label') || node.textContent);
        return isVisible(node) && accessibleName === ${JSON.stringify(name)};
      });

      if (!target) {
        throw new Error('Visible ' + ${JSON.stringify(role)} + ' not found with name ' + ${JSON.stringify(name)});
      }

      target.click();
      return true;
    })()`,
    sessionId,
  );
}

async function auditMobilePage(client, sessionId, expectedActiveNav) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const visible = (node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const describe = (node) => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          name: normalize(node.getAttribute('aria-label') || node.textContent).slice(0, 100),
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        };
      };
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const nav = document.querySelector('nav[aria-label="Primary"]');
      const activeNavItems = nav
        ? Array.from(nav.querySelectorAll('[aria-current="page"]')).filter(visible)
        : [];
      const controlSelector = [
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="tab"]',
        'nav[aria-label="Primary"] a[href]',
      ].join(',');
      const smallControls = Array.from(document.querySelectorAll(controlSelector))
        .filter(visible)
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        })
        .map(describe);
      const undersizedInputs = Array.from(
        document.querySelectorAll('input:not([type="hidden"]), select, textarea'),
      )
        .filter(visible)
        .filter((node) => Number.parseFloat(getComputedStyle(node).fontSize) < 16)
        .map((node) => ({
          ...describe(node),
          fontSize: getComputedStyle(node).fontSize,
        }));
      const overflowOffenders = Array.from(document.querySelectorAll('body *'))
        .filter(visible)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            ...describe(node),
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
          };
        })
        .filter((item) => item.left < -2 || item.right > viewportWidth + 2)
        .slice(0, 10);
      const logWeightTrigger = Array.from(document.querySelectorAll('button')).find(
        (node) =>
          visible(node) &&
          normalize(node.getAttribute('aria-label') || node.textContent) === 'Log weight',
      );
      const triggerRect = logWeightTrigger?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const navItems = nav
        ? Array.from(nav.querySelectorAll('a[href], button'))
            .filter(visible)
            .map((node) => normalize(node.getAttribute('aria-label') || node.textContent))
        : [];

      return {
        path: location.pathname,
        viewportWidth,
        viewportHeight,
        documentWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
        overflowOffenders,
        hasPrimaryNav: Boolean(nav && visible(nav)),
        activeNavNames: activeNavItems.map((node) =>
          normalize(node.getAttribute('aria-label') || node.textContent),
        ),
        expectedActiveNav: ${JSON.stringify(expectedActiveNav)},
        smallControls,
        undersizedInputs,
        hasLogWeightTrigger: Boolean(logWeightTrigger),
        navItems,
        hasLegacyGroupItem: navItems.includes('Group'),
        hasLegacyMoreItem: navItems.includes('More'),
        logWeightIsNavAction: Boolean(logWeightTrigger && nav?.contains(logWeightTrigger)),
        logWeightOverlapsNav: Boolean(
          triggerRect &&
          navRect &&
          !nav?.contains(logWeightTrigger) &&
          triggerRect.bottom > navRect.top + 1 &&
          triggerRect.top < navRect.bottom - 1
        ),
        logWeightTrigger: logWeightTrigger ? describe(logWeightTrigger) : null,
      };
    })()`,
    sessionId,
  );
}

function assertMobilePage(result, { expectLogWeight = true } = {}) {
  const issues = [];

  if (result.viewportWidth !== mobileViewport.width || result.viewportHeight !== mobileViewport.height) {
    issues.push(`viewport is ${result.viewportWidth}x${result.viewportHeight}`);
  }
  if (result.hasHorizontalOverflow) {
    issues.push(`horizontal overflow: ${JSON.stringify(result.overflowOffenders)}`);
  }
  if (!result.hasPrimaryNav) {
    issues.push("primary bottom navigation is missing");
  }
  if (
    result.activeNavNames.length !== 1 ||
    result.activeNavNames[0] !== result.expectedActiveNav
  ) {
    issues.push(
      `expected one active ${result.expectedActiveNav} nav item, got ${JSON.stringify(result.activeNavNames)}`,
    );
  }
  if (result.smallControls.length > 0) {
    issues.push(`controls below 44px: ${JSON.stringify(result.smallControls)}`);
  }
  if (result.undersizedInputs.length > 0) {
    issues.push(`inputs below 16px: ${JSON.stringify(result.undersizedInputs)}`);
  }
  if (expectLogWeight && !result.hasLogWeightTrigger) {
    issues.push("Log weight trigger is missing");
  }
  if (expectLogWeight && !result.logWeightIsNavAction) {
    issues.push("Log weight is not part of the bottom navigation");
  }
  if (result.hasLegacyGroupItem || result.hasLegacyMoreItem) {
    issues.push(`legacy navigation items remain: ${JSON.stringify(result.navItems)}`);
  }
  if (expectLogWeight && result.logWeightOverlapsNav) {
    issues.push("Log weight trigger overlaps the bottom navigation");
  }

  if (issues.length > 0) {
    throw new Error(`Mobile page audit failed:\n- ${issues.join("\n- ")}`);
  }
}

async function auditWeightDialog(client, sessionId) {
  return evaluate(
    client,
    `(() => {
      const visible = (node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const labelledBy = dialog?.getAttribute('aria-labelledby');
      const describedBy = dialog?.getAttribute('aria-describedby');
      const controls = dialog
        ? Array.from(dialog.querySelectorAll('button, input:not([type="hidden"]), select, textarea')).filter(visible)
        : [];

      return {
        hasDialog: Boolean(dialog && visible(dialog)),
        hasAccessibleTitle: Boolean(labelledBy && document.getElementById(labelledBy)),
        hasAccessibleDescription: Boolean(describedBy && document.getElementById(describedBy)),
        focusInsideDialog: Boolean(dialog && document.activeElement && dialog.contains(document.activeElement)),
        focusedControl: normalize(
          document.activeElement?.getAttribute?.('aria-label') ||
          document.activeElement?.getAttribute?.('name') ||
          document.activeElement?.textContent,
        ),
        smallControls: controls
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              name: normalize(node.getAttribute('aria-label') || node.getAttribute('name') || node.textContent),
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            };
          }),
        undersizedInputs: controls
          .filter((node) => node.matches('input, select, textarea'))
          .filter((node) => Number.parseFloat(getComputedStyle(node).fontSize) < 16)
          .map((node) => ({
            name: node.getAttribute('name'),
            fontSize: getComputedStyle(node).fontSize,
          })),
      };
    })()`,
    sessionId,
  );
}

function assertWeightDialog(result) {
  const issues = [];

  if (!result.hasDialog) issues.push("semantic modal dialog is missing");
  if (!result.hasAccessibleTitle) issues.push("dialog has no accessible title");
  if (!result.hasAccessibleDescription) issues.push("dialog has no accessible description");
  if (!result.focusInsideDialog || result.focusedControl !== "weight") {
    issues.push(`initial focus is not on the weight field: ${result.focusedControl || "none"}`);
  }
  if (result.smallControls.length > 0) {
    issues.push(`dialog controls below 44px: ${JSON.stringify(result.smallControls)}`);
  }
  if (result.undersizedInputs.length > 0) {
    issues.push(`dialog inputs below 16px: ${JSON.stringify(result.undersizedInputs)}`);
  }

  if (issues.length > 0) {
    throw new Error(`Weight dialog audit failed:\n- ${issues.join("\n- ")}`);
  }
}

async function pressEscape(client, sessionId) {
  const keyEvent = {
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  };

  await client.send("Input.dispatchKeyEvent", { ...keyEvent, type: "keyDown" }, sessionId);
  await client.send("Input.dispatchKeyEvent", { ...keyEvent, type: "keyUp" }, sessionId);
}

async function selectProfileTab(client, sessionId, name) {
  await clickByRoleAndName(client, sessionId, "tab", name);

  return waitFor(
    async () => {
      const state = await evaluate(
        client,
        `(() => {
          const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
          const tablist = document.querySelector('[role="tablist"][aria-label="Profile sections"]');
          const tabs = tablist ? Array.from(tablist.querySelectorAll('[role="tab"]')) : [];
          const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
          const panel = document.querySelector('[role="tabpanel"]');

          return {
            names: tabs.map((tab) => normalize(tab.textContent)),
            selected: selected ? normalize(selected.textContent) : null,
            panelLabelledBy: panel?.getAttribute('aria-labelledby') || null,
            selectedId: selected?.id || null,
          };
        })()`,
        sessionId,
      );

      if (
        JSON.stringify(state?.names) === JSON.stringify(["Overview", "History", "Rules"]) &&
        state?.selected === name &&
        state.panelLabelledBy === state.selectedId
      ) {
        return state;
      }

      throw new Error(`Profile tab state ${JSON.stringify(state)}`);
    },
    10000,
    `profile tab ${name}`,
  );
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
  // Keep this outside every possible Saturday-Friday check-in window.
  const privateRecent = createUtcDateDaysAgo(7);

  const publicUser = await prisma.user.create({
    data: {
      name: seeded.publicName,
      email: seeded.publicEmail,
      passwordHash: hashSync(seeded.publicPassword, 10),
      isParticipant: true,
      isPrivate: false,
      startWeight: 86.5,
      targetWeight: 76.5,
      targetLossKg: 10,
      monthlyLossTargetKg: 2,
      monthlyPenaltyRm: 30,
      heightCm: 168,
      avatarUrl: "/apple-icon.png",
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

  const privateUser = await prisma.user.create({
    data: {
      name: seeded.privateName,
      email: seeded.privateEmail,
      passwordHash: hashSync("SomePass123!", 10),
      isParticipant: true,
      isPrivate: true,
      startWeight: 74.2,
      targetWeight: 68.2,
      targetLossKg: 6,
      monthlyLossTargetKg: 1,
      monthlyPenaltyRm: 30,
      avatarUrl: "/apple-icon.png",
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

  const thirdUser = await prisma.user.create({
    data: {
      name: seeded.thirdName,
      email: seeded.thirdEmail,
      passwordHash: hashSync("SomePass123!", 10),
      isParticipant: true,
      isPrivate: false,
      startWeight: 72,
      targetWeight: 66,
      targetLossKg: 6,
      monthlyLossTargetKg: 1,
      monthlyPenaltyRm: 30,
      challengeStartDate: createUtcDateDaysAgo(60),
    },
  });

  return {
    adminId: admin.id,
    publicUserId: publicUser.id,
    privateUserId: privateUser.id,
    thirdUserId: thirdUser.id,
  };
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
    const { publicUserId, privateUserId, thirdUserId } = await seedDatabase();
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

    const cookies = await createSessionCookies(seeded.publicEmail, seeded.publicPassword);
    await applySessionCookies(client, cookies);

    const { targetId, sessionId } = await createPage(client, `${baseUrl}/dashboard`);
    await waitForPath(client, sessionId, "/dashboard");
    await delay(1500);

    const dashboardAudit = await auditMobilePage(client, sessionId, "Home");
    assertMobilePage(dashboardAudit);
    const participantListAudit = await evaluate(
      client,
      `(() => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const section = document.querySelector('#participants');
        const cards = section ? [...section.querySelectorAll('article')] : [];
        const expectedNames = ${JSON.stringify([seeded.publicName, seeded.privateName, seeded.thirdName])};
        const cardText = cards.map((card) => normalize(card.textContent));
        const visibleCardCount = cards.filter((card) => {
          const style = getComputedStyle(card);
          const rect = card.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }).length;
        const disclosureText = section
          ? [...section.querySelectorAll('summary')].map((summary) => normalize(summary.textContent))
          : [];

        return {
          cardCount: cards.length,
          visibleCardCount,
          expectedNames,
          visibleNames: expectedNames.filter((name) => cardText.some((text) => text.includes(name))),
          disclosureText,
          hasShowAllControl: disclosureText.some((text) => /^Show all \\d+ participants$/i.test(text)),
          pendingNames: expectedNames.filter((name) => {
            const card = cards.find((item) => normalize(item.textContent).includes(name));
            return card && normalize(card.textContent).includes('Weekly check-in pending');
          }),
          hasCheckInLegend: normalize(section?.textContent).includes('Check-in due'),
        };
      })()`,
      sessionId,
    );

    if (
      participantListAudit.cardCount < participantListAudit.expectedNames.length ||
      participantListAudit.visibleCardCount !== participantListAudit.cardCount ||
      participantListAudit.visibleNames.length !== participantListAudit.expectedNames.length ||
      participantListAudit.hasShowAllControl ||
      !participantListAudit.hasCheckInLegend ||
      JSON.stringify(participantListAudit.pendingNames) !==
        JSON.stringify([seeded.privateName, seeded.thirdName])
    ) {
      throw new Error(`Participant list state ${JSON.stringify(participantListAudit)}`);
    }

    await clickByRoleAndName(client, sessionId, "button", "Overall");
    const overallProgressAudit = await waitFor(
      async () => {
        const state = await evaluate(
          client,
          `(() => {
            const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
            const section = document.querySelector('#participants');
            const buttons = section ? [...section.querySelectorAll('button')] : [];
            const cardText = section
              ? [...section.querySelectorAll('article')].map((card) => normalize(card.textContent))
              : [];
            const pressed = Object.fromEntries(
              buttons.map((button) => [normalize(button.textContent), button.getAttribute('aria-pressed')]),
            );

            return {
              heading: normalize(section?.querySelector('h2')?.textContent),
              pressed,
              hasPublicOverallValue: cardText.some(
                (text) => text.includes(${JSON.stringify(seeded.publicName)}) && text.includes('1.7 kg / 10 kg'),
              ),
              hasPrivateOverallValue: cardText.some(
                (text) => text.includes(${JSON.stringify(seeded.privateName)}) && text.includes('1.75 kg / 6 kg'),
              ),
              hasThirdOverallValue: cardText.some(
                (text) => text.includes(${JSON.stringify(seeded.thirdName)}) && text.includes('0 kg / 6 kg'),
              ),
            };
          })()`,
          sessionId,
        );

        if (
          state.heading === "Overall progress" &&
          state.pressed?.Overall === "true" &&
          state.pressed?.["This month"] === "false" &&
          state.hasPublicOverallValue &&
          state.hasPrivateOverallValue &&
          state.hasThirdOverallValue
        ) {
          return state;
        }

        throw new Error(`Overall progress state ${JSON.stringify(state)}`);
      },
      10000,
      "overall participant progress",
    );

    await clickByRoleAndName(client, sessionId, "button", "This month");
    await waitFor(
      async () => {
        const state = await evaluate(
          client,
          `(() => {
            const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
            const section = document.querySelector('#participants');
            const thisMonthButton = section
              ? [...section.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'This month')
              : null;
            return {
              heading: normalize(section?.querySelector('h2')?.textContent),
              pressed: thisMonthButton?.getAttribute('aria-pressed') || null,
            };
          })()`,
          sessionId,
        );

        if (state.heading === "The club this month" && state.pressed === "true") return state;
        throw new Error(`Monthly progress state ${JSON.stringify(state)}`);
      },
      10000,
      "monthly participant progress restore",
    );

    await clickByRoleAndName(client, sessionId, "button", "Log weight");
    const dialogAudit = await waitFor(
      async () => {
        const audit = await auditWeightDialog(client, sessionId);
        if (audit.hasDialog && audit.focusInsideDialog) return audit;
        throw new Error(`Dialog state ${JSON.stringify(audit)}`);
      },
      10000,
      "weight dialog focus",
    );
    assertWeightDialog(dialogAudit);

    await pressEscape(client, sessionId);
    await waitFor(
      async () => {
        const state = await evaluate(
          client,
          `(() => {
            const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
            const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
            const activeName = normalize(
              document.activeElement?.getAttribute?.('aria-label') ||
              document.activeElement?.textContent,
            );
            return { hasDialog: Boolean(dialog), activeName };
          })()`,
          sessionId,
        );

        if (!state.hasDialog && state.activeName === "Log weight") return state;
        throw new Error(`Dialog close state ${JSON.stringify(state)}`);
      },
      10000,
      "weight dialog Escape close and focus restore",
    );

    await clickByRoleAndName(client, sessionId, "link", "Progress");
    await waitForPath(client, sessionId, `/users/${publicUserId}`);
    await delay(500);

    const profileAudit = await auditMobilePage(client, sessionId, "Progress");
    assertMobilePage(profileAudit);
    const ownAvatarButtonName = `Open ${seeded.publicName}'s profile photo actions`;
    await clickByRoleAndName(client, sessionId, "button", ownAvatarButtonName);
    const ownAvatarMenuAudit = await evaluate(
      client,
      `(() => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const trigger = [...document.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label') === ${JSON.stringify(ownAvatarButtonName)},
        );
        const menu = document.querySelector('[role="menu"][aria-label="Profile photo actions"]');
        const triggerRect = trigger?.getBoundingClientRect();
        const menuRect = menu?.getBoundingClientRect();
        return {
          triggerExpanded: trigger?.getAttribute('aria-expanded'),
          items: menu ? [...menu.querySelectorAll('[role="menuitem"]')].map((item) => normalize(item.textContent)) : [],
          belowAvatar: Boolean(triggerRect && menuRect && menuRect.top >= triggerRect.bottom),
          withinViewport: Boolean(menuRect && menuRect.left >= 0 && menuRect.right <= window.innerWidth),
          hasInlinePhotoButton: [...document.querySelectorAll('button')].some(
            (button) =>
              !button.closest('[role="menu"]') &&
              ['Change photo', 'Remove'].includes(normalize(button.textContent)),
          ),
        };
      })()`,
      sessionId,
    );
    if (
      ownAvatarMenuAudit.triggerExpanded !== "true" ||
      JSON.stringify(ownAvatarMenuAudit.items) !==
        JSON.stringify(["View photo", "Change photo", "Remove photo"]) ||
      !ownAvatarMenuAudit.belowAvatar ||
      !ownAvatarMenuAudit.withinViewport ||
      ownAvatarMenuAudit.hasInlinePhotoButton
    ) {
      throw new Error(`Own avatar menu state ${JSON.stringify(ownAvatarMenuAudit)}`);
    }

    await clickByRoleAndName(client, sessionId, "menuitem", "View photo");
    const photoViewerAudit = await waitFor(
      async () => {
        const audit = await evaluate(
          client,
          `(() => {
            const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
            const image = dialog?.querySelector('img');
            return {
              hasDialog: Boolean(dialog),
              dialogLabel: dialog?.getAttribute('aria-label') || null,
              imageAlt: image?.getAttribute('alt') || null,
              focusInside: Boolean(dialog?.contains(document.activeElement)),
              bodyLocked: document.body.style.overflow === 'hidden',
            };
          })()`,
          sessionId,
        );
        if (audit.hasDialog && audit.focusInside) return audit;
        throw new Error(`Photo viewer state ${JSON.stringify(audit)}`);
      },
      10000,
      "enlarged profile photo viewer",
    );
    if (
      photoViewerAudit.dialogLabel !== `${seeded.publicName}'s profile photo` ||
      photoViewerAudit.imageAlt !== `${seeded.publicName}'s enlarged profile photo` ||
      !photoViewerAudit.bodyLocked
    ) {
      throw new Error(`Photo viewer accessibility ${JSON.stringify(photoViewerAudit)}`);
    }
    await clickByRoleAndName(client, sessionId, "button", "Close enlarged profile photo");
    await waitFor(
      async () => {
        const state = await evaluate(
          client,
          `(() => ({
            hasDialog: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
            focusedName: document.activeElement?.getAttribute?.('aria-label') || null,
          }))()`,
          sessionId,
        );
        if (!state.hasDialog && state.focusedName === ownAvatarButtonName) return state;
        throw new Error(`Photo viewer close state ${JSON.stringify(state)}`);
      },
      10000,
      "photo viewer close and focus restore",
    );

    await clickByRoleAndName(client, sessionId, "button", ownAvatarButtonName);
    await pressEscape(client, sessionId);
    const escapeAudit = await waitFor(
      async () => {
        const state = await evaluate(
          client,
          `(() => ({
            hasMenu: Boolean(document.querySelector('[role="menu"][aria-label="Profile photo actions"]')),
            focusedName: document.activeElement?.getAttribute?.('aria-label') || null,
          }))()`,
          sessionId,
        );
        if (!state.hasMenu && state.focusedName === ownAvatarButtonName) return state;
        throw new Error(`Avatar menu Escape state ${JSON.stringify(state)}`);
      },
      10000,
      "avatar menu Escape and focus restore",
    );

    await clickByRoleAndName(client, sessionId, "button", ownAvatarButtonName);
    await evaluate(
      client,
      "document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))",
      sessionId,
    );
    const outsideTapAudit = await waitFor(
      async () => {
        const state = await evaluate(
          client,
          `(() => ({
            hasMenu: Boolean(document.querySelector('[role="menu"][aria-label="Profile photo actions"]')),
            focusedName: document.activeElement?.getAttribute?.('aria-label') || null,
          }))()`,
          sessionId,
        );
        if (!state.hasMenu && state.focusedName === ownAvatarButtonName) return state;
        throw new Error(`Avatar menu outside-tap state ${JSON.stringify(state)}`);
      },
      10000,
      "avatar menu outside tap and focus restore",
    );
    const overviewTab = await selectProfileTab(client, sessionId, "Overview");
    const historyTab = await selectProfileTab(client, sessionId, "History");
    const rulesTab = await selectProfileTab(client, sessionId, "Rules");

    await client.send("Page.navigate", { url: `${baseUrl}/users/${privateUserId}` }, sessionId);
    await waitForPath(client, sessionId, `/users/${privateUserId}`);
    await delay(500);
    const otherPhotoButtonName = `Open ${seeded.privateName}'s profile photo actions`;
    await clickByRoleAndName(client, sessionId, "button", otherPhotoButtonName);
    const otherPhotoMenu = await evaluate(
      client,
      `(() => {
        const menu = document.querySelector('[role="menu"][aria-label="Profile photo actions"]');
        return menu ? [...menu.querySelectorAll('[role="menuitem"]')].map(
          (item) => String(item.textContent || '').replace(/\\s+/g, ' ').trim(),
        ) : [];
      })()`,
      sessionId,
    );
    if (JSON.stringify(otherPhotoMenu) !== JSON.stringify(["View photo"])) {
      throw new Error(`Other participant photo menu ${JSON.stringify(otherPhotoMenu)}`);
    }

    await client.send("Page.navigate", { url: `${baseUrl}/users/${thirdUserId}` }, sessionId);
    await waitForPath(client, sessionId, `/users/${thirdUserId}`);
    await delay(500);
    const otherNoPhotoAudit = await evaluate(
      client,
      `(() => ({
        hasAvatarButton: [...document.querySelectorAll('button')].some(
          (button) => String(button.getAttribute('aria-label') || '').startsWith('Open ') &&
            String(button.getAttribute('aria-label') || '').endsWith('profile photo actions'),
        ),
      }))()`,
      sessionId,
    );
    if (otherNoPhotoAudit.hasAvatarButton) {
      throw new Error(`Other no-photo avatar state ${JSON.stringify(otherNoPhotoAudit)}`);
    }

    const thirdCookies = await createSessionCookies(seeded.thirdEmail, "SomePass123!");
    await applySessionCookies(client, thirdCookies);
    await client.send("Page.navigate", { url: `${baseUrl}/users/${thirdUserId}` }, sessionId);
    await waitForPath(client, sessionId, `/users/${thirdUserId}`);
    await delay(500);
    const ownNoPhotoButtonName = `Open ${seeded.thirdName}'s profile photo actions`;
    await clickByRoleAndName(client, sessionId, "button", ownNoPhotoButtonName);
    const ownNoPhotoMenu = await evaluate(
      client,
      `(() => {
        const menu = document.querySelector('[role="menu"][aria-label="Profile photo actions"]');
        return menu ? [...menu.querySelectorAll('[role="menuitem"]')].map(
          (item) => String(item.textContent || '').replace(/\\s+/g, ' ').trim(),
        ) : [];
      })()`,
      sessionId,
    );
    if (JSON.stringify(ownNoPhotoMenu) !== JSON.stringify(["Add photo"])) {
      throw new Error(`Own no-photo avatar menu ${JSON.stringify(ownNoPhotoMenu)}`);
    }

    const result = {
      status: "passed",
      dashboard: dashboardAudit,
      participantList: {
        ...participantListAudit,
        overallProgress: overallProgressAudit,
      },
      weightDialog: dialogAudit,
      profile: {
        avatarControl: {
          ownWithPhoto: ownAvatarMenuAudit,
          viewer: photoViewerAudit,
          escape: escapeAudit,
          outsideTap: outsideTapAudit,
          otherWithPhoto: otherPhotoMenu,
          otherWithoutPhoto: otherNoPhotoAudit,
          ownWithoutPhoto: ownNoPhotoMenu,
        },
        layout: profileAudit,
        tabs: [overviewTab, historyTab, rulesTab],
      },
    };

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
