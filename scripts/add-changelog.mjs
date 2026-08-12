#!/usr/bin/env node
/**
 * Add a changelog / build-todo item for a prototype.
 * Usage:
 *   node scripts/add-changelog.mjs --id portfolios-v3 --title "…" --summary "…"
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
}

function readConfig() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  const url = (raw.match(/supabaseUrl:\s*'([^']+)'/) || [])[1];
  const key = (raw.match(/supabaseAnonKey:\s*'([^']+)'/) || [])[1];
  return { url, key };
}

function readTitle(id) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
    const flat = manifest.reduce((all, e) => all.concat(e.children && e.children.length ? e.children : [e]), []);
    const hit = flat.find((m) => m.id === id);
    return hit ? hit.title : id;
  } catch (e) {
    return id;
  }
}

async function main() {
  const id = arg('id');
  const title = arg('title');
  const summary = arg('summary');
  const status = arg('status', 'todo');
  if (!id || !title || !summary) {
    console.error('Usage: node scripts/add-changelog.mjs --id <prototype-id> --title "…" --summary "…"');
    process.exit(1);
  }

  const { url, key } = readConfig();
  if (!url || !key) {
    console.error('Missing supabaseUrl / supabaseAnonKey in config.js');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    prototype_id: id,
    prototype_title: readTitle(id),
    title,
    summary,
    status: status === 'done' ? 'done' : 'todo',
    annotation: {},
    page_path: 'mocks/' + id + '.html',
    created_at: now,
    updated_at: now,
  };

  const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/changelog', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(item),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Supabase error ' + res.status + ':', body);
    console.error('If the table is missing, run supabase-changelog.sql in the SQL Editor.');
    process.exit(1);
  }

  const rows = await res.json();
  console.log('Changelog item created:', rows[0] && rows[0].id ? rows[0].id : item.id);
  console.log('View: changelog.html?id=' + encodeURIComponent(id));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
