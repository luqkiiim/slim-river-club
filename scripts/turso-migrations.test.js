const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createClient } = require("@libsql/client");
const {
  analyzeMigrationHistory,
  applyMigration,
  checksumText,
  loadLocalMigrations,
  parseArguments,
  shouldRun,
  splitSqlStatements,
  validateSchemaState,
  writeSchemaState,
} = require("./turso-migrations");

function migration(name, sql = `CREATE TABLE "${name}" ("id" TEXT);`) {
  return { name, sql, checksum: checksumText(sql) };
}

function successfulRow(item, overrides = {}) {
  return {
    migration_name: item.name,
    checksum: item.checksum,
    finished_at: Date.now(),
    rolled_back_at: null,
    ...overrides,
  };
}

test("matching migration history passes", () => {
  const local = [migration("001_init"), migration("002_add_policy")];
  const result = analyzeMigrationHistory(
    local,
    local.map((item) => successfulRow(item)),
  );

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(
    result.applied.map((item) => item.name),
    ["001_init", "002_add_policy"],
  );
});

test("missing, drifted, unfinished, rolled-back, and duplicate rows fail", () => {
  const local = [
    migration("001_init"),
    migration("002_drift"),
    migration("003_unfinished"),
    migration("004_rolled_back"),
    migration("005_duplicate"),
    migration("006_pending"),
  ];
  const rows = [
    successfulRow(local[0]),
    successfulRow(local[1], { checksum: "wrong" }),
    successfulRow(local[2], { finished_at: null }),
    successfulRow(local[3], {
      finished_at: null,
      rolled_back_at: Date.now(),
    }),
    successfulRow(local[4]),
    successfulRow(local[4]),
    {
      migration_name: "999_remote_only",
      checksum: "remote",
      finished_at: Date.now(),
      rolled_back_at: null,
    },
  ];
  const result = analyzeMigrationHistory(local, rows);

  assert.match(result.issues.join("\n"), /checksum mismatch: 002_drift/);
  assert.match(result.issues.join("\n"), /unfinished: 003_unfinished/);
  assert.match(
    result.issues.join("\n"),
    /only has rolled-back records: 004_rolled_back/,
  );
  assert.match(
    result.issues.join("\n"),
    /duplicate successful records: 005_duplicate/,
  );
  assert.match(
    result.issues.join("\n"),
    /missing from the repository: 999_remote_only/,
  );
  assert.deepEqual(
    result.pending.map((item) => item.name),
    ["006_pending"],
  );
});

test("a missing migration before an applied migration is a history gap", () => {
  const local = [
    migration("001_init"),
    migration("002_missing"),
    migration("003_applied"),
  ];
  const result = analyzeMigrationHistory(local, [
    successfulRow(local[0]),
    successfulRow(local[2]),
  ]);

  assert.match(result.issues.join("\n"), /history has a gap before: 003_applied/);
});

test("SQL splitting preserves semicolons inside quoted values", () => {
  const statements = splitSqlStatements(`
    -- leading comment
    CREATE TABLE "Example" ("value" TEXT DEFAULT 'a;b');
    INSERT INTO "Example" ("value") VALUES ('it''s;fine');
  `);

  assert.equal(statements.length, 2);
  assert.match(statements[0], /DEFAULT 'a;b'/);
  assert.match(statements[1], /'it''s;fine'/);
});

test("SQL splitting rejects trigger and transaction scripts", () => {
  assert.throws(
    () =>
      splitSqlStatements(
        "CREATE TRIGGER example AFTER INSERT ON x BEGIN UPDATE x SET y = 1; END;",
      ),
    /CREATE TRIGGER/,
  );
  assert.throws(
    () => splitSqlStatements("BEGIN; CREATE TABLE x (id TEXT); COMMIT;"),
    /transaction-control/,
  );
});

test("SQL safety checks ignore trigger and transaction words in values", () => {
  const statements = splitSqlStatements(`
    INSERT INTO "Example" ("value")
    VALUES ('CREATE TRIGGER text; BEGIN is still text');
  `);

  assert.equal(statements.length, 1);
});

test("migration checksums are invariant across line endings and BOMs", () => {
  const lf = "CREATE TABLE x (\n  id TEXT\n);\n";
  const crlf = `\uFEFF${lf.replace(/\n/g, "\r\n")}`;

  assert.equal(checksumText(lf), checksumText(crlf));
});

test("build gate fails closed except for identified preview or development", () => {
  const options = parseArguments(["--check", "--build-gate"]);

  assert.equal(
    shouldRun(options, { VERCEL: "1", VERCEL_ENV: "production" }),
    true,
  );
  assert.equal(
    shouldRun(options, { VERCEL: "1", VERCEL_ENV: "preview" }),
    false,
  );
  assert.equal(shouldRun(options, {}), true);
  assert.equal(
    shouldRun(options, { TURSO_MIGRATION_CHECK_LOCAL_SKIP: "1" }),
    false,
  );
  assert.throws(
    () =>
      shouldRun(options, {
        CI: "1",
        TURSO_MIGRATION_CHECK_LOCAL_SKIP: "1",
      }),
    /cannot disable a CI/,
  );
});

