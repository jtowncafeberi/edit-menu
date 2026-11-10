import {createEngine, SOURCE_ID} from '../engine.js';
import data from '../static/data.json' with {type: 'json'};
const validator = createEngine(data, new Uint8Array(), new Uint8Array());
const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store'};
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers});
const empty = () => ({source: SOURCE_ID, revision: 0, edits: {}, updatedAt: null});
const record = row => row ? {source: row.source, revision: row.revision, edits: JSON.parse(row.edits), updatedAt: row.updated_at, mutationId: row.mutation_id} : empty();
export async function menuAPI(request, env) {
  if (new URL(request.url).pathname !== '/api/menu') return null;
  if (!env.DB) return json({error: 'Shared storage is unavailable.'}, 503);
  try {
    if (request.method === 'GET') return json(record(await env.DB.prepare('SELECT * FROM menu_state WHERE source = ?').bind(SOURCE_ID).first()));
    if (request.method !== 'PUT') return json({error: 'Method not allowed.'}, 405);
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({error: 'Use the menu editor to save changes.'}, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error: 'JSON required.'}, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({error: 'Missing menu changes.'}, 400);
    const chunks = []; let length = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.length;
      if (length > 131072) { await reader.cancel(); return json({error: 'Menu changes are too large.'}, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
      if (body.source !== SOURCE_ID || !Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.mutationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.mutationId)) throw Error('Invalid save request.');
      validator.validate(body.edits);
    } catch (error) { return json({error: error.message}, 422); }
    const edits = Object.fromEntries(Object.entries(body.edits).filter(([id, value]) => value !== validator.fields.get(id).text));
    const updatedAt = new Date().toISOString();
    // Compare-and-swap prevents a stale browser from overwriting a newer saved menu.
    const result = await env.DB.prepare(`INSERT INTO menu_state (source, revision, edits, updated_at, mutation_id)
      SELECT ?, ? + 1, ?, ?, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM menu_state WHERE source = ?)
      ON CONFLICT(source) DO UPDATE SET revision = menu_state.revision + 1, edits = excluded.edits,
      updated_at = excluded.updated_at, mutation_id = excluded.mutation_id WHERE menu_state.revision = ?`)
      .bind(SOURCE_ID, body.revision, JSON.stringify(edits), updatedAt, body.mutationId, body.revision, SOURCE_ID, body.revision).run();
    const current = record(await env.DB.prepare('SELECT * FROM menu_state WHERE source = ?').bind(SOURCE_ID).first());
    if (!result.meta.changes && current.mutationId !== body.mutationId) return json({error: 'A newer menu was saved on another device.', current}, 409);
    return json(current);
  } catch (error) {
    console.error('Menu storage request failed:', error.message);
    return json({error: 'Shared storage is temporarily unavailable. Your changes remain on this device.'}, 503);
  }
}
