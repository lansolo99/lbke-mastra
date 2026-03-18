import { LibSQLVector } from "@mastra/libsql";
import path from "path";

const dbUrl =
  process.env.LIBSQL_URL ??
  `file:${path.join(process.cwd(), "mastra-books-rag.db")}`;

export const booksVectorStore = new LibSQLVector({
  id: "books-vector-store",
  url: dbUrl,
  authToken: process.env.LIBSQL_AUTH_TOKEN,
});

export const BOOKS_INDEX_NAME = "books_embeddings";
export const EMBEDDING_DIMENSION = 384; // fastembed all-MiniLM-L6-v2