test("apply mode requires an explicit migration name", () => {
  assert.throws(() => parseArguments(["--apply"]), /requires --migration/);
  assert.deepEqual(parseArguments(["--apply", "--migration", "002_next"]), {
    apply: true,
    buildGate: false,
    force: false,
    migrationName: "002_next",
    seal: false,
  });
  assert.equal(parseArguments(["--seal"]).seal, true);
  assert.throws(
    () => parseArguments(["--seal", "--check"]),
    /cannot be combined/,
  );
});

test("migration application updates schema and journal atomically", async () => {
  const client = createClient({ url: ":memory:" });

  try {
    await client.executeMultiple(`
      CREATE TABLE "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
      );
    `);

    const appliedSql = `
      CREATE TABLE IF NOT EXISTS "Applied" ("id" TEXT NOT NULL PRIMARY KEY);
      CREATE INDEX IF NOT EXISTS "Applied_id_idx" ON "Applied"("id");
      INSERT INTO "Applied" ("id") VALUES ('once');
    `;
    const appliedMigration = migration("002_apply", appliedSql);

    await applyMigration(client, appliedMigration);
    await assert.rejects(applyMigration(client, appliedMigration));

    const schema = await client.execute(
      `SELECT name FROM sqlite_master WHERE name IN ('Applied', 'Applied_id_idx') ORDER BY name`,
    );
    const journal = await client.execute(
      `SELECT migration_name, checksum, finished_at, rolled_back_at, typeof(finished_at) AS finished_at_type FROM "_prisma_migrations"`,
    );
    const appliedRows = await client.execute(
      `SELECT COUNT(*) AS count FROM "Applied"`,
    );

    assert.deepEqual(
      schema.rows.map((row) => row.name),
      ["Applied", "Applied_id_idx"],
    );
    assert.equal(journal.rows.length, 1);
    assert.equal(journal.rows[0].migration_name, appliedMigration.name);
    assert.equal(journal.rows[0].checksum, appliedMigration.checksum);
    assert.notEqual(journal.rows[0].finished_at, null);
    assert.equal(journal.rows[0].rolled_back_at, null);
    assert.equal(journal.rows[0].finished_at_type, "integer");
    assert.equal(Number(appliedRows.rows[0].count), 1);

    const failingSql = `
      CREATE TABLE "RolledBack" ("id" TEXT NOT NULL PRIMARY KEY);
      THIS IS NOT VALID SQL;
    `;
    await assert.rejects(
      applyMigration(client, migration("003_fail", failingSql)),
    );

    const rolledBackSchema = await client.execute(
      `SELECT name FROM sqlite_master WHERE name = 'RolledBack'`,
    );
    const rolledBackJournal = await client.execute(
      `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '003_fail'`,
    );
    const rolledBackClaim = await client.execute(
      `SELECT migration_name FROM "_turso_migration_claims" WHERE migration_name = '003_fail'`,
    );

    assert.equal(rolledBackSchema.rows.length, 0);
    assert.equal(rolledBackJournal.rows.length, 0);
    assert.equal(rolledBackClaim.rows.length, 0);
  } finally {
    client.close();
  }
});

test("schema state detects unpaired schema and migration-directory changes", () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "schema-state-test-"),
  );
  const migrationsDir = path.join(temporaryDirectory, "migrations");
  const schemaPath = path.join(temporaryDirectory, "schema.prisma");

  try {
    fs.mkdirSync(path.join(migrationsDir, "001_init"), { recursive: true });
    fs.mkdirSync(path.join(migrationsDir, "002_next"), { recursive: true });
    fs.writeFileSync(
      path.join(migrationsDir, "001_init", "migration.sql"),
      "CREATE TABLE x (id TEXT);\n",
    );
    fs.writeFileSync(
      path.join(migrationsDir, "002_next", "migration.sql"),
      "ALTER TABLE x ADD COLUMN name TEXT;\n",
    );
    fs.writeFileSync(schemaPath, "model X {\n  id String @id\n}\n");
    fs.writeFileSync(
      path.join(migrationsDir, "schema-state.json"),
      JSON.stringify({
        latestMigration: "002_next",
        schemaChecksum: checksumText(fs.readFileSync(schemaPath, "utf8")),
      }),
    );

    const localMigrations = loadLocalMigrations(migrationsDir);
    assert.doesNotThrow(() =>
      validateSchemaState(localMigrations, { migrationsDir, schemaPath }),
    );

    fs.appendFileSync(schemaPath, "// changed without a migration\n");
    assert.throws(
      () =>
        validateSchemaState(localMigrations, { migrationsDir, schemaPath }),
      /changed without updating/,
    );
    assert.throws(
      () => writeSchemaState(localMigrations, { migrationsDir, schemaPath }),
      /no newer migration exists/,
    );

    fs.mkdirSync(path.join(migrationsDir, "003_missing_sql"));
    assert.throws(
      () => loadLocalMigrations(migrationsDir),
      /missing migration\.sql: 003_missing_sql/,
    );

    fs.writeFileSync(
      path.join(migrationsDir, "003_missing_sql", "migration.sql"),
      "ALTER TABLE x ADD COLUMN note TEXT;\n",
    );
    const migrationsWithLatest = loadLocalMigrations(migrationsDir);
    writeSchemaState(migrationsWithLatest, { migrationsDir, schemaPath });
    assert.doesNotThrow(() =>
      validateSchemaState(migrationsWithLatest, { migrationsDir, schemaPath }),
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
