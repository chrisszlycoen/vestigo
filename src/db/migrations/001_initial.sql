-- Core memory table
CREATE TABLE IF NOT EXISTS memories (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    line_start   INTEGER,
    line_end     INTEGER,
    content      TEXT NOT NULL,
    source_type  TEXT NOT NULL,
    source_ref   TEXT,
    source_url   TEXT,
    is_outdated  INTEGER DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_workspace_file ON memories(workspace_id, file_path);
CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(workspace_id, source_type, source_ref);

-- Code index for semantic search (Stage 1)
CREATE TABLE IF NOT EXISTS code_index (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    line_start   INTEGER NOT NULL,
    line_end     INTEGER NOT NULL,
    symbol_name  TEXT,
    symbol_type  TEXT,
    search_text  TEXT NOT NULL,
    indexed_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_index_workspace_file ON code_index(workspace_id, file_path);

-- Embedding vectors for semantic search (Stage 2)
-- Uses sqlite-vec virtual table; created lazily when embeddings are first needed.

-- Link embeddings back to index
CREATE TABLE IF NOT EXISTS embedding_chunks (
    chunk_id     TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    line_start   INTEGER NOT NULL,
    content      TEXT NOT NULL,
    workspace_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_embedding_chunks_workspace_file ON embedding_chunks(workspace_id, file_path);

-- Tracked incidents / critical module notes
CREATE TABLE IF NOT EXISTS incidents (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    description  TEXT NOT NULL,
    incident_at  TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_workspace_file ON incidents(workspace_id, file_path);

-- Settings per workspace
CREATE TABLE IF NOT EXISTS workspace_settings (
    workspace_id TEXT PRIMARY KEY,
    github_owner TEXT,
    github_repo  TEXT,
    sync_enabled INTEGER DEFAULT 0,
    last_pr_sync TEXT,
    index_paths  TEXT
);
