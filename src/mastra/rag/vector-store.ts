import { LibSQLVector } from "@mastra/libsql";

export const booksVectorStore = new LibSQLVector({
  id: "books-vector-store",
  url: "file:/Users/stephane/Documents/stephane/DEV/lansolo/lbke-mastra/mastra-books-rag.db",
});

export const BOOKS_INDEX_NAME = "books_embeddings";
export const EMBEDDING_DIMENSION = 384; // fastembed all-MiniLM-L6-v2
