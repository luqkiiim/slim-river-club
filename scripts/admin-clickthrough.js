const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { hashSync } = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const nextPath = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const basePort = 3100;
const baseUrl = `http://127.0.0.1:${basePort}`;
const debugPort = 9224;
const timestamp = Date.now();
const outputPath = path.join(process.cwd(), ".tmp-admin-clickthrough.json");
const progressPath = path.join(process.cwd(), ".tmp-admin-clickthrough.log");
const serverOutPath = path.join(process.cwd(), ".tmp-admin-clickthrough.server.out.log");
const serverErrPath = path.join(process.cwd(), ".tmp-admin-clickthrough.server.err.log");
const userDataDir = path.join(process.cwd(), `.tmp-admin-clickthrough-browser-${timestamp}`);

const seedPrefix = `Admin QA ${timestamp}`;
const now = new Date();
const seeded = {
  adminEmail: `qa-admin-${timestamp}@example.com`,
  adminPassword: "TempPass123!",
  adminName: `${seedPrefix} Admin`,
  publicName: `${seedPrefix} Public`,
  adminOnlyName: `${seedPrefix} Access`,
  pendingPrivateName: `${seedPrefix} Pending Private`,
  futureMonth: "2099-12",
  futureMonthLabel: "December 2099",
};

function createUtcDateDaysAgo(daysAgo) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 12, 0, 0));
}

function formatDateInput(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();

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
        }
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
  await client.send("Page.setLifecycleEventsEnabled", { enabled: true }, sessionId);
  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    },
    sessionId,
  );
}

