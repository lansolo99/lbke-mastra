import { createStep, createWorkflow } from "@mastra/core/workflows";
import { fastembed } from "@mastra/fastembed";
import { embed } from "ai";
import { z } from "zod";
import {
  booksVectorStore,
  BOOKS_INDEX_NAME,
} from "../rag/vector-store.js";

const fetchDocumentsStep = createStep({
  id: "fetch-documents",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
    documents: z.array(
      z.object({
        text: z.string(),
        score: z.number(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { message } = inputData;

    const { embedding } = await embed({
      model: fastembed,
      value: message,
    });

    const results = await booksVectorStore.query({
      indexName: BOOKS_INDEX_NAME,
      queryVector: embedding,
      topK: 3,
    });

    const documents = results.map((r) => ({
      text: (r.metadata?.text as string) ?? "",
      score: r.score,
    }));

    return { message, documents };
  },
});

const branchInputSchema = z.object({
  message: z.string(),
  documents: z.array(
    z.object({
      text: z.string(),
      score: z.number(),
    })
  ),
});

const branchOutputSchema = z.object({
  formatted: z.string(),
});

const withRagStep = createStep({
  id: "with-rag",
  inputSchema: branchInputSchema,
  outputSchema: branchOutputSchema,
  execute: async ({ inputData }) => {
    const { message, documents } = inputData;
    const ragContext = documents
      .map((d, i) => `[${i + 1}] (score: ${d.score.toFixed(3)}): ${d.text}`)
      .join("\n\n");
    return {
      formatted: `Query: ${message}\n\nRelevant passages from books.pdf:\n\n${ragContext}`,
    };
  },
});

const noResultsStep = createStep({
  id: "no-results",
  inputSchema: branchInputSchema,
  outputSchema: branchOutputSchema,
  execute: async ({ inputData }) => {
    return {
      formatted: `No relevant passages found for: "${inputData.message}"`,
    };
  },
});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    formatted: z.string(),
  }),
})
  .then(fetchDocumentsStep)
  .branch([
    [
      async ({ inputData }) => inputData.documents.length > 0,
      withRagStep,
    ],
    [
      async ({ inputData }) => inputData.documents.length === 0,
      noResultsStep,
    ],
  ])
  .map(async ({ inputData }) => {
    return (
      inputData["with-rag"] ??
      inputData["no-results"] ?? { formatted: "" }
    );
  });

testWorkflow.commit();
