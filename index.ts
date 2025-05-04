import express from 'express';
import bodyParser from 'body-parser';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// --- MCP Server Setup ---
const server = new Server({ name: "travel-planner", version: "0.1.0" }, { capabilities: { tools: {} } });

const CreateItinerarySchema = z.object({
  origin: z.string(),
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().optional(),
  preferences: z.array(z.string()).optional(),
});

const OptimizeItinerarySchema = z.object({
  itineraryId: z.string(),
  optimizationCriteria: z.array(z.string()),
});

const SearchAttractionsSchema = z.object({
  location: z.string(),
  radius: z.number().optional(),
  categories: z.array(z.string()).optional(),
});

const GetTransportOptionsSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  date: z.string(),
});

const GetAccommodationsSchema = z.object({
  location: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  budget: z.number().optional(),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "create_itinerary", description: "Create a trip", inputSchema: zodToJsonSchema(CreateItinerarySchema) },
    { name: "optimize_itinerary", description: "Optimize trip", inputSchema: zodToJsonSchema(OptimizeItinerarySchema) },
    { name: "search_attractions", description: "Find places", inputSchema: zodToJsonSchema(SearchAttractionsSchema) },
    { name: "get_transport_options", description: "Transport", inputSchema: zodToJsonSchema(GetTransportOptionsSchema) },
    { name: "get_accommodations", description: "Hotels", inputSchema: zodToJsonSchema(GetAccommodationsSchema) },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "create_itinerary":
      const it = CreateItinerarySchema.parse(args);
      return { content: [{ type: "text", text: `Trip: ${it.origin} → ${it.destination}` }] };
    case "optimize_itinerary":
      const opt = OptimizeItinerarySchema.parse(args);
      return { content: [{ type: "text", text: `Optimized ${opt.itineraryId}` }] };
    default:
      return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
  }
});


// --- HTTP server ---
const app = express();
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  try {
    const result = await server.handleRequest(req.body);
    res.json(result);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/health', (_req, res) => res.status(200).send('OK'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Travel Planner MCP HTTP Server running on port ${port}`);
});