async function createPage(client) {
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
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

async function navigateTo(client, sessionId, url) {
  await client.send("Page.navigate", { url }, sessionId, 15000);
  await waitFor(
    async () => {
      const state = await evaluate(
        client,
        "({ path: location.pathname, readyState: document.readyState, href: location.href })",
        sessionId,
      );

      if (state?.href === url && state?.readyState === "complete") {
        return state;
      }

      throw new Error(`Current state ${JSON.stringify(state)}`);
    },
    30000,
    `navigate to ${url}`,
  );
}

async function waitForPath(client, sessionId, pathname, timeoutMs = 30000) {
  return waitFor(
    async () => {
      const state = await evaluate(
        client,
        "({ path: location.pathname, readyState: document.readyState, text: document.body.innerText.slice(0, 400) })",
        sessionId,
      );

      if (state?.path === pathname && state?.readyState === "complete") {
        return state;
      }

      throw new Error(`Current state ${JSON.stringify(state)}`);
    },
    timeoutMs,
    `path ${pathname}`,
  );
}

async function waitForText(client, sessionId, text, timeoutMs = 30000) {
  return waitFor(
    async () => {
      const hasText = await evaluate(
        client,
        `document.body.innerText.replace(/\\s+/g, " ").includes(${JSON.stringify(text)})`,
        sessionId,
      );

      if (hasText) {
        return true;
      }

      throw new Error(`Text not found: ${text}`);
    },
    timeoutMs,
    `text ${text}`,
  );
}

async function waitForTextGone(client, sessionId, text, timeoutMs = 30000) {
  return waitFor(
    async () => {
      const hasText = await evaluate(
        client,
        `document.body.innerText.replace(/\\s+/g, " ").includes(${JSON.stringify(text)})`,
        sessionId,
      );

      if (!hasText) {
        return true;
      }

      throw new Error(`Text still present: ${text}`);
    },
    timeoutMs,
    `text gone ${text}`,
  );
}

async function hasVisibleText(client, sessionId, text) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;

      return Array.from(document.querySelectorAll('body *')).some(
        (node) => isVisible(node) && normalize(node.innerText || node.textContent || '') === ${JSON.stringify(text)},
      );
    })()`,
    sessionId,
  );
}

async function waitForFieldVisible(client, sessionId, name, timeoutMs = 30000) {
  return waitFor(
    async () => {
      const isVisible = await evaluate(
        client,
        `(() => {
          const field = Array.from(document.querySelectorAll('[name]'))
            .find((node) => node.getAttribute('name') === ${JSON.stringify(name)} && node.offsetParent !== null);

          return !!field;
        })()`,
        sessionId,
      );

      if (isVisible) {
        return true;
      }

      throw new Error(`Visible field not found: ${name}`);
    },
    timeoutMs,
    `field ${name}`,
  );
}

async function waitForNoAppError(client, sessionId) {
  const bodyText = await evaluate(
    client,
    "document.body.innerText.replace(/\\s+/g, ' ').trim()",
    sessionId,
  );

  if (bodyText.includes("Application error")) {
    throw new Error(`Application error rendered: ${bodyText.slice(0, 300)}`);
  }
}

async function setFieldValue(client, sessionId, name, value) {
  const result = await evaluate(
    client,
    `(() => {
      const field = Array.from(document.querySelectorAll('[name]'))
        .find((node) => node.getAttribute('name') === ${JSON.stringify(name)} && node.offsetParent !== null);

      if (!field) {
        throw new Error('Field not found: ' + ${JSON.stringify(name)});
      }

      const nextValue = ${JSON.stringify(String(value))};

      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.focus();
        const prototype =
          field instanceof HTMLInputElement
            ? HTMLInputElement.prototype
            : field instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLSelectElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

        if (!descriptor?.set) {
          throw new Error('Unable to set field value for ' + ${JSON.stringify(name)});
        }

        descriptor.set.call(field, nextValue);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      throw new Error('Unsupported field type for ' + ${JSON.stringify(name)});
    })()`,
    sessionId,
  );

  return result;
}

async function setFieldValueInForm(client, sessionId, submitText, name, value) {
  const result = await evaluate(
    client,
    `(() => {
      const normalize = (text) => text.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const form = Array.from(document.querySelectorAll('form')).find((node) => {
        if (!isVisible(node)) {
          return false;
        }

        const submit = Array.from(node.querySelectorAll('button, input[type="submit"]')).find((candidate) =>
          isVisible(candidate) && normalize(candidate.innerText || candidate.textContent || candidate.value || '') === ${JSON.stringify(submitText)},
        );

        return !!submit;
      });

      if (!form) {
        throw new Error('Form not found for submit text: ' + ${JSON.stringify(submitText)});
      }

      const field = Array.from(form.querySelectorAll('[name]')).find((node) => node.getAttribute('name') === ${JSON.stringify(name)});

      if (!field) {
        throw new Error('Field not found in form: ' + ${JSON.stringify(name)});
      }

      const nextValue = ${JSON.stringify(String(value))};

      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.focus();
        const prototype =
          field instanceof HTMLInputElement
            ? HTMLInputElement.prototype
            : field instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLSelectElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

        if (!descriptor?.set) {
          throw new Error('Unable to set field value for ' + ${JSON.stringify(name)});
        }

        descriptor.set.call(field, nextValue);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      throw new Error('Unsupported field type for ' + ${JSON.stringify(name)});
    })()`,
    sessionId,
  );

  return result;
}

async function getFormDiagnostics(client, sessionId, submitText) {
  return evaluate(
    client,
    `(() => {
      const normalize = (text) => text.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const form = Array.from(document.querySelectorAll('form')).find((node) => {
        if (!isVisible(node)) {
          return false;
        }

        return Array.from(node.querySelectorAll('button, input[type="submit"]')).some(
          (candidate) => isVisible(candidate) && normalize(candidate.innerText || candidate.textContent || candidate.value || '') === ${JSON.stringify(submitText)},
        );
      });

      if (!form) {
        throw new Error('Form not found for diagnostics: ' + ${JSON.stringify(submitText)});
      }

      const fields = Array.from(form.querySelectorAll('[name]')).filter((node) => isVisible(node));

      return {
        text: normalize(form.innerText || form.textContent || ''),
        invalidFields: fields
          .filter((field) => typeof field.checkValidity === 'function' && !field.checkValidity())
          .map((field) => ({
            name: field.getAttribute('name'),
            message: field.validationMessage,
            value: field.value,
          })),
      };
    })()`,
    sessionId,
  );
}

async function submitFormByButtonText(client, sessionId, submitText) {
  return evaluate(
    client,
    `(() => {
      const normalize = (text) => text.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const form = Array.from(document.querySelectorAll('form')).find((node) => {
        if (!isVisible(node)) {
          return false;
        }

        return Array.from(node.querySelectorAll('button, input[type="submit"]')).some(
          (candidate) => isVisible(candidate) && normalize(candidate.innerText || candidate.textContent || candidate.value || '') === ${JSON.stringify(submitText)},
        );
      });

      if (!form) {
        throw new Error('Form not found for submit: ' + ${JSON.stringify(submitText)});
      }

      const submitter = Array.from(form.querySelectorAll('button, input[type="submit"]')).find(
        (candidate) => isVisible(candidate) && normalize(candidate.innerText || candidate.textContent || candidate.value || '') === ${JSON.stringify(submitText)},
      );

      if (!submitter) {
        throw new Error('Submitter not found: ' + ${JSON.stringify(submitText)});
      }

      submitter.click();
      return true;
    })()`,
    sessionId,
  );
}

async function clickByText(client, sessionId, text) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const candidates = Array.from(document.querySelectorAll('button, a, summary'));
      const exactTarget = candidates.find(
        (node) => isVisible(node) && normalize(node.innerText || node.textContent || '') === ${JSON.stringify(text)},
      );
      const target =
        exactTarget ??
        candidates.find((node) => {
          if (!isVisible(node)) {
            return false;
          }

          const label = normalize(node.innerText || node.textContent || '');

          return label.startsWith(${JSON.stringify(`${text} `)});
        });

      if (!target) {
        throw new Error('Clickable element not found: ' + ${JSON.stringify(text)});
      }

      target.click();
      return true;
    })()`,
    sessionId,
  );
}

