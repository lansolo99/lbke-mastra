import { Agent } from "@mastra/core/agent";
import { createVectorQueryTool } from "@mastra/rag";
import { fastembed } from "@mastra/fastembed";
import { LIBSQL_PROMPT } from "@mastra/libsql";
import {
  booksVectorStore,
  BOOKS_INDEX_NAME,
} from "../rag/vector-store.js";

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: "books-vector-store",
  indexName: BOOKS_INDEX_NAME,
  model: fastembed,
  vectorStore: booksVectorStore,
});

export const booksRagAgent = new Agent({
  id: "books-rag-agent",
  name: "Books RAG Agent",
  model: "openrouter/mistralai/codestral-2508",
  instructions: `You are a knowledgeable assistant with access to the contents of a books PDF.
Use the vector search tool to retrieve relevant passages from the book before answering questions.
Always base your answers on the retrieved context. If the context doesn't contain enough information, say so clearly.

${LIBSQL_PROMPT}
`,
  tools: { vectorQueryTool },
});
