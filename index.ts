import express from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type ListToolsRequest,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';

////////////////////////////////////////////////////////////////////////////////
// 1) Логика MCP-инструментов
////////////////////////////////////////////////////////////////////////////////

const CreateItinerarySchema = z.object({
  origin: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().optional(),
  preferences: z.array(z.string()).optional(),
});

// Функция-обработчик ListTools
async function listToolsHandler() {
  return {
    jsonrpc: '2.0' as const,
    id: null,
    result: {
      tools: [
        {
          name: 'create_itinerary',
          description: 'Creates a personalized travel itinerary',
          inputSchema: zodToJsonSchema(CreateItinerarySchema),
        },
        // …другие инструменты…
      ],
    },
  };
}

// Функция-обработчик CallTool
async function callToolHandler(req: CallToolRequest) {
  const { name, arguments: args, id } = req.params;
  switch (name) {
    case 'create_itinerary': {
      const it = CreateItinerarySchema.parse(args);
      return {
        jsonrpc: '2.0' as const,
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Created itinerary from ${it.origin} to ${it.destination}
Dates: ${it.startDate} – ${it.endDate}
Budget: ${it.budget ?? 'n/a'}`,
            },
          ],
        },
      };
    }
    // … остальные кейсы …
    default:
      return {
        jsonrpc: '2.0' as const,
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      };
  }
}

////////////////////////////////////////////////////////////////////////////////
// 2) SSE + JSON-RPC transport вручную
////////////////////////////////////////////////////////////////////////////////

const app = express();
app.use(express.json());

// Хранилище ответов SSE
const sessions: Record<string, express.Response> = {};

// SSE endpoint — открывает EventStream и выдаёт sessionId
app.get('/mcp', (req, res) => {
  const sessionId = randomUUID();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sessions[sessionId] = res;
  res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

  const keepAlive = setInterval(() => res.write(':\n\n'), 15000);
  req.on('close', () => {
    clearInterval(keepAlive);
    delete sessions[sessionId];
  });
});

// POST /mcp — клиент шлёт JSON-RPC запросы
app.post('/mcp', async (req, res) => {
  const sessionId = req.header('mcp-session-id');
  const sse = sessionId && sessions[sessionId];
  if (!sse) {
    return res.status(400).json({ error: 'Invalid or missing mcp-session-id' });
  }

  let response;
  try {
    if (ListToolsRequestSchema.safeParse(req.body).success) {
      response = await listToolsHandler();
    } else {
      const callReq = CallToolRequestSchema.parse(req.body) as CallToolRequest;
      response = await callToolHandler(callReq);
    }
  } catch (err) {
    response = {
      jsonrpc: '2.0',
      id: req.body.id ?? null,
      error: { code: -32603, message: (err as Error).message },
    };
  }

  // Отправляем по SSE
  sse.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
  res.status(204).end();
});

// Для проверки здоровья
app.get('/health', (_req, res) => res.send('OK'));

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ MCP SSE server listening on port ${port}`);
});