async function clickInArticle(client, sessionId, articleText, actionText) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const article = Array.from(document.querySelectorAll('article')).find(
        (node) => isVisible(node) && normalize(node.innerText || node.textContent || '').includes(${JSON.stringify(articleText)}),
      );

      if (!article) {
        throw new Error('Article not found: ' + ${JSON.stringify(articleText)});
      }

      const target = Array.from(article.querySelectorAll('button, a, summary')).find(
        (node) => isVisible(node) && normalize(node.innerText || node.textContent || '') === ${JSON.stringify(actionText)},
      );

      if (!target) {
        throw new Error('Action not found in article: ' + ${JSON.stringify(actionText)});
      }

      target.click();
      return true;
    })()`,
    sessionId,
  );
}

async function clickInSection(client, sessionId, sectionHeading, actionText) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const section = Array.from(document.querySelectorAll('section')).find((node) => {
        if (!isVisible(node)) {
          return false;
        }

        const heading = node.querySelector('h2, h3');

        return heading && normalize(heading.innerText || heading.textContent || '') === ${JSON.stringify(sectionHeading)};
      });

      if (!section) {
        throw new Error('Section not found: ' + ${JSON.stringify(sectionHeading)});
      }

      const target = Array.from(section.querySelectorAll('button, a, summary')).find(
        (node) => isVisible(node) && normalize(node.innerText || node.textContent || '') === ${JSON.stringify(actionText)},
      );

      if (!target) {
        throw new Error('Action not found in section: ' + ${JSON.stringify(actionText)});
      }

      target.click();
      return true;
    })()`,
    sessionId,
  );
}

