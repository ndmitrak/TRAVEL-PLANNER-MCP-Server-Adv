// src/index.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";  // новый SSE/HTTP-транспорт
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// 1) Настройка MCP-сервера
const server = new Server(
  { name: "travel-planner", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Описание инструментов
const CreateItinerarySchema = z.object({ /* …ваши поля… */ });
// … остальные схемы …

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_itinerary",
      description: "Create a trip",
      inputSchema: zodToJsonSchema(CreateItinerarySchema),
    },
    // … другие инструменты …
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "create_itinerary": {
      const it = CreateItinerarySchema.parse(args);
      return {
        content: [
          {
            type: "text",
            text: `Trip planned: ${it.origin} → ${it.destination} (${it.startDate}—${it.endDate})`,
          },
        ],
      };
    }
    // … кейсы остальных инструментов …
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// 2) Запуск HTTP-транспорта с SSE/JSON-RPC
const port = Number(process.env.PORT) || 3000;
const transport = new HttpServerTransport({ port });          // слушает SSE на GET /
server.connect(transport).then(() => {
  console.log(`✅ MCP SSE server listening on port ${port}`);
}).catch(err => {
  console.error("Failed to start MCP HTTP transport:", err);
  process.exit(1);
});
