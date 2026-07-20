import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const docTypeEnum = pgEnum("doc_type", [
  "policy",
  "faq",
  "pricing",
  "about",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "processing",
  "ready",
  "failed",
]);

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "member"]);

export const providerEnum = pgEnum("provider", [
  "nvidia_nim",
  "openrouter",
  "groq",
  "custom",
]);

export const rejectedReasonEnum = pgEnum("rejected_reason", [
  "rate_limited",
  "flagged",
  "low_confidence",
]);

// Embedding dimension for Xenova/all-MiniLM-L6-v2 (local, free, runs via
// @huggingface/transformers — no API key/cost). Change if the embedding
// model changes — pgvector column dimension is fixed at creation time.
export const EMBEDDING_DIMENSIONS = 384;

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  siteKey: text("site_key").notNull().unique(),
  secretKey: text("secret_key").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: Auth.js creates the user row before our post-signup hook
    // assigns a tenant (see lib/auth.ts events.createUser).
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("users_tenant_id_idx").on(table.tenantId),
    index("users_email_idx").on(table.email),
  ]
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    docType: docTypeEnum("doc_type").notNull(),
    filename: text("filename").notNull(),
    blobUrl: text("blob_url"),
    status: documentStatusEnum("status").notNull().default("processing"),
    failureReason: text("failure_reason"),
    // PDF only — total page count and the range actually ingested (null
    // range = the whole document, up to the plan's page cap).
    totalPages: integer("total_pages"),
    pageRangeFrom: integer("page_range_from"),
    pageRangeTo: integer("page_range_to"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("documents_tenant_id_idx").on(table.tenantId)]
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    docType: docTypeEnum("doc_type").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chunks_tenant_id_idx").on(table.tenantId),
    index("chunks_document_id_idx").on(table.documentId),
    index("chunks_tenant_doc_type_idx").on(table.tenantId, table.docType),
    // IVFFlat index for cosine-distance similarity search (Phase 5).
    // Requires ANALYZE after bulk inserts; lists tuned for small/medium corpora.
    index("chunks_embedding_idx")
      .using("ivfflat", sql`${table.embedding} vector_cosine_ops`)
      .with({ lists: 100 }),
  ]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    modelId: text("model_id").notNull(),
    baseUrl: text("base_url"),
    label: text("label").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_keys_tenant_id_idx").on(table.tenantId),
    index("api_keys_tenant_active_idx").on(table.tenantId, table.isActive),
  ]
);

export const usageLogs = pgTable(
  "usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    docTypeMatched: docTypeEnum("doc_type_matched"),
    confidenceScore: real("confidence_score"),
    tokensUsed: integer("tokens_used"),
    rejectedReason: rejectedReasonEnum("rejected_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_logs_tenant_id_idx").on(table.tenantId),
    index("usage_logs_tenant_created_idx").on(
      table.tenantId,
      table.createdAt
    ),
  ]
);

export const rateLimitConfig = pgTable("rate_limit_config", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  requestsPerMinute: integer("requests_per_minute").notNull().default(20),
  requestsPerDay: integer("requests_per_day").notNull().default(1000),
});
