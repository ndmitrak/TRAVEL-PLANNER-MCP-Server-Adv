import express from 'express';
import bodyParser from 'body-parser';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
  type Response
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// --- MCP Server Setup ---
const server = new Server(
  { name: "travel-planner", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const CreateItinerarySchema = z.object({
  origin: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().optional(),
  preferences: z.array(z.string()).optional(),
});

// — остальные схемы аналогично —
// OptimizeItinerarySchema, SearchAttractionsSchema, GetTransportOptionsSchema, GetAccommodationsSchema

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_itinerary",
      description: "Create a trip",
      inputSchema: zodToJsonSchema(CreateItinerarySchema),
    },
    // … другие инструменты
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
            text: `Trip planned: ${it.origin} → ${it.destination} (${it.startDate}–${it.endDate})`,
          },
        ],
      };
    }
    // … остальные кейсы
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// --- HTTP server wrapper ---
const app = express();
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  try {
    // Попытка распарсить запрос как вызов инструмента
    let parsedRequest: CallToolRequest | ListToolsRequest;
    try {
      parsedRequest = CallToolRequestSchema.parse(req.body);
    } catch {
      parsedRequest = ListToolsRequestSchema.parse(req.body);
    }

    // Обработка MCP-запроса
    const mcpResponse = await server.handle(parsedRequest) as Response;
    res.json(mcpResponse);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    res.status(400).json({
      error: "Invalid MCP request",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`✅ Travel Planner HTTP server listening on port ${port}`);
});
