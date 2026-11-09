import { pool, query } from './index.js';

export const ddl = `
-- 啟用 UUID 擴充
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 系統管理資料表: session (由 connect-pg-simple 自動維護)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- 2. 系統管理資料表: storage_cleanup_jobs (持久化孤兒檔案清理表，Phase1v5.6 規範)
CREATE TABLE IF NOT EXISTS "storage_cleanup_jobs" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "storage_path" varchar(512) NOT NULL,
  "reason" varchar(100) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  "worker_id" varchar(64),
  "lease_timeout_at" timestamp with time zone,
  "retry_count" integer NOT NULL DEFAULT 0,
  "next_retry_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "error_message" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_cleanup_jobs_queue" ON "storage_cleanup_jobs"("status", "next_retry_at", "lease_timeout_at");

-- 3. 業務資料表: users
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" varchar(255) UNIQUE NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- 4. 業務資料表: courses (複合 UNIQUE 供多租戶外鍵約束)
CREATE TABLE IF NOT EXISTS "courses" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_courses_id_user_id" UNIQUE ("id", "user_id")
);
CREATE INDEX IF NOT EXISTS "idx_courses_user_id" ON "courses"("user_id");

-- 5. 業務資料表: documents (複合外鍵修正 + 租約管理)
CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" uuid,
  "original_filename" varchar(255) NOT NULL,
  "storage_path" varchar(512) NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" varchar(127) NOT NULL,
  "file_extension" varchar(10) NOT NULL,
  "checksum_sha256" varchar(64) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  "worker_id" varchar(64),
  "lease_timeout_at" timestamp with time zone,
  "processing_started_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone,
  "retry_count" integer NOT NULL DEFAULT 0,
  "reprocess_count" integer NOT NULL DEFAULT 0,
  "processing_version" integer NOT NULL DEFAULT 1,
  "chunking_version" integer NOT NULL DEFAULT 1,
  "parser_type" varchar(30),
  "parser_version" varchar(30),
  "error_message" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_documents_id_user_id" UNIQUE ("id", "user_id"),
  CONSTRAINT "fk_documents_course_user" FOREIGN KEY ("course_id", "user_id") REFERENCES "courses"("id", "user_id") ON DELETE SET NULL (course_id)
);
CREATE INDEX IF NOT EXISTS "idx_documents_user_id" ON "documents"("user_id");
CREATE INDEX IF NOT EXISTS "idx_documents_course_id" ON "documents"("course_id");
CREATE INDEX IF NOT EXISTS "idx_documents_claim_queue" ON "documents"("status", "retry_count", "next_retry_at");
CREATE INDEX IF NOT EXISTS "idx_documents_reaper" ON "documents"("status", "lease_timeout_at", "retry_count");

-- 6. 業務資料表: document_chunks (含唯一約束與全文檢索 GIN 索引)
CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "source_location" jsonb NOT NULL,
  "chunking_version" integer NOT NULL DEFAULT 1,
  "search_vector" tsvector NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_chunks_doc_chunk_idx" UNIQUE ("document_id", "chunk_index")
);
CREATE INDEX IF NOT EXISTS "idx_chunks_document_id" ON "document_chunks"("document_id");
CREATE INDEX IF NOT EXISTS "idx_chunks_user_id" ON "document_chunks"("user_id");
CREATE INDEX IF NOT EXISTS "idx_chunks_search_vector" ON "document_chunks" USING GIN("search_vector");

-- 7. 業務資料表: document_summaries
CREATE TABLE IF NOT EXISTS "document_summaries" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "summary_text" text NOT NULL,
  "key_points" jsonb,
  "model_provider" varchar(50) NOT NULL,
  "model_name" varchar(100) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_summaries_document_id" ON "document_summaries"("document_id");

-- 8. 業務資料表: notes (個人筆記系統，含樂觀鎖 version)
CREATE TABLE IF NOT EXISTS "notes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" uuid,
  "document_id" uuid,
  "title" varchar(255) NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_notes_course_user" FOREIGN KEY ("course_id", "user_id") REFERENCES "courses"("id", "user_id") ON DELETE SET NULL (course_id),
  CONSTRAINT "fk_notes_document_user" FOREIGN KEY ("document_id", "user_id") REFERENCES "documents"("id", "user_id") ON DELETE SET NULL (document_id)
);
CREATE INDEX IF NOT EXISTS "idx_notes_user_id" ON "notes"("user_id");
CREATE INDEX IF NOT EXISTS "idx_notes_course_id" ON "notes"("course_id");
CREATE INDEX IF NOT EXISTS "idx_notes_document_id" ON "notes"("document_id");

-- 9. 業務資料表: chat_sessions
CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL,
  "title" varchar(255) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_chat_sessions_id_user_id" UNIQUE ("id", "user_id")
);
CREATE INDEX IF NOT EXISTS "idx_chat_sessions_user_id" ON "chat_sessions"("user_id");

-- 10. 業務資料表: chat_messages
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "session_id" uuid NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  "content" text NOT NULL,
  "source_chunks" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_chat_messages_session_id" ON "chat_messages"("session_id");
`;

export async function runMigration() {
  console.log('[Migration] Starting database migration...');
  try {
    await query(ddl);
    console.log('[Migration] All 10 database tables and indexes migrated successfully.');
    return true;
  } catch (err) {
    console.error('[Migration Error] Migration failed:', err.message);
    throw err;
  }
}

// 若直接執行此腳本 (node src/db/migrate.js)
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigration()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}
