import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import {
  Observability,
  DefaultExporter,
  SensitiveDataFilter,
} from "@mastra/observability";
import { LangfuseExporter } from "@mastra/langfuse";
import { weatherWorkflow } from "./workflows/weather-workflow";
import { testWorkflow } from "./workflows/test-workflow";
import { weatherAgent } from "./agents/weather-agent";
import { stackPickerAgent } from "./agents/stackpicker-agent";
import { booksRagAgent } from "./agents/books-rag-agent";
import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
} from "./scorers/weather-scorer";
import { booksContextualRelevancyScorer } from "./scorers/books-rag-scorer.js";

export const mastra = new Mastra({
  workflows: { weatherWorkflow, testWorkflow },
  agents: { weatherAgent, stackPickerAgent, booksRagAgent },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
    booksContextualRelevancyScorer,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: "file:./mastra-1.db",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL,
          }),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