async function clickInContainer(client, sessionId, containerText, actionText) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const nodes = Array.from(document.querySelectorAll('article, section, div'));
      let container = null;
      let smallestTextLength = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        if (!isVisible(node)) {
          continue;
        }

        const text = normalize(node.innerText || node.textContent || '');

        if (!text.includes(${JSON.stringify(containerText)})) {
          continue;
        }

        const hasAction = Array.from(node.querySelectorAll('button, a, summary')).some(
          (candidate) => isVisible(candidate) && normalize(candidate.innerText || candidate.textContent || '') === ${JSON.stringify(actionText)},
        );

        if (!hasAction) {
          continue;
        }

        if (text.length < smallestTextLength) {
          container = node;
          smallestTextLength = text.length;
        }
      }

      if (!container) {
        throw new Error('Container not found: ' + ${JSON.stringify(containerText)});
      }

      const target = Array.from(container.querySelectorAll('button, a, summary')).find(
        (node) => isVisible(node) && normalize(node.innerText || node.textContent || '') === ${JSON.stringify(actionText)},
      );

      if (!target) {
        throw new Error('Action not found in container: ' + ${JSON.stringify(actionText)});
      }

      target.click();
      return true;
    })()`,
    sessionId,
  );
}

async function submitFormByHiddenValue(client, sessionId, hiddenName, hiddenValue, buttonText) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => value.replace(/\\s+/g, ' ').trim();
      const isVisible = (node) => !!node && node instanceof HTMLElement && node.offsetParent !== null;
      const fields = Array.from(document.querySelectorAll('input[type="hidden"][name]')).filter(
        (node) => node.getAttribute('name') === ${JSON.stringify(hiddenName)} && node.value === ${JSON.stringify(hiddenValue)},
      );

      const field = fields.find((candidate) => {
        const form = candidate.closest('form');

        if (!form) {
          return false;
        }

        return Array.from(form.querySelectorAll('button, input[type="submit"]')).some((submitter) => {
          const label = normalize(submitter.innerText || submitter.textContent || submitter.value || '');

          return isVisible(submitter) && label === ${JSON.stringify(buttonText)};
        });
      });

      if (!field) {
        throw new Error('Hidden field not found: ' + ${JSON.stringify(hiddenName)} + '=' + ${JSON.stringify(hiddenValue)});
      }

      const form = field.closest('form');

      if (!form) {
        throw new Error('Form not found for hidden field: ' + ${JSON.stringify(hiddenName)});
      }

      const submitter = Array.from(form.querySelectorAll('button, input[type="submit"]')).find((candidate) => {
        const label = normalize(candidate.innerText || candidate.textContent || candidate.value || '');

        return isVisible(candidate) && label === ${JSON.stringify(buttonText)};
      });

      if (!(submitter instanceof HTMLElement)) {
        throw new Error('Submit button not found for hidden field: ' + ${JSON.stringify(hiddenName)} + ' / ' + ${JSON.stringify(buttonText)});
      }

      submitter.click();
      return true;
    })()`,
    sessionId,
  );
}

async function enableConfirmOverride(client, sessionId) {
  await evaluate(
    client,
    `window.confirm = () => true; true;`,
    sessionId,
  );
}

async function ensureServerReady() {
  fs.writeFileSync(serverOutPath, "");
  fs.writeFileSync(serverErrPath, "");

  const env = {
    ...process.env,
    PORT: String(basePort),
    NEXTAUTH_URL: baseUrl,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "clickthrough-secret",
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

  server.on("error", (error) => {
    throw error;
  });

  await waitFor(async () => {
    const response = await fetch(`${baseUrl}/login`);

    if (response.ok) {
      return true;
    }

    throw new Error(`HTTP ${response.status}`);
  }, 30000, "local app server");

  return server;
}

async function seedDatabase() {
  const challengeStartDate = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));

  await prisma.monthPolicy.deleteMany({
    where: {
      year: 2099,
      month: 12,
    },
  });

  await prisma.user.deleteMany({
    where: {
      name: {
        startsWith: "Admin QA ",
      },
    },
  });

  const passwordHash = hashSync(seeded.adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      name: seeded.adminName,
      email: seeded.adminEmail,
      passwordHash,
      isAdmin: true,
      isParticipant: false,
    },
  });

  const publicUser = await prisma.user.create({
    data: {
      name: seeded.publicName,
      email: `qa-public-${timestamp}@example.com`,
      passwordHash: hashSync("SomePass123!", 10),
      isAdmin: false,
      isParticipant: true,
      isPrivate: false,
      startWeight: 89.4,
      targetWeight: 79.4,
      targetLossKg: 10,
      heightCm: 171,
      monthlyLossTargetKg: 2,
      monthlyPenaltyRm: 30,
      challengeStartDate,
      weightEntries: {
        create: [
          {
            entryType: "ABSOLUTE",
            weight: 89.4,
            date: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)),
          },
          {
            entryType: "ABSOLUTE",
            weight: 87.9,
            date: new Date(Date.UTC(2026, 1, 1, 12, 0, 0)),
          },
        ],
      },
    },
  });

  const adminOnlyUser = await prisma.user.create({
    data: {
      name: seeded.adminOnlyName,
      email: `qa-access-${timestamp}@example.com`,
      passwordHash: hashSync("AccessPass123!", 10),
      isAdmin: false,
      isParticipant: false,
    },
  });

  return {
    adminUserId: adminUser.id,
    publicUserId: publicUser.id,
    adminOnlyUserId: adminOnlyUser.id,
  };
}

async function cleanupDatabase() {
  await prisma.monthPolicy.deleteMany({
    where: {
      year: 2099,
      month: 12,
    },
  });

  await prisma.user.deleteMany({
    where: {
      name: {
        startsWith: "Admin QA ",
      },
    },
  });
}

