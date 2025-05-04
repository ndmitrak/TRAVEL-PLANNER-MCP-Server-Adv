// src/index.ts

import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, ListToolsRequest, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// 1) Создаём MCP-сервер и описываем инструменты
const server = new McpServer({ name: "travel-planner", version: "0.1.0" });

// Схемы
const CreateItinerarySchema = z.object({
  origin: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().optional(),
  preferences: z.array(z.string()).optional(),
});
// … остальные схемы аналогично …

// Регистрируем инструменты
server.tool(
  "create_itinerary",
  CreateItinerarySchema,
  async ({ origin, destination, startDate, endDate, budget, preferences }) => ({
    content: [
      {
        type: "text",
        text: `Created itinerary from ${origin} to ${destination}\n` +
              `Dates: ${startDate}–${endDate}\n` +
              `Budget: ${budget ?? "n/a"}\n` +
              `Prefs: ${preferences?.join(", ") || "none"}`,
      },
    ],
  })
);

// … server.tool("optimize_itinerary", ...), моторы для остальных инструментов …

// 2) Настраиваем Express и Streamable HTTP транспорт
const app = express();
app.use(express.json());

// Хранилище транс портов по sessionId
const transports: Record<string, StreamableHTTPServerTransport> = {};

// Все запросы (POST, GET, DELETE) на /mcp
app.post("/mcp", async (req, res) => {
  const sessionId = req.header("mcp-session-id");
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // существующий сеанс
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // новый сеанс
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newId) => { transports[newId] = transport; },
    });
    transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
    await server.connect(transport);
  } else {
    // некорректный запрос
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: invalid or missing mcp-session-id" },
      id: null,
    });
  }

  // передать JSON-RPC тело в транспорт
  await transport.handleRequest(req, res, req.body);
});

const handleSession = async (req: express.Request, res: express.Response) => {
  const sessionId = req.header("mcp-session-id");
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send("Invalid or missing mcp-session-id");
  }
  await transports[sessionId].handleRequest(req, res);
};

// SSE-канал для серверных сообщений
app.get("/mcp", handleSession);
app.delete("/mcp", handleSession);

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ MCP Streamable HTTP server running on port ${port}`);
});
