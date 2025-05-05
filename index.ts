import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { randomUUID } from "crypto";
import { ListToolsRequestSchema, CallToolRequestSchema, type CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

// ===== Инструменты (Schemas) =====

const CreateItinerarySchema = z.object({
  origin: z.string().describe("Starting location"),
  destination: z.string().describe("Destination location"),
  startDate: z.string().describe("Start date (YYYY-MM-DD)"),
  endDate: z.string().describe("End date (YYYY-MM-DD)"),
  budget: z.number().optional().describe("Budget in USD"),
  preferences: z.array(z.string()).optional().describe("Travel preferences"),
});

const OptimizeItinerarySchema = z.object({
  itineraryId: z.string().describe("ID of the itinerary to optimize"),
  optimizationCriteria: z.array(z.string()).describe("Criteria for optimization (time, cost, etc.)"),
});

// ===== Сервер =====

const app = express();
app.use(express.json());

const sessions: Record<string, express.Response> = {};

app.get("/mcp", (req, res) => {
  const sessionId = randomUUID();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sessions[sessionId] = res;
  res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

  const keepAlive = setInterval(() => res.write(":\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(keepAlive);
    delete sessions[sessionId];
  });
});

app.post("/mcp", async (req, res) => {
  const sessionId = req.header("mcp-session-id");
  const sse = sessionId && sessions[sessionId];
  if (!sse) {
    return res.status(400).json({ error: "Invalid or missing mcp-session-id" });
  }

  let response;

  try {
    if (ListToolsRequestSchema.safeParse(req.body).success) {
      response = {
        jsonrpc: "2.0",
        id: req.body.id ?? null,
        result: {
          tools: [
            {
              name: "create_itinerary",
              description: "Creates a personalized travel itinerary",
              inputSchema: zodToJsonSchema(CreateItinerarySchema),
            },
            {
              name: "optimize_itinerary",
              description: "Optimizes an existing itinerary",
              inputSchema: zodToJsonSchema(OptimizeItinerarySchema),
            },
          ],
        },
      };
    } else {
      const call = CallToolRequestSchema.parse(req.body) as CallToolRequest;
      const { name, arguments: args, id } = call.params;

      switch (name) {
        case "create_itinerary": {
          const it = CreateItinerarySchema.parse(args);
          response = {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Created itinerary from ${it.origin} to ${it.destination}\nDates: ${it.startDate} – ${it.endDate}\nBudget: ${it.budget ?? "Not specified"}\nPreferences: ${it.preferences?.join(", ") || "None"}`,
                },
              ],
            },
          };
          break;
        }

        case "optimize_itinerary": {
          const it = OptimizeItinerarySchema.parse(args);
          response = {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Optimized itinerary ${it.itineraryId} based on: ${it.optimizationCriteria.join(", ")}`,
                },
              ],
            },
          };
          break;
        }

        default:
          response = {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Unknown tool: ${name}` },
          };
      }
    }
  } catch (err) {
    response = {
      jsonrpc: "2.0",
      id: req.body.id ?? null,
      error: {
        code: -32603,
        message: (err as Error).message,
      },
    };
  }

  sse.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
  res.status(204).end();
});

// healthcheck
app.get("/health", (_req, res) => res.send("OK"));

// запуск сервера
const port = Number(process.env.PORT) || 10000;
app.listen(port, () => {
  console.log(`✅ MCP SSE server listening on port ${port}`);
});
