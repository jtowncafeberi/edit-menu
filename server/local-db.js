import {DatabaseSync} from 'node:sqlite';
import {readFileSync, mkdirSync} from 'node:fs';
export function localDB(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync('work', {recursive: true});
  const db = new DatabaseSync(filename);
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_state'").get();
  if (!exists) db.exec(readFileSync(new URL('../drizzle/0000_menu_state.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) { return {bind(...args) { return {async first() { return db.prepare(sql).get(...args) ?? null; }, async run() { return {meta: db.prepare(sql).run(...args)}; }}; }}; },
    close() {db.close();},
  };
}
