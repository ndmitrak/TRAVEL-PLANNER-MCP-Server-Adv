import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// --- 1) Настройка MCP-сервера ---
const server = new Server(
  { name: "travel-planner", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Опишите здесь ваши инструменты так же, как раньше:
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_itinerary",
      description: "Create a trip",
      inputSchema: zodToJsonSchema(z.object({
        origin: z.string(),
        destination: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        budget: z.number().optional(),
        preferences: z.array(z.string()).optional(),
      })),
    },
    // … остальные инструменты …
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "create_itinerary": {
      const it = z.object({
        origin: z.string(),
        destination: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        budget: z.number().optional(),
        preferences: z.array(z.string()).optional(),
      }).parse(args);
      return {
        content: [
          {
            type: "text",
            text: `Trip planned: ${it.origin} → ${it.destination} (${it.startDate}—${it.endDate})`,
          },
        ],
      };
    }
    // … остальные кейсы …
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// --- 2) Подключение встроенного HTTP-транспорта ---
const port = Number(process.env.PORT) || 3000;
const transport = new HttpServerTransport({ port });
server.connect(transport).then(() => {
  console.log(`✅ HTTP MCP server running on port ${port}`);
}).catch(err => {
  console.error("Failed to start MCP HTTP server:", err);
  process.exit(1);
});