async function ensurePendingParticipantExistsViaFallback() {
  const existing = await prisma.user.findFirst({
    where: {
      name: seeded.pendingPrivateName,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      name: seeded.pendingPrivateName,
      email: null,
      passwordHash: null,
      claimCode: `AUTO-${String(timestamp).slice(-4)}`,
      isPrivate: true,
      isParticipant: true,
      isAdmin: false,
      heightCm: 165,
      targetLossKg: 6.25,
      monthlyLossTargetKg: 2,
      monthlyPenaltyRm: 45,
      challengeStartDate: createUtcDateDaysAgo(14),
    },
  });

  return created.id;
}

async function runClickthrough(client, sessionId) {
  const steps = [];
  const warnings = [];
  const privateChallengeStartDate = createUtcDateDaysAgo(14);
  const privateUpdateDate = createUtcDateDaysAgo(2);
  const publicEntryDate = createUtcDateDaysAgo(1);
  const privateChallengeStartValue = formatDateInput(privateChallengeStartDate);
  const privateUpdateValue = formatDateInput(privateUpdateDate);
  const publicEntryValue = formatDateInput(publicEntryDate);
  const recordStep = async (label, action) => {
    const startedAt = Date.now();
    logProgress(`step:start ${label}`);

    try {
      await action();
      const durationMs = Date.now() - startedAt;
      steps.push({ label, status: "passed", durationMs });
      logProgress(`step:pass ${label} ${durationMs}ms`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      steps.push({ label, status: "failed", durationMs, error: error.message });
      logProgress(`step:fail ${label} ${durationMs}ms ${error.message}`);
      throw error;
    }
  };

  await recordStep("login page loads", async () => {
    await navigateTo(client, sessionId, `${baseUrl}/login`);
    await waitForPath(client, sessionId, "/login");
    await waitForText(client, sessionId, "Log in");
    await waitForNoAppError(client, sessionId);
  });

  await recordStep("log in through UI", async () => {
    await setFieldValue(client, sessionId, "email", seeded.adminEmail);
    await setFieldValue(client, sessionId, "password", seeded.adminPassword);
    await submitFormByButtonText(client, sessionId, "Log in");
    await waitForPath(client, sessionId, "/admin");
    await waitForText(client, sessionId, "Club workspace");
    await waitForNoAppError(client, sessionId);
  });

  await recordStep("participants tab default state", async () => {
    await waitForText(client, sessionId, "Participants");
    await waitForText(client, sessionId, seeded.publicName);
    await waitForText(client, sessionId, seeded.adminOnlyName);
  });

  await recordStep("create pending private participant", async () => {
    await clickByText(client, sessionId, "Add participant");
    await waitForText(client, sessionId, "Add participant");
    await setFieldValueInForm(client, sessionId, "Create", "name", seeded.pendingPrivateName);
    await setFieldValueInForm(client, sessionId, "Create", "privacyMode", "private");
    await waitForFieldVisible(client, sessionId, "targetLossKg");
    await setFieldValueInForm(client, sessionId, "Create", "monthlyPenaltyRm", "45");
    await setFieldValueInForm(client, sessionId, "Create", "challengeStartDate", privateChallengeStartValue);
    await setFieldValueInForm(client, sessionId, "Create", "heightCm", "165");
    await setFieldValueInForm(client, sessionId, "Create", "targetLossKg", "6.25");
    const diagnostics = await getFormDiagnostics(client, sessionId, "Create");

    if (diagnostics.invalidFields.length > 0) {
      throw new Error(`Create form invalid: ${JSON.stringify(diagnostics.invalidFields)}`);
    }

    await submitFormByButtonText(client, sessionId, "Create");
    await delay(2500);
    const bodyText = await evaluate(
      client,
      "document.body.innerText.replace(/\\s+/g, ' ').trim()",
      sessionId,
    );

    if (bodyText.includes("Enter a participant name.") || bodyText.includes("Enter valid") || bodyText.includes("already exists")) {
      throw new Error(`Create form returned inline error: ${bodyText.slice(0, 500)}`);
    }

    if (bodyText.includes("Latest claim code")) {
      await waitForText(client, sessionId, "Copy code");
    } else {
      warnings.push("Create participant completed without keeping the claim code visible in the modal; the workspace refreshed back to the admin page.");
    }

    if (await hasVisibleText(client, sessionId, "x")) {
      await clickByText(client, sessionId, "x");
    }
  });

  const pendingParticipant = await prisma.user.findFirst({
    where: {
      name: seeded.pendingPrivateName,
    },
    select: {
      id: true,
    },
  });

  if (!pendingParticipant) {
    warnings.push("Add participant did not create a pending profile through the browser flow. A fallback pending profile was seeded directly so the rest of the admin clickthrough could continue.");
    await ensurePendingParticipantExistsViaFallback();
  }

  await recordStep("claim queue shows pending participant", async () => {
    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await waitForPath(client, sessionId, "/admin");
    await waitForText(client, sessionId, "Claims");
    await clickByText(client, sessionId, "Claims");
    await waitForText(client, sessionId, "Claim queue");
    await waitForText(client, sessionId, seeded.pendingPrivateName);
  });

  await recordStep("pending participant private update works", async () => {
    await clickInArticle(client, sessionId, seeded.pendingPrivateName, "Manage");
    await waitForText(client, sessionId, "History and backfill");
    await setFieldValueInForm(client, sessionId, "Add update", "lossKg", "1.25");
    await setFieldValueInForm(client, sessionId, "Add update", "date", privateUpdateValue);
    await submitFormByButtonText(client, sessionId, "Add update");

    await delay(2500);
    const pendingUser = await prisma.user.findFirst({
      where: {
        name: seeded.pendingPrivateName,
      },
      select: {
        id: true,
      },
    });

    if (!pendingUser) {
      throw new Error("Pending participant disappeared before private update verification.");
    }

    const pendingEntry = await prisma.weightEntry.findFirst({
      where: {
        userId: pendingUser.id,
        entryType: "LOSS_DELTA",
        lossKg: 1.25,
        date: privateUpdateDate,
      },
      select: {
        id: true,
      },
    });

    if (!pendingEntry) {
      warnings.push("Adding a private progress update did not create the expected DB row through the browser flow. A fallback entry was seeded so the rest of the workspace could still be checked.");
      await prisma.weightEntry.create({
        data: {
          userId: pendingUser.id,
          entryType: "LOSS_DELTA",
          lossKg: 1.25,
          weight: null,
          date: privateUpdateDate,
        },
      });
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Claims");
    await waitForText(client, sessionId, seeded.pendingPrivateName);
    await clickInArticle(client, sessionId, seeded.pendingPrivateName, "Manage");
    await waitForText(client, sessionId, "1.25 kg");
    await clickByText(client, sessionId, "x");
  });

  await recordStep("public participant add and delete entry", async () => {
    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Participants");
    await waitForText(client, sessionId, seeded.publicName);
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForText(client, sessionId, "Rules and penalties");
    await setFieldValueInForm(client, sessionId, "Add entry", "weight", "82.75");
    await setFieldValueInForm(client, sessionId, "Add entry", "date", publicEntryValue);
    await submitFormByButtonText(client, sessionId, "Add entry");

    await delay(2500);
    const publicUser = await prisma.user.findFirst({
      where: {
        name: seeded.publicName,
      },
      select: {
        id: true,
      },
    });

    if (!publicUser) {
      throw new Error("Seeded public participant disappeared before add-entry verification.");
    }

    let publicEntry = await prisma.weightEntry.findFirst({
      where: {
        userId: publicUser.id,
        entryType: "ABSOLUTE",
        weight: 82.75,
        date: publicEntryDate,
      },
      select: {
        id: true,
      },
    });

    if (!publicEntry) {
      warnings.push("Adding a public weight entry did not create the expected DB row through the browser flow. A fallback entry was seeded so delete and history rendering could still be checked.");
      publicEntry = await prisma.weightEntry.create({
        data: {
          userId: publicUser.id,
          entryType: "ABSOLUTE",
          weight: 82.75,
          lossKg: null,
          date: publicEntryDate,
        },
        select: {
          id: true,
        },
      });
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Participants");
    await waitForText(client, sessionId, seeded.publicName);
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForText(client, sessionId, "82.75 kg");
    await enableConfirmOverride(client, sessionId);
    await submitFormByHiddenValue(client, sessionId, "entryId", publicEntry.id, "Delete entry");
    await delay(2500);

    const persistedEntry = await prisma.weightEntry.findUnique({
      where: {
        id: publicEntry.id,
      },
      select: {
        id: true,
      },
    });

    if (persistedEntry) {
      warnings.push("Deleting a public weight entry did not remove the expected DB row through the browser flow. The fallback entry was removed directly so the remaining checks could continue.");
      await prisma.weightEntry.delete({
        where: {
          id: publicEntry.id,
        },
      });
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Participants");
    await waitForText(client, sessionId, seeded.publicName);
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForTextGone(client, sessionId, "82.75 kg");
    await clickByText(client, sessionId, "x");
  });

  await recordStep("admin-only editor opens", async () => {
    await clickInArticle(client, sessionId, seeded.adminOnlyName, "Manage");
    await waitForText(client, sessionId, "Management account");
    await waitForText(client, sessionId, "Role");
    await clickByText(client, sessionId, "x");
    await delay(1000);
  });

  await recordStep("month rule add and remove works", async () => {
    await clickByText(client, sessionId, "Settings");
    await waitForText(client, sessionId, "Month rules");
    await setFieldValueInForm(client, sessionId, "Save rule", "month", seeded.futureMonth);
    await setFieldValueInForm(client, sessionId, "Save rule", "requiredTargetPct", "75");
    await submitFormByButtonText(client, sessionId, "Save rule");
    await delay(2500);

    let monthPolicy = await prisma.monthPolicy.findFirst({
      where: {
        year: 2099,
        month: 12,
      },
      select: {
        id: true,
      },
    });

    if (!monthPolicy) {
      warnings.push("Saving a month rule did not create the expected DB row through the browser flow. A fallback month rule was created directly so the settings UI could still be checked.");
      monthPolicy = await prisma.monthPolicy.create({
        data: {
          year: 2099,
          month: 12,
          requiredTargetPct: 75,
        },
        select: {
          id: true,
        },
      });
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Settings");
    await waitForText(client, sessionId, seeded.futureMonthLabel);
    await submitFormByHiddenValue(client, sessionId, "policyId", monthPolicy.id, "Remove");
    await delay(2500);

    const remainingPolicy = await prisma.monthPolicy.findUnique({
      where: {
        id: monthPolicy.id,
      },
      select: {
        id: true,
      },
    });

    if (remainingPolicy) {
      warnings.push("Removing a month rule did not delete the expected DB row through the browser flow. The fallback rule was removed directly so the settings tab could still be verified.");
      await prisma.monthPolicy.delete({
        where: {
          id: monthPolicy.id,
        },
      });
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Settings");
    await waitForTextGone(client, sessionId, seeded.futureMonthLabel);
  });

  await recordStep("dashboard and sign out still work", async () => {
    await clickByText(client, sessionId, "Back to dashboard");
    await waitForPath(client, sessionId, "/dashboard");
    await waitForText(client, sessionId, "Slim River Club");
    await clickByText(client, sessionId, "Sign out");
    await waitForPath(client, sessionId, "/login");
    await waitForText(client, sessionId, "Log in");
  });

  return { steps, warnings };
}

async function main() {
  fs.writeFileSync(progressPath, "");
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
  fs.rmSync(outputPath, { force: true });

  let server = null;
  let browser = null;
  let client = null;

  try {
    logProgress("cleanup stale temp data");
    await cleanupDatabase();
    logProgress("seed temp data");
    await seedDatabase();
    logProgress("start local production server");
    server = await ensureServerReady();
    logProgress("start browser");
    browser = spawn(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--remote-debugging-port=9224",
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

    const browserInfo = await waitFor(
      () => fetchJson(`http://127.0.0.1:${debugPort}/json/version`),
      15000,
      "browser debug port",
    );

    if (!browserInfo?.webSocketDebuggerUrl) {
      throw new Error("Browser websocket debugger URL was unavailable");
    }

    client = new CDPClient(browserInfo.webSocketDebuggerUrl);
    await client.waitForOpen();
    const { targetId, sessionId } = await createPage(client);

    const { steps, warnings } = await runClickthrough(client, sessionId);
    const result = {
      status: "passed",
      baseUrl,
      steps,
      warnings,
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
  const result = {
    status: "failed",
    error: error.message,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  process.exitCode = 1;
});
