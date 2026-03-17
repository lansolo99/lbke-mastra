import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const websearchTool = createTool({
  id: "web-search",
  description:
    "Fetch information about one or more technologies from Wikipedia. Pass all technologies you want to look up at once as a list.",
  inputSchema: z.object({
    technologies: z
      .array(z.string())
      .describe(
        'List of technologies, frameworks, or libraries to look up (e.g. ["React", "PostgreSQL"])',
      ),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        summary: z.string(),
      }),
    ),
  }),
  requireApproval: true,
  execute: async (inputData) => {
    const { technologies } = inputData;

    const results = await Promise.all(
      technologies.map(async (technology) => {
        const encoded = encodeURIComponent(technology);
        const url = `https://en.wikipedia.org/wiki/${encoded}`;
        const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
        const response = await fetch(apiUrl);

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
      }),
    );

    return { results };
  },
});
