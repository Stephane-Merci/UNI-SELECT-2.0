'use strict';
/**
 * Runs `prisma migrate deploy`. If Prisma reports P3009 (failed migration in DB),
 * resolves that migration as rolled back once and retries deploy.
 * Intended for Render / CI after a migration failed mid-pipeline and was fixed in git.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function migrateDeploy() {
  return spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
  });
}

function migrateResolveRolledBack(name) {
  return spawnSync('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', name], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
}

function run() {
  const first = migrateDeploy();
  const out = `${first.stdout || ''}${first.stderr || ''}`;
  process.stdout.write(out);
  if (first.status === 0) return 0;

  if (out.includes('P3009')) {
    const m = out.match(/The `([^`]+)` migration/);
    if (m) {
      const migrationName = m[1];
      console.error(
        `\n[prisma-migrate-deploy] P3009: clearing failed record for "${migrationName}" then retrying migrate deploy once.\n`
      );
      const resolved = migrateResolveRolledBack(migrationName);
      if (resolved.status !== 0) return resolved.status || 1;
      const second = migrateDeploy();
      process.stdout.write(`${second.stdout || ''}${second.stderr || ''}`);
      return second.status === 0 ? 0 : second.status || 1;
    }
  }

  return first.status === 0 ? 0 : first.status || 1;
}

process.exit(run());
