const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { createClient } = require("@libsql/client");

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function normalizeValue(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return value;
}

function chunk(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

function getInsertOrder(localDb, tableNames) {
  const tableNameSet = new Set(tableNames);
  const dependencyMap = new Map();
  const reverseDependencyMap = new Map();

  for (const tableName of tableNames) {
    const foreignKeys = localDb
      .prepare(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`)
      .all();
    const dependencies = new Set(
      foreignKeys
        .map((foreignKey) => foreignKey.table)
        .filter((dependency) => tableNameSet.has(dependency)),
    );

    dependencyMap.set(tableName, dependencies);

    for (const dependency of dependencies) {
      const dependents = reverseDependencyMap.get(dependency) ?? new Set();
      dependents.add(tableName);
      reverseDependencyMap.set(dependency, dependents);
    }
  }

  const ready = tableNames
    .filter((tableName) => dependencyMap.get(tableName).size === 0)
    .sort();
  const ordered = [];

  while (ready.length > 0) {
    const next = ready.shift();
    ordered.push(next);

    for (const dependent of reverseDependencyMap.get(next) ?? []) {
      const remainingDependencies = dependencyMap.get(dependent);
      remainingDependencies.delete(next);

      if (remainingDependencies.size === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  if (ordered.length !== tableNames.length) {
    throw new Error("Could not determine a valid table insert order.");
  }

  return ordered;
}

async function countRemoteRows(client, tableName) {
  const result = await client.execute(
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`,
  );

  return Number(result.rows[0].count);
}

async function main() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.");
  }

  const args = process.argv.slice(2);
  const allowRemoteReset = args.includes("--force-reset");
  const positionalArgs = args.filter((arg) => arg !== "--force-reset");

  if (positionalArgs.length > 1) {
    throw new Error("Usage: node scripts/import-sqlite-to-turso.js [path-to-db] [--force-reset]");
  }

  const sourcePath = path.resolve(positionalArgs[0] ?? "prisma/dev.db");

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite source file not found: ${sourcePath}`);
  }

  const localDb = new DatabaseSync(sourcePath);
  const remoteDb = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const schemaObjects = localDb
      .prepare(
        `
          SELECT type, name, sql
          FROM sqlite_master
          WHERE sql IS NOT NULL
            AND name NOT LIKE 'sqlite_%'
          ORDER BY
            CASE type
              WHEN 'table' THEN 0
              WHEN 'index' THEN 1
              WHEN 'trigger' THEN 2
              ELSE 3
            END,
            name
        `,
      )
      .all();

    const tables = schemaObjects.filter((object) => object.type === "table");
    const secondaryObjects = schemaObjects.filter(
      (object) => object.type !== "table",
    );
    const tableMap = new Map(tables.map((table) => [table.name, table]));
    const insertOrder = getInsertOrder(
      localDb,
      tables.map((table) => table.name),
    );
    const dropOrder = [...insertOrder].reverse();

    const remoteTables = await remoteDb.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    if (remoteTables.rows.length > 0) {
      if (!allowRemoteReset) {
        const names = remoteTables.rows.map((row) => row.name).join(", ");
        throw new Error(`Remote Turso database is not empty: ${names}`);
      }

      for (const tableName of dropOrder) {
        if (!remoteTables.rows.some((row) => row.name === tableName)) {
          continue;
        }

        await remoteDb.batch(
          [`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`],
          "write",
        );
        console.log(`Dropped remote table ${tableName}`);
      }
    }

    await remoteDb.batch(["PRAGMA foreign_keys=OFF"], "write");

    for (const table of tables) {
      await remoteDb.batch([table.sql], "write");
      console.log(`Created table ${table.name}`);
    }

    for (const tableName of insertOrder) {
      const table = tableMap.get(tableName);
      const columns = localDb
        .prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`)
        .all()
        .map((column) => column.name);

      if (columns.length === 0) {
        continue;
      }

      const rows = localDb
        .prepare(`SELECT * FROM ${quoteIdentifier(table.name)}`)
        .all();

      if (rows.length === 0) {
        console.log(`Skipped ${table.name} (0 rows)`);
        continue;
      }

      const insertSql = `INSERT INTO ${quoteIdentifier(table.name)} (${columns
        .map(quoteIdentifier)
        .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;

      for (const group of chunk(rows, 50)) {
        await remoteDb.batch(
          group.map((row) => ({
            sql: insertSql,
            args: columns.map((column) => normalizeValue(row[column])),
          })),
          "write",
        );
      }

      console.log(`Copied ${rows.length} rows into ${table.name}`);
    }

    for (const object of secondaryObjects) {
      await remoteDb.batch([object.sql], "write");
      console.log(`Created ${object.type} ${object.name}`);
    }

    await remoteDb.batch(["PRAGMA foreign_keys=ON"], "write");

    console.log("");
    console.log("Verification:");

    for (const table of tables) {
      const localCount = Number(
        localDb
          .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table.name)}`)
          .get().count,
      );
      const remoteCount = await countRemoteRows(remoteDb, table.name);

      console.log(`${table.name}: local=${localCount} remote=${remoteCount}`);
    }
  } finally {
    localDb.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
