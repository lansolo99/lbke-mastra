import { z } from "zod"
import TurndownService from "turndown"
import { load } from "cheerio"
import { createStep, createWorkflow } from "@mastra/core/workflows"
import { MDocument } from "@mastra/rag"
import { embedMany } from "ai"
import { openrouter } from "@openrouter/ai-sdk-provider"
import { CloudClient } from "chromadb"

const CHROMA_COLLECTION = "doc_ingestion"

async function downloadUrlAsMarkdown(url: string, selector?: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${url} ${res.status} ${res.statusText}`)
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0].toLowerCase()
  if (!mimeType) {
    throw new Error(`${url} unknown mime-type`)
  }
  if (!["text/html", "text/plain", "text/markdown"].includes(mimeType)) {
    throw new Error(`${url} not text or HTML: '${mimeType}'`)
  }
  let body = await res.text()
  let md = body
  if (mimeType === "text/html") {
    if (selector) {
      const $ = load(body)
      const element = $(selector).html()
      if (element) {
        body = element
      } else {
        console.warn(`${url} selector "${selector}" didn't match, using full body`)
      }
    }
    const turndownService = new TurndownService()
    turndownService.remove(["script", "nav", "style"])
    md = turndownService.turndown(body)
  }
  return md
}

// Step 1: Fetch URLs and convert to markdown
const downloadStep = createStep({
  id: "download-urls",
  description: "Fetches each URL and converts HTML to Markdown",
  inputSchema: z.array(z.string().url()),
  outputSchema: z.array(
    z.object({
      url: z.string(),
      markdown: z.string(),
    })
  ),
  execute: async ({ inputData }) => {
    const results = []
    for (const url of inputData) {
      console.log("Fetching", url)
      const markdown = await downloadUrlAsMarkdown(url, "article")
      results.push({ url, markdown })
    }
    return results
  },
})

const chunkSchema = z.object({
  text: z.string(),
  metadata: z.record(z.string(), z.any()),
})

// Step 2: Chunk each markdown doc into pieces using MDocument
const chunkStep = createStep({
  id: "chunk-docs",
  description: "Chunks each markdown document into smaller pieces",
  inputSchema: z.object({
    url: z.string(),
    markdown: z.string(),
  }),
  outputSchema: z.array(chunkSchema),
  execute: async ({ inputData }) => {
    const doc = MDocument.fromMarkdown(inputData.markdown, { source: inputData.url })
    const chunks = await doc.chunk({
      strategy: "recursive",
      maxSize: 500,
      overlap: 50,
    })
    return chunks.map((chunk) => ({
      text: chunk.text,
      metadata: { ...(chunk.metadata ?? {}), source: inputData.url },
    }))
  },
})

// Step 3: Flatten all chunks from all docs
const flattenStep = createStep({
  id: "flatten-chunks",
  description: "Flattens all chunks from all docs into a single array",
  inputSchema: z.array(z.array(chunkSchema)),
  outputSchema: z.array(chunkSchema),
  execute: async ({ inputData }) => inputData.flat(),
})

// Step 4: Embed chunks and store in Chroma
const embedAndStoreStep = createStep({
  id: "embed-and-store",
  description: "Computes embeddings and stores chunks in ChromaDB",
  inputSchema: z.array(chunkSchema),
  outputSchema: z.object({
    count: z.number(),
    collection: z.string(),
  }),
  execute: async ({ inputData: chunks }) => {
    console.log(`Computing embeddings for ${chunks.length} chunks...`)
    const { embeddings } = await embedMany({
      model: openrouter.textEmbeddingModel("mistralai/mistral-embed-2312"),
      values: chunks.map((c) => c.text),
    })

    console.log("Connecting to ChromaDB Cloud...")
    const client = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY!,
      tenant: "9a1d7711-7825-4f60-a83c-152bc2f1039c",
      database: "mastra-mars-2026",
    })
    // Delete and recreate collection to ensure correct embedding dimension (1024)
    try {
      await client.deleteCollection({ name: CHROMA_COLLECTION })
      console.log(`Deleted existing collection "${CHROMA_COLLECTION}"`)
    } catch {
      // collection didn't exist yet, ignore
    }
    const collection = await client.createCollection({ name: CHROMA_COLLECTION })

    console.log(`Storing ${chunks.length} vectors in Chroma collection "${CHROMA_COLLECTION}"...`)
    await collection.add({
      ids: chunks.map((_, i) => `chunk-${Date.now()}-${i}`),
      embeddings: embeddings,
      documents: chunks.map((c) => c.text),
      metadatas: chunks.map((c) => c.metadata),
    })

    return { count: chunks.length, collection: CHROMA_COLLECTION }
  },
})

export const docIngestionWorkflow = createWorkflow({
  id: "doc-ingestion",
  inputSchema: z.array(z.string().url()).describe("Array of URLs to ingest"),
  outputSchema: z.object({
    count: z.number(),
    collection: z.string(),
  }),
})
  .then(downloadStep)
  .foreach(chunkStep)
  .then(flattenStep)
  .then(embedAndStoreStep)
  .commit()
