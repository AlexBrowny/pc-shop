// «Сборка» проекта. Фронтенд — нативные ES-модули без бандлера, поэтому сборка = проверка:
//  1) синтаксис всех JS-файлов сервера, клиента, админки и скриптов (node --check);
//  2) валидность SQL-миграций по именам и порядку;
//  3) наличие neon.ts и объявленных в нём бакетов, которые использует код.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (line) => process.stdout.write(`${line}\n`);
const SKIP = new Set(['node_modules', '.git', 'data']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(js|mjs)$/.test(entry.name) && !full.includes(`${path.sep}vendor${path.sep}`) ? [full] : [];
  });
}

const files = ['server', 'public', 'scripts', 'tests', 'data', 'api'].flatMap((d) => walk(path.join(root, d)));
const failures = [];
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failures.push(`${path.relative(root, file)}\n${String(err.stderr ?? err.message).split('\n').slice(0, 4).join('\n')}`);
  }
}
if (failures.length) {
  out(`Синтаксические ошибки (${failures.length}):\n${failures.join('\n\n')}`);
  process.exit(1);
}
out(`JS: проверено файлов — ${files.length}`);

const migrations = fs.readdirSync(path.join(root, 'server', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
if (!migrations.length || !migrations.every((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))) {
  out('Миграции: имена должны быть вида 001_name.sql');
  process.exit(1);
}
out(`SQL: миграций — ${migrations.length} (${migrations.join(', ')})`);

const neonConfig = fs.readFileSync(path.join(root, 'neon.ts'), 'utf8');
for (const bucket of ['receipts', 'media']) {
  if (!new RegExp(`\\b${bucket}\\s*:`).test(neonConfig)) {
    out(`neon.ts: не объявлен бакет «${bucket}»`);
    process.exit(1);
  }
}
out('neon.ts: бакеты receipts и media объявлены');
out('Build OK');
