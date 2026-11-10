CREATE TABLE menu_state (
  source TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL,
  edits TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  mutation_id TEXT NOT NULL
);
