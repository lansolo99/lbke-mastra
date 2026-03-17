import { createLogRecordSchema } from "@mastra/core/storage";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const websearchTool = createTool({
  id: "web-search",
  description: "Fetch information about a technology from Wikipedia",
  inputSchema: z.object({
    technology: z
      .string()
      .describe(
        'The technology, framework, or library to look up (e.g. "React", "PostgreSQL")',
      ),
  }),
  outputSchema: z.object({
    title: z.string(),
    url: z.string(),
    summary: z.string(),
  }),
  execute: async (inputData) => {
    const { technology } = inputData;
    const encoded = encodeURIComponent(technology);
    const url = `https://en.wikipedia.org/wiki/${encoded}`;

    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const response = await fetch(apiUrl);
    console.log(response);
    console.log(response);

    if (!response.ok) {
      return {
        title: technology,
        url,
        summary: `No Wikipedia article found for "${technology}".`,
      };
    }

    const data = (await response.json()) as {
      title: string;
      extract: string;
      content_urls?: { desktop?: { page?: string } };
    };

    return {
      title: data.title,
      url: data.content_urls?.desktop?.page ?? url,
      summary: data.extract,
    };
  },
});
