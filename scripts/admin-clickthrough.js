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
const mobileViewport = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
};

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
    mobileViewport,
    sessionId,
  );
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
        `document.body.innerText.replace(/\\s+/g, " ").toLocaleLowerCase().includes(${JSON.stringify(text.toLocaleLowerCase())})`,
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
        `document.body.innerText.replace(/\\s+/g, " ").toLocaleLowerCase().includes(${JSON.stringify(text.toLocaleLowerCase())})`,
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

async function submitFormWithOverrides(client, sessionId, submitText, overrides) {
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
        throw new Error('Form not found for overridden submit: ' + ${JSON.stringify(submitText)});
      }

      const submitter = Array.from(form.querySelectorAll('button, input[type="submit"]')).find(
        (candidate) => isVisible(candidate) && normalize(candidate.innerText || candidate.textContent || candidate.value || '') === ${JSON.stringify(submitText)},
      );

      if (!submitter) {
        throw new Error('Submitter not found for overridden submit: ' + ${JSON.stringify(submitText)});
      }

      for (const [name, value] of Object.entries(${JSON.stringify(overrides)})) {
        const field = Array.from(form.querySelectorAll('[name]')).find(
          (candidate) => candidate.getAttribute('name') === name,
        );

        if (!field) {
          throw new Error('Field not found for overridden submit: ' + name);
        }

        field.setAttribute('name', name + '__browser_value');

        const override = document.createElement('input');
        override.type = 'hidden';
        override.name = name;
        override.value = String(value);
        form.appendChild(override);
      }

      form.requestSubmit(submitter);
      return true;
    })()`,
    sessionId,
  );
}

async function clickByText(client, sessionId, text) {
  return waitFor(
    () =>
      evaluate(
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
      ),
    15000,
    `clickable text ${text}`,
  );
}

async function clickByAccessibleName(client, sessionId, role, name) {
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

async function waitForNoVisibleDialog(client, sessionId, timeoutMs = 10000) {
  return waitFor(
    async () => {
      const hasDialog = await evaluate(
        client,
        `Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).some(
          (dialog) => dialog instanceof HTMLElement && dialog.offsetParent !== null,
        )`,
        sessionId,
      );

      if (!hasDialog) return true;
      throw new Error("A modal dialog is still visible");
    },
    timeoutMs,
    "dialog closed",
  );
}

async function closeOpenDialog(client, sessionId) {
  await evaluate(
    client,
    `(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).find(
        (node) => node instanceof HTMLElement && node.offsetParent !== null,
      );
      const closeButton = dialog
        ? Array.from(dialog.querySelectorAll('button')).find((button) =>
            button instanceof HTMLElement &&
            button.offsetParent !== null &&
            String(button.getAttribute('aria-label') || '').startsWith('Close'),
          )
        : null;

      if (!closeButton) throw new Error('Visible dialog close button not found');
      closeButton.click();
      return true;
    })()`,
    sessionId,
  );
  await waitForNoVisibleDialog(client, sessionId);
}

async function inspectParticipantEditor(client, sessionId) {
  return evaluate(
    client,
    `(() => {
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const dialog = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).find(
        (node) => node instanceof HTMLElement && node.offsetParent !== null,
      );
      const tablist = dialog
        ? Array.from(dialog.querySelectorAll('[role="tablist"]')).find((node) =>
            String(node.getAttribute('aria-label') || '').endsWith('editor sections'),
          )
        : null;
      const tabs = tablist ? Array.from(tablist.querySelectorAll('[role="tab"]')) : [];
      const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
      const closeButton = dialog
        ? Array.from(dialog.querySelectorAll('button')).find(
            (button) => button.getAttribute('aria-label') === 'Close participant editor',
          )
        : null;

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        hasDialog: Boolean(dialog),
        closeName: closeButton?.getAttribute('aria-label') || null,
        tabNames: tabs.map((tab) => normalize(tab.textContent)),
        selectedTab: selected ? normalize(selected.textContent) : null,
      };
    })()`,
    sessionId,
  );
}

async function waitForParticipantEditor(client, sessionId) {
  return waitFor(
    async () => {
      const state = await inspectParticipantEditor(client, sessionId);
      const isExpected =
        state.viewportWidth === mobileViewport.width &&
        state.viewportHeight === mobileViewport.height &&
        !state.hasHorizontalOverflow &&
        state.hasDialog &&
        state.closeName === "Close participant editor" &&
        JSON.stringify(state.tabNames) === JSON.stringify(["Overview", "Targets", "History"]) &&
        state.selectedTab === "Overview";

      if (isExpected) return state;
      throw new Error(`Participant editor state ${JSON.stringify(state)}`);
    },
    10000,
    "mobile participant editor",
  );
}

async function selectParticipantEditorTab(client, sessionId, name) {
  await clickByAccessibleName(client, sessionId, "tab", name);

  return waitFor(
    async () => {
      const state = await inspectParticipantEditor(client, sessionId);
      if (state.selectedTab === name) return state;
      throw new Error(`Participant editor selected tab ${JSON.stringify(state)}`);
    },
    10000,
    `participant editor ${name} tab`,
  );
}

async function closeParticipantEditor(client, sessionId) {
  await clickByAccessibleName(client, sessionId, "button", "Close participant editor");
  await waitForNoVisibleDialog(client, sessionId);
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
    await waitForPath(client, sessionId, "/dashboard");
    await waitForText(client, sessionId, "Group momentum");
    await waitForText(client, sessionId, "Admin");
    await clickByText(client, sessionId, "Admin");
    await waitForPath(client, sessionId, "/admin");
    await waitForText(client, sessionId, "Club workspace");
    await waitForNoAppError(client, sessionId);
  });

  await recordStep("participants tab default state", async () => {
    const mobileState = await evaluate(
      client,
      `({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      })`,
      sessionId,
    );

    if (
      mobileState.viewportWidth !== mobileViewport.width ||
      mobileState.viewportHeight !== mobileViewport.height ||
      mobileState.hasHorizontalOverflow
    ) {
      throw new Error(`Admin mobile layout failed: ${JSON.stringify(mobileState)}`);
    }

    await waitForText(client, sessionId, "Participants");
    await waitForText(client, sessionId, seeded.publicName);
    await waitForText(client, sessionId, seeded.adminOnlyName);
  });

  await recordStep("personal month rule server validation rejects unsafe values", async () => {
    const validationUser = await prisma.user.findFirst({
      where: {
        name: seeded.publicName,
      },
      select: {
        id: true,
      },
    });

    if (!validationUser) {
      throw new Error("Seeded public participant is missing before month-rule validation.");
    }

    const validationPolicy = await prisma.userMonthPolicy.create({
      data: {
        userId: validationUser.id,
        month: 10,
        year: 2097,
        requiredTargetPct: 75,
      },
      select: {
        id: true,
      },
    });

    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, "Personal month targets");
    await submitFormWithOverrides(client, sessionId, "Save personal rule", {
      month: "2097-10",
      requiredTargetPct: "99.5",
    });
    await delay(1000);
    await waitForNoAppError(client, sessionId);

    const policyAfterFractionalPct = await prisma.userMonthPolicy.findUnique({
      where: {
        id: validationPolicy.id,
      },
      select: {
        requiredTargetPct: true,
      },
    });

    if (policyAfterFractionalPct?.requiredTargetPct !== 75) {
      throw new Error(
        `Fractional target percentage changed the stored policy: ${JSON.stringify(policyAfterFractionalPct)}`,
      );
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, "Personal month targets");
    await submitFormWithOverrides(client, sessionId, "Save personal rule", {
      month: "2026-00",
      requiredTargetPct: "75",
    });
    await delay(1000);
    await waitForNoAppError(client, sessionId);

    const policyAfterMalformedMonth = await prisma.userMonthPolicy.findUnique({
      where: {
        id: validationPolicy.id,
      },
      select: {
        requiredTargetPct: true,
      },
    });

    if (policyAfterMalformedMonth?.requiredTargetPct !== 75) {
      throw new Error(
        `Malformed month changed the stored policy: ${JSON.stringify(policyAfterMalformedMonth)}`,
      );
    }

    await prisma.userMonthPolicy.delete({
      where: {
        id: validationPolicy.id,
      },
    });
    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
  });

  await recordStep("create pending private participant", async () => {
    await clickByText(client, sessionId, "Add participant");
    await waitForText(client, sessionId, "Add participant");
    await setFieldValueInForm(client, sessionId, "Create participant", "name", seeded.pendingPrivateName);
    await setFieldValueInForm(client, sessionId, "Create participant", "privacyMode", "private");
    await waitForFieldVisible(client, sessionId, "targetLossKg");
    await setFieldValueInForm(client, sessionId, "Create participant", "monthlyPenaltyRm", "45");
    await setFieldValueInForm(client, sessionId, "Create participant", "challengeStartDate", privateChallengeStartValue);
    await setFieldValueInForm(client, sessionId, "Create participant", "heightCm", "165");
    await setFieldValueInForm(client, sessionId, "Create participant", "targetLossKg", "6.25");
    const diagnostics = await getFormDiagnostics(client, sessionId, "Create participant");

    if (diagnostics.invalidFields.length > 0) {
      throw new Error(`Create form invalid: ${JSON.stringify(diagnostics.invalidFields)}`);
    }

    await submitFormByButtonText(client, sessionId, "Create participant");
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
      await clickByText(client, sessionId, "Back to workspace");
      await waitForNoVisibleDialog(client, sessionId);
    } else {
      warnings.push("Create participant completed without keeping the claim code visible in the modal; the workspace refreshed back to the admin page.");
      await closeOpenDialog(client, sessionId);
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
    throw new Error("Add participant did not create the expected pending profile through the browser flow.");
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
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "History");
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
      throw new Error("Adding a private progress update did not create the expected database row.");
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await waitForText(client, sessionId, "Claims");
    await clickByText(client, sessionId, "Claims");
    await waitForText(client, sessionId, seeded.pendingPrivateName);
    await clickInArticle(client, sessionId, seeded.pendingPrivateName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "History");
    await waitForText(client, sessionId, "1.25 kg");
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await setFieldValueInForm(client, sessionId, "Save personal rule", "month", "2098-11");
    await setFieldValueInForm(client, sessionId, "Save personal rule", "requiredTargetPct", "60");
    await submitFormByButtonText(client, sessionId, "Save personal rule");

    const privatePolicy = await waitFor(
      async () => {
        const policy = await prisma.userMonthPolicy.findUnique({
          where: {
            userId_month_year: {
              userId: pendingUser.id,
              month: 11,
              year: 2098,
            },
          },
          select: {
            id: true,
            requiredTargetPct: true,
          },
        });

        if (policy?.requiredTargetPct === 60) {
          return policy;
        }

        throw new Error(`Unexpected private participant policy: ${JSON.stringify(policy)}`);
      },
      15000,
      "private participant month rule persistence",
    );

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await waitForText(client, sessionId, "Claims");
    await clickByText(client, sessionId, "Claims");
    await clickInArticle(client, sessionId, seeded.pendingPrivateName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, "November 2098");
    await waitForText(client, sessionId, "Personal 60% · 1.2 kg required");
    await submitFormByHiddenValue(client, sessionId, "policyId", privatePolicy.id, "Remove");

    await waitFor(
      async () => {
        const policy = await prisma.userMonthPolicy.findUnique({
          where: {
            id: privatePolicy.id,
          },
          select: {
            id: true,
          },
        });

        if (!policy) {
          return true;
        }

        throw new Error("Private participant month rule still exists");
      },
      15000,
      "private participant month rule removal",
    );

    await closeParticipantEditor(client, sessionId);
  });

  await recordStep("public participant add and delete entry", async () => {
    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await waitForText(client, sessionId, seeded.publicName);
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "History");
    await waitForText(client, sessionId, "History and backfill");
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

    const publicEntry = await prisma.weightEntry.findFirst({
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
      throw new Error("Adding a public weight entry did not create the expected database row.");
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await waitForText(client, sessionId, seeded.publicName);
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "History");
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
      throw new Error("Deleting a public weight entry did not remove the expected database row.");
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await waitForText(client, sessionId, seeded.publicName);
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "History");
    await waitForTextGone(client, sessionId, "82.75 kg");
    await closeParticipantEditor(client, sessionId);
  });

  await recordStep("closed personal month target recalculates the participant only", async () => {
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, "Personal month targets");
    await setFieldValueInForm(client, sessionId, "Save personal rule", "month", "2026-02");
    await setFieldValueInForm(client, sessionId, "Save personal rule", "requiredTargetPct", "75");
    await waitForText(client, sessionId, "75% requires 1.5 kg instead of 2 kg in February 2026.");
    await submitFormByButtonText(client, sessionId, "Save personal rule");

    const discounted = await waitFor(
      async () => {
        const user = await prisma.user.findFirst({
          where: {
            name: seeded.publicName,
          },
          select: {
            id: true,
            monthlyPenaltyRm: true,
          },
        });

        if (!user) {
          throw new Error("Seeded public participant is missing");
        }

        const [policy, result] = await Promise.all([
          prisma.userMonthPolicy.findUnique({
            where: {
              userId_month_year: {
                userId: user.id,
                month: 2,
                year: 2026,
              },
            },
            select: {
              id: true,
              requiredTargetPct: true,
            },
          }),
          prisma.monthlyResult.findUnique({
            where: {
              userId_month_year: {
                userId: user.id,
                month: 2,
                year: 2026,
              },
            },
            select: {
              requiredLossKg: true,
              targetRatioPct: true,
              penaltyApplied: true,
              penaltyAmountRm: true,
            },
          }),
        ]);

        const isExpected =
          policy?.requiredTargetPct === 75
          && result?.targetRatioPct === 75
          && Math.abs(result.requiredLossKg - 1.5) < 0.001
          && result.penaltyApplied === false
          && result.penaltyAmountRm === 0
          && user.monthlyPenaltyRm === 30;

        if (isExpected) {
          return { policy, userId: user.id };
        }

        throw new Error(`Unexpected discounted result: ${JSON.stringify({ policy, result, user })}`);
      },
      15000,
      "closed personal month target recalculation",
    );

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, "February 2026");
    await submitFormByHiddenValue(client, sessionId, "policyId", discounted.policy.id, "Remove");

    await waitFor(
      async () => {
        const [policy, result] = await Promise.all([
          prisma.userMonthPolicy.findUnique({
            where: {
              id: discounted.policy.id,
            },
            select: {
              id: true,
            },
          }),
          prisma.monthlyResult.findUnique({
            where: {
              userId_month_year: {
                userId: discounted.userId,
                month: 2,
                year: 2026,
              },
            },
            select: {
              requiredLossKg: true,
              targetRatioPct: true,
              penaltyApplied: true,
              penaltyAmountRm: true,
            },
          }),
        ]);

        const isExpected =
          !policy
          && result?.targetRatioPct === 100
          && Math.abs(result.requiredLossKg - 2) < 0.001
          && result.penaltyApplied === true
          && result.penaltyAmountRm === 30;

        if (isExpected) {
          return true;
        }

        throw new Error(`Unexpected restored result: ${JSON.stringify({ policy, result })}`);
      },
      15000,
      "closed personal month target fallback",
    );

    await closeParticipantEditor(client, sessionId);
  });

  await recordStep("admin-only editor opens", async () => {
    await clickInArticle(client, sessionId, seeded.adminOnlyName, "Manage");
    await waitForText(client, sessionId, "Admin-only");
    await waitForText(client, sessionId, "Role");
    await closeOpenDialog(client, sessionId);
    await delay(1000);
  });

  await recordStep("group and personal month rules add and remove work", async () => {
    await clickByText(client, sessionId, "Rules");
    await waitForText(client, sessionId, "Month rules");
    await setFieldValueInForm(client, sessionId, "Save rule", "month", seeded.futureMonth);
    await setFieldValueInForm(client, sessionId, "Save rule", "requiredTargetPct", "50");
    await submitFormByButtonText(client, sessionId, "Save rule");
    await delay(2500);

    const monthPolicy = await prisma.monthPolicy.findFirst({
      where: {
        year: 2099,
        month: 12,
      },
      select: {
        id: true,
      },
    });

    if (!monthPolicy) {
      throw new Error("Saving a month rule did not create the expected database row.");
    }

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, "Personal month targets");
    await setFieldValueInForm(client, sessionId, "Save personal rule", "month", seeded.futureMonth);
    await setFieldValueInForm(client, sessionId, "Save personal rule", "requiredTargetPct", "75");
    await waitForText(client, sessionId, "This replaces the 50% group rule.");
    await submitFormByButtonText(client, sessionId, "Save personal rule");

    const personalPolicy = await waitFor(
      async () => {
        const policy = await prisma.userMonthPolicy.findFirst({
          where: {
            user: {
              name: seeded.publicName,
            },
            year: 2099,
            month: 12,
          },
          select: {
            id: true,
            requiredTargetPct: true,
          },
        });

        if (policy?.requiredTargetPct === 75) {
          return policy;
        }

        throw new Error(`Unexpected personal policy: ${JSON.stringify(policy)}`);
      },
      15000,
      "personal month rule persistence",
    );

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForText(client, sessionId, seeded.futureMonthLabel);
    await waitForText(client, sessionId, "Personal 75% · 1.5 kg required");
    await waitForText(client, sessionId, "Overrides the 50% group rule");
    await setFieldValueInForm(client, sessionId, "Save personal rule", "month", seeded.futureMonth);
    await setFieldValueInForm(client, sessionId, "Save personal rule", "requiredTargetPct", "100");
    await waitForText(client, sessionId, "The 50% fallback will require 1 kg");
    await submitFormByButtonText(client, sessionId, "Save personal rule");

    await waitFor(
      async () => {
        const policy = await prisma.userMonthPolicy.findUnique({
          where: {
            id: personalPolicy.id,
          },
          select: {
            id: true,
          },
        });

        if (!policy) {
          return true;
        }

        throw new Error("Personal month rule still exists after saving 100%");
      },
      15000,
      "personal month rule 100% fallback",
    );

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "People");
    await clickInArticle(client, sessionId, seeded.publicName, "Manage");
    await waitForParticipantEditor(client, sessionId);
    await selectParticipantEditorTab(client, sessionId, "Targets");
    await waitForTextGone(client, sessionId, seeded.futureMonthLabel);
    await closeParticipantEditor(client, sessionId);

    await navigateTo(client, sessionId, `${baseUrl}/admin`);
    await clickByText(client, sessionId, "Rules");
    await waitForText(client, sessionId, seeded.futureMonthLabel);
    await submitFormByHiddenValue(client, sessionId, "policyId", monthPolicy.id, "Remove");
    await waitForTextGone(client, sessionId, seeded.futureMonthLabel, 60000);

    const remainingPolicy = await prisma.monthPolicy.findUnique({
      where: {
        id: monthPolicy.id,
      },
      select: {
        id: true,
      },
    });

    if (remainingPolicy) {
      throw new Error("Removing a month rule did not delete the expected database row.");
    }

  });

  await recordStep("dashboard and sign out still work", async () => {
    await clickByText(client, sessionId, "Dashboard");
    await waitForPath(client, sessionId, "/dashboard");
    await waitForNoAppError(client, sessionId);
    await waitForText(client, sessionId, "Group momentum");
    await clickByText(client, sessionId, "More");
    await waitForText(client, sessionId, "Account");
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
