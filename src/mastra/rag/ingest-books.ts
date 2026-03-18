/**
 * Ingestion script for books.pdf
 * Run once to populate the vector store:
 *   npx tsx src/mastra/rag/ingest-books.ts
 */
import { readFileSync } from "fs";
import { config } from "dotenv";
import { PDFParse } from "pdf-parse";
import { MDocument } from "@mastra/rag";
import { fastembed } from "@mastra/fastembed";
import { embedMany } from "ai";
import {
  booksVectorStore,
  BOOKS_INDEX_NAME,
  EMBEDDING_DIMENSION,
} from "./vector-store.js";

config(); // load .env

const PDF_PATH = "/Users/stephane/Documents/stephane/DEV/lansolo/lbke-mastra/src/mastra/public/data/books.pdf";

async function ingest() {
  console.log("Reading PDF...");
  const pdfBuffer = readFileSync(PDF_PATH);

  console.log("Parsing PDF text...");
  const parser = new PDFParse({ data: pdfBuffer });
  const { text } = await parser.getText();

  console.log(`Extracted ${text.length} characters from PDF.`);

  const doc = MDocument.fromText(text, { source: "books.pdf" });

  console.log("Chunking document...");
  const chunks = await doc.chunk({
    strategy: "recursive",
    maxSize: 512,
    overlap: 50,
  });

  console.log(`Created ${chunks.length} chunks.`);

  console.log("Generating embeddings...");
  const { embeddings } = await embedMany({
    model: fastembed,
    values: chunks.map((chunk) => chunk.text),
  });

  console.log("Creating index (if needed)...");
  const indexes = await booksVectorStore.listIndexes();
  if (!indexes.includes(BOOKS_INDEX_NAME)) {
    await booksVectorStore.createIndex({
      indexName: BOOKS_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
  }

  console.log("Upserting embeddings...");
  await booksVectorStore.upsert({
    indexName: BOOKS_INDEX_NAME,
    vectors: embeddings,
    metadata: chunks.map((chunk) => ({
      text: chunk.text,
      source: "books.pdf",
    })),
  });

  console.log(`Done! Upserted ${chunks.length} vectors into "${BOOKS_INDEX_NAME}".`);
}

ingest().catch((err) => {
  console.error(err);
  process.exit(1);
});
