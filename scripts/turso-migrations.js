const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@libsql/client");

const DEFAULT_MIGRATIONS_DIR = path.join(
  process.cwd(),
  "prisma",
  "migrations",
);
const DEFAULT_SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");
const SCHEMA_STATE_FILENAME = "schema-state.json";

function normalizeTextForChecksum(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function checksumText(text) {
  return crypto
    .createHash("sha256")
    .update(normalizeTextForChecksum(text))
    .digest("hex");
}

function loadLocalMigrations(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migrationPath = path.join(
        migrationsDir,
        entry.name,
        "migration.sql",
      );

      if (!fs.existsSync(migrationPath)) {
        throw new Error(
          `Migration directory is missing migration.sql: ${entry.name}`,
        );
      }

      const sql = fs.readFileSync(migrationPath, "utf8");

      return {
        name: entry.name,
        path: migrationPath,
        sql,
        checksum: checksumText(sql),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  if (migrations.length === 0) {
    throw new Error(`No migration.sql files found in ${migrationsDir}.`);
  }

  const duplicateNames = migrations.filter(
    (migration, index) =>
      index > 0 && migration.name === migrations[index - 1].name,
  );

  if (duplicateNames.length > 0) {
    throw new Error(
      `Duplicate local migration names: ${duplicateNames
        .map((migration) => migration.name)
        .join(", ")}`,
    );
  }

  return migrations;
}

function validateSchemaState(
  localMigrations,
  {
    migrationsDir = DEFAULT_MIGRATIONS_DIR,
    schemaPath = DEFAULT_SCHEMA_PATH,
  } = {},
) {
  const statePath = path.join(migrationsDir, SCHEMA_STATE_FILENAME);

  if (!fs.existsSync(statePath)) {
    throw new Error(
      `Missing ${SCHEMA_STATE_FILENAME}; schema changes cannot be verified against migrations.`,
    );
  }

  let state;

  try {
    state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid ${SCHEMA_STATE_FILENAME}: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }

  const latestMigration = localMigrations.at(-1);
  const schema = fs.readFileSync(schemaPath, "utf8");
  const schemaChecksum = checksumText(schema);
  const issues = [];

  if (state.latestMigration !== latestMigration.name) {
    issues.push(
      `${SCHEMA_STATE_FILENAME} names ${state.latestMigration ?? "nothing"} as latest; expected ${latestMigration.name}`,
    );
  }

  if (state.schemaChecksum !== schemaChecksum) {
    issues.push(
      `prisma/schema.prisma changed without updating ${SCHEMA_STATE_FILENAME}`,
    );
  }

  if (issues.length > 0) {
    throw new Error(
      `Prisma schema migration state is inconsistent:\n${issues
        .map((issue) => `- ${issue}`)
        .join("\n")}\nCreate the migration first, then update ${statePath}.`,
    );
  }

  return state;
}

function writeSchemaState(
  localMigrations,
  {
    migrationsDir = DEFAULT_MIGRATIONS_DIR,
    schemaPath = DEFAULT_SCHEMA_PATH,
  } = {},
) {
  const statePath = path.join(migrationsDir, SCHEMA_STATE_FILENAME);
  const latestMigration = localMigrations.at(-1);
  const nextState = {
    latestMigration: latestMigration.name,
    schemaChecksum: checksumText(fs.readFileSync(schemaPath, "utf8")),
  };

  if (fs.existsSync(statePath)) {
    let currentState;

    try {
      currentState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch (error) {
      throw new Error(
        `Invalid ${SCHEMA_STATE_FILENAME}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    if (
      currentState.latestMigration === nextState.latestMigration &&
      currentState.schemaChecksum !== nextState.schemaChecksum
    ) {
      throw new Error(
        "prisma/schema.prisma changed but no newer migration exists. Create the migration before sealing schema state.",
      );
    }
  }

  fs.writeFileSync(
    statePath,
    `${JSON.stringify(nextState, null, 2)}\n`,
    "utf8",
  );

  return { path: statePath, state: nextState };
}

function isFinished(row) {
  return row.finished_at !== null && row.finished_at !== undefined;
}

function isRolledBack(row) {
  return row.rolled_back_at !== null && row.rolled_back_at !== undefined;
}

function analyzeMigrationHistory(localMigrations, historyRows) {
  const localByName = new Map(
    localMigrations.map((migration) => [migration.name, migration]),
  );
  const historyByName = new Map();
  const issues = [];

  for (const row of historyRows) {
    const rows = historyByName.get(row.migration_name) ?? [];
    rows.push(row);
    historyByName.set(row.migration_name, rows);

    if (!localByName.has(row.migration_name)) {
      issues.push(
        `Remote migration is missing from the repository: ${row.migration_name}`,
      );
    }
  }

  const pending = [];
  const applied = [];

  for (const migration of localMigrations) {
    const rows = historyByName.get(migration.name) ?? [];
    const unresolved = rows.filter(
      (row) => !isFinished(row) && !isRolledBack(row),
    );
    const successful = rows.filter(
      (row) => isFinished(row) && !isRolledBack(row),
    );

    if (unresolved.length > 0) {
      issues.push(`Migration is unfinished: ${migration.name}`);
      continue;
    }

    if (successful.length > 1) {
      issues.push(
        `Migration has duplicate successful records: ${migration.name}`,
      );
      continue;
    }

    if (successful.length === 0) {
      if (rows.some(isRolledBack)) {
        issues.push(
          `Migration only has rolled-back records: ${migration.name}`,
        );
      } else {
        pending.push(migration);
      }
      continue;
    }

    if (successful[0].checksum !== migration.checksum) {
      issues.push(`Migration checksum mismatch: ${migration.name}`);
      continue;
    }

    applied.push(migration);
  }

  if (pending.length > 0) {
    const firstPendingIndex = localMigrations.findIndex(
      (migration) => migration.name === pending[0].name,
    );
    const appliedAfterGap = localMigrations
      .slice(firstPendingIndex + 1)
      .filter((migration) =>
        applied.some((item) => item.name === migration.name),
      );

    if (appliedAfterGap.length > 0) {
      issues.push(
        `Migration history has a gap before: ${appliedAfterGap
          .map((migration) => migration.name)
          .join(", ")}`,
      );
    }
  }

  return { applied, pending, issues };
}

function maskSqlLiteralsAndComments(sql) {
  let masked = "";
  let state = "normal";

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (state === "line-comment") {
      if (character === "\n") {
        masked += "\n";
        state = "normal";
      } else {
        masked += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        masked += "  ";
        index += 1;
        state = "normal";
      } else {
        masked += character === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (
      state === "single-quote" ||
      state === "double-quote" ||
      state === "backtick"
    ) {
      const delimiter =
        state === "single-quote" ? "'" : state === "double-quote" ? '"' : "`";

      if (character === delimiter && next === delimiter) {
        masked += "  ";
        index += 1;
      } else if (character === delimiter) {
        masked += " ";
        state = "normal";
      } else {
        masked += character === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "bracket") {
      masked += character === "\n" ? "\n" : " ";

      if (character === "]") {
        state = "normal";
      }
      continue;
    }

    if (character === "-" && next === "-") {
      masked += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && next === "*") {
      masked += "  ";
      index += 1;
      state = "block-comment";
    } else if (character === "'") {
      masked += " ";
      state = "single-quote";
    } else if (character === '"') {
      masked += " ";
      state = "double-quote";
    } else if (character === "`") {
      masked += " ";
      state = "backtick";
    } else if (character === "[") {
      masked += " ";
      state = "bracket";
    } else {
      masked += character;
    }
  }

  return masked;
}

function hasExecutableSql(sql) {
  return maskSqlLiteralsAndComments(sql).trim().length > 0;
}

function splitSqlStatements(sql) {
  const executableSql = maskSqlLiteralsAndComments(sql);

  if (/\bCREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i.test(executableSql)) {
    throw new Error(
      "CREATE TRIGGER migrations must be applied with the Turso CLI because trigger bodies contain internal semicolons.",
    );
  }

  if (
    /(?:^|;)\s*(?:BEGIN(?:\s+TRANSACTION)?|COMMIT|ROLLBACK|END(?:\s+TRANSACTION)?)\b/im.test(
      executableSql,
    )
  ) {
    throw new Error(
      "Migration files must not contain transaction-control statements.",
    );
  }

  const statements = [];
  let current = "";
  let state = "normal";

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    current += character;

    if (state === "line-comment") {
      if (character === "\n") {
        state = "normal";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        current += next;
        index += 1;
        state = "normal";
      }
      continue;
    }

    if (state === "single-quote") {
      if (character === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (character === "'") {
        state = "normal";
      }
      continue;
    }

    if (state === "double-quote") {
      if (character === '"' && next === '"') {
        current += next;
        index += 1;
      } else if (character === '"') {
        state = "normal";
      }
      continue;
    }

    if (state === "backtick") {
      if (character === "`" && next === "`") {
        current += next;
        index += 1;
      } else if (character === "`") {
        state = "normal";
      }
      continue;
    }

    if (state === "bracket") {
      if (character === "]") {
        state = "normal";
      }
      continue;
    }

    if (character === "-" && next === "-") {
      current += next;
      index += 1;
      state = "line-comment";
    } else if (character === "/" && next === "*") {
      current += next;
      index += 1;
      state = "block-comment";
    } else if (character === "'") {
      state = "single-quote";
    } else if (character === '"') {
      state = "double-quote";
    } else if (character === "`") {
      state = "backtick";
    } else if (character === "[") {
      state = "bracket";
    } else if (character === ";") {
      const statement = current.slice(0, -1).trim();

      if (hasExecutableSql(statement)) {
        statements.push(statement);
      }

      current = "";
    }
  }

  if (
    state !== "normal" &&
    state !== "line-comment" &&
    state !== "block-comment"
  ) {
    throw new Error("Migration SQL contains an unterminated quoted value.");
  }

  if (state === "block-comment") {
    throw new Error("Migration SQL contains an unterminated block comment.");
  }

  if (hasExecutableSql(current)) {
    statements.push(current.trim());
  }

  return statements;
}

async function readMigrationHistory(client) {
  try {
    const result = await client.execute(`
      SELECT
        "migration_name",
        "checksum",
        "finished_at",
        "rolled_back_at"
      FROM "_prisma_migrations"
      ORDER BY "started_at", "migration_name"
    `);

    return result.rows;
  } catch (error) {
    if (
      error instanceof Error &&
      /no such table:\s*(?:main\.)?_prisma_migrations/i.test(error.message)
    ) {
      throw new Error(
        "The Turso database has no _prisma_migrations journal. Bootstrap it before deploying.",
      );
    }

    throw error;
  }
}

function formatIssues(issues) {
  return issues.map((issue) => `- ${issue}`).join("\n");
}

function getDatabaseFingerprint(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
}

async function verifyMigrations(client, localMigrations) {
  const historyRows = await readMigrationHistory(client);
  const analysis = analyzeMigrationHistory(localMigrations, historyRows);

  if (analysis.issues.length > 0) {
    throw new Error(
      `Turso migration history is inconsistent:\n${formatIssues(
        analysis.issues,
      )}`,
    );
  }

  return analysis;
}

async function applyMigration(client, migration) {
  const statements = splitSqlStatements(migration.sql);

  if (statements.length === 0) {
    throw new Error(`Migration is empty: ${migration.name}`);
  }

  const appliedAt = Date.now();

  await client.migrate([
    `
      CREATE TABLE IF NOT EXISTS "_turso_migration_claims" (
        "migration_name" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "claimed_at" DATETIME NOT NULL
      )
    `,
    {
      sql: `
        INSERT INTO "_turso_migration_claims" (
          "migration_name",
          "checksum",
          "claimed_at"
        )
        VALUES (?, ?, ?)
      `,
      args: [migration.name, migration.checksum, appliedAt],
    },
    ...statements,
    {
      sql: `
        INSERT INTO "_prisma_migrations" (
          "id",
          "checksum",
          "finished_at",
          "migration_name",
          "logs",
          "rolled_back_at",
          "started_at",
          "applied_steps_count"
        )
        VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
      `,
      args: [
        crypto.randomUUID(),
        migration.checksum,
        appliedAt,
        migration.name,
        appliedAt,
      ],
    },
  ]);
}

function parseArguments(argv) {
  const args = new Set(argv);
  const migrationFlagIndex = argv.indexOf("--migration");
  const migrationName =
    migrationFlagIndex >= 0 ? argv[migrationFlagIndex + 1] : undefined;

  if (args.has("--check") && args.has("--apply")) {
    throw new Error("Choose either --check or --apply.");
  }

  if (
    args.has("--seal") &&
    (args.has("--check") || args.has("--apply") || args.has("--migration"))
  ) {
    throw new Error("--seal cannot be combined with check or apply options.");
  }

  if (
    args.has("--apply") &&
    (!migrationName || migrationName.startsWith("--"))
  ) {
    throw new Error("--apply requires --migration <migration-name>.");
  }

  return {
    apply: args.has("--apply"),
    buildGate: args.has("--build-gate"),
    force: args.has("--force"),
    migrationName,
    seal: args.has("--seal"),
  };
}

function shouldRun({ buildGate, force }, environment = process.env) {
  const vercelEnvironment =
    environment.VERCEL_ENV ?? environment.VERCEL_TARGET_ENV;

  if (force) {
    return true;
  }

  if (buildGate) {
    if (
      vercelEnvironment === "preview" ||
      vercelEnvironment === "development"
    ) {
      return false;
    }

    if (environment.TURSO_MIGRATION_CHECK_LOCAL_SKIP === "1") {
      if (environment.CI || environment.VERCEL === "1") {
        throw new Error(
          "TURSO_MIGRATION_CHECK_LOCAL_SKIP cannot disable a CI or Vercel migration check.",
        );
      }

      return false;
    }

    return true;
  }

  return true;
}

async function main({
  argv = process.argv.slice(2),
  environment = process.env,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  schemaPath = DEFAULT_SCHEMA_PATH,
} = {}) {
  const options = parseArguments(argv);

  if (options.seal) {
    const localMigrations = loadLocalMigrations(migrationsDir);
    const result = writeSchemaState(localMigrations, {
      migrationsDir,
      schemaPath,
    });
    console.log(
      `Sealed Prisma schema state at ${result.path} for ${result.state.latestMigration}.`,
    );
    return;
  }

  if (!shouldRun(options, environment)) {
    console.log(
      `Turso migration check skipped for ${
        environment.VERCEL_ENV ??
        environment.VERCEL_TARGET_ENV ??
        "local"
      } environment.`,
    );
    return;
  }

  const url = environment.TURSO_DATABASE_URL;
  const authToken = environment.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for migration checks.",
    );
  }

  const localMigrations = loadLocalMigrations(migrationsDir);
  validateSchemaState(localMigrations, { migrationsDir, schemaPath });
  const client = createClient({ url, authToken });
  const fingerprint = getDatabaseFingerprint(url);

  try {
    const analysis = await verifyMigrations(client, localMigrations);

    if (!options.apply) {
      if (analysis.pending.length > 0) {
        throw new Error(
          `Pending Turso migrations:\n${formatIssues(
            analysis.pending.map((migration) => migration.name),
          )}\nApply them before deploying with npm run db:migrations:apply -- --migration <migration-name>.`,
        );
      }

      console.log(
        `Turso migration check passed (${analysis.applied.length} migrations, database ${fingerprint}).`,
      );
      return;
    }

    const migration = analysis.pending[0];

    if (!migration) {
      throw new Error("No pending Turso migrations.");
    }

    if (migration.name !== options.migrationName) {
      throw new Error(
        `The next pending migration is ${migration.name}; refusing to apply ${options.migrationName}.`,
      );
    }

    try {
      await applyMigration(client, migration);
    } catch (error) {
      const refreshed = await verifyMigrations(client, localMigrations);
      const concurrentlyApplied = refreshed.applied.some(
        (item) => item.name === migration.name,
      );

      if (!concurrentlyApplied) {
        throw error;
      }
    }

    const verified = await verifyMigrations(client, localMigrations);

    if (
      !verified.applied.some((item) => item.name === migration.name) ||
      verified.pending.some((item) => item.name === migration.name)
    ) {
      throw new Error(
        `Migration did not verify after application: ${migration.name}`,
      );
    }

    console.log(
      `Applied and verified ${migration.name} on Turso database ${fingerprint}.`,
    );
  } finally {
    client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeMigrationHistory,
  applyMigration,
  checksumText,
  loadLocalMigrations,
  main,
  normalizeTextForChecksum,
  parseArguments,
  shouldRun,
  splitSqlStatements,
  validateSchemaState,
  writeSchemaState,
};
