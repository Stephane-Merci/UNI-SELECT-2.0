'use strict';
/**
 * Runs prisma-migrate-deploy (P3009 auto-retry) only on hosts that run migrations in the build phase.
 * Render sets RENDER=true during build; local `npm run build` skips this unless MIGRATE_ON_BUILD=1.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const render = process.env.RENDER === 'true';
const migrateOnBuild =
  process.env.MIGRATE_ON_BUILD === '1' || process.env.MIGRATE_ON_BUILD === 'true';

if (!render && !migrateOnBuild) {
  process.exit(0);
}

const root = path.join(__dirname, '..');
const script = path.join(__dirname, 'prisma-migrate-deploy.cjs');
const r = spawnSync(process.execPath, [script], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(r.status === 0 ? 0 : r.status || 1);
