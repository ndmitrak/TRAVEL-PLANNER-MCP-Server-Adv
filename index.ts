// src/index.ts
import express from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type ListToolsRequest,
  type CallToolRequest,
  type Response
} from '@modelcontextprotocol/sdk/types.js';

////////////////////////////////////////////////////////////////////////////////
// 1) Опишите ваши схемы и логику инструментов точно так же, как вы это делали:
////////////////////////////////////////////////////////////////////////////////

const CreateItinerarySchema = z.object({
  origin: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().optional(),
  preferences: z.array(z.string()).optional(),
});
// … остальные схемы …

async function listToolsHandler(): Promise<Response> {
  return {
    jsonrpc: '2.0',
    id: null,
    result: {
      tools: [
        {
          name: 'create_itinerary',
          description: 'Creates a personalized travel itinerary',
          inputSchema: zodToJsonSchema(CreateItinerarySchema),
        },
        // … другие инструменты …
      ],
    },
  };
}

async function callToolHandler(req: CallToolRequest): Promise<Response> {
  const { name, arguments: args, id } = req.params;
  let resultContent;
  switch (name) {
    case 'create_itinerary': {
      const it = CreateItinerarySchema.parse(args);
      resultContent = [
        {
          type: 'text',
          text: `Created itinerary from ${it.origin} to ${it.destination}\nDates: ${it.startDate} – ${it.endDate}`,
        },
      ];
      break;
    }
    // … остальные кейсы …
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      };
  }
  return {
    jsonrpc: '2.0',
    id,
    result: { content: resultContent },
  };
}

////////////////////////////////////////////////////////////////////////////////
// 2) Реализуйте ручной SSE-канал и POST-endpoint для JSON-RPC
////////////////////////////////////////////////////////////////////////////////

const app = express();
app.use(express.json());

// Хранилище активных SSE-ответов по sessionId
const sessions: Record<string, express.Response> = {};

// SSE endpoint: открывает EventStream и выдаёт sessionId
app.get('/mcp', (req, res) => {
  const sessionId = randomUUID();
  // Устанавливаем заголовки SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // обязательно

  // Сохраняем ответ, чтобы потом шлёть события
  sessions[sessionId] = res;

  // Сообщаем клиенту новый sessionId
  res.write(`event: session\n`);
  res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);

  // Чтобы соединение не закрылось (keep-alive)
  const interval = setInterval(() => res.write(':\n\n'), 15000);

  // При закрытии соединения — убираем из списка
  req.on('close', () => {
    clearInterval(interval);
    delete sessions[sessionId];
  });
});

// POST endpoint: тут n8n шлёт JSON-RPC запросы (listTools или callTool)
app.post('/mcp', async (req, res) => {
  const sessionId = req.header('mcp-session-id');
  const sse = sessionId && sessions[sessionId];
  if (!sse) {
    return res.status(400).json({ error: 'Invalid or missing mcp-session-id' });
  }

  const body = req.body;
  let response: Response;

  // Парсим и обрабатываем запрос
  try {
    if (ListToolsRequestSchema.safeParse(body).success) {
      response = await listToolsHandler();
    } else {
      const callReq = CallToolRequestSchema.parse(body) as CallToolRequest;
      response = await callToolHandler(callReq);
    }
  } catch (err) {
    response = {
      jsonrpc: '2.0',
      id: body.id ?? null,
      error: { code: -32603, message: (err as Error).message },
    };
  }

  // Шлём клиенту в SSE-поток
  sse.write(`event: message\n`);
  sse.write(`data: ${JSON.stringify(response)}\n\n`);

  // Ничего не возвращаем в теле POST
  res.status(204).end();
});

// Для проверки здоровья
app.get('/health', (_req, res) => res.send('OK'));

// Запуск на порту Render'а
const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ MCP SSE server listening on port ${port}`);
});
