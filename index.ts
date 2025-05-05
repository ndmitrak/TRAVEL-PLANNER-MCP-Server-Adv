#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// --- 1. Определяем схемы инструментов (копируем из оригинала) ---
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

const SearchAttractionsSchema = z.object({
  location: z.string().describe("Location to search attractions"),
  radius: z.number().optional().describe("Search radius in meters"),
  categories: z.array(z.string()).optional().describe("Categories of attractions"),
});

const GetTransportOptionsSchema = z.object({
  origin: z.string().describe("Starting point"),
  destination: z.string().describe("Destination point"),
  date: z.string().describe("Travel date (YYYY-MM-DD)"),
});

const GetAccommodationsSchema = z.object({
  location: z.string().describe("Location to search"),
  checkIn: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkOut: z.string().describe("Check-out date (YYYY-MM-DD)"),
  budget: z.number().optional().describe("Maximum price per night"),
});

// --- 2. Инициализируем MCP-сервер из SDK ---
const server = new Server(
  { name: "travel-planner", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// --- 3. Регистрируем ListTools и CallTool хендлеры (оригинальная логика) ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "create_itinerary", description: "Creates a personalized travel itinerary based on user preferences", inputSchema: zodToJsonSchema(CreateItinerarySchema) },
    { name: "optimize_itinerary", description: "Optimizes an existing itinerary based on specified criteria", inputSchema: zodToJsonSchema(OptimizeItinerarySchema) },
    { name: "search_attractions", description: "Searches for attractions and points of interest in a specified location", inputSchema: zodToJsonSchema(SearchAttractionsSchema) },
    { name: "get_transport_options", description: "Retrieves available transportation options between two points", inputSchema: zodToJsonSchema(GetTransportOptionsSchema) },
    { name: "get_accommodations", description: "Searches for accommodation options in a specified location", inputSchema: zodToJsonSchema(GetAccommodationsSchema) },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "create_itinerary": {
        const it = CreateItinerarySchema.parse(args);
        // optional: use GoogleMapsClient or OpenAI for real itinerary logic
        return {
          content: [
            {
              type: "text",
              text: `Created itinerary from ${it.origin} to ${it.destination}\nDates: ${it.startDate} to ${it.endDate}\nBudget: ${it.budget || "Not specified"}\nPreferences: ${it.preferences?.join(", ") || "None"}`,
            },
          ],
        };
      }
      case "optimize_itinerary": {
        const it = OptimizeItinerarySchema.parse(args);
        return {
          content: [
            { type: "text", text: `Optimized itinerary ${it.itineraryId} based on: ${it.optimizationCriteria.join(", ")}` },
          ],
        };
      }
      case "search_attractions": {
        const it = SearchAttractionsSchema.parse(args);
        return {
          content: [
            { type: "text", text: `Found attractions near ${it.location}\nRadius: ${it.radius || 5000} meters\nCategories: ${it.categories?.join(", ") || "All"}` },
          ],
        };
      }
      case "get_transport_options": {
        const it = GetTransportOptionsSchema.parse(args);
        return {
          content: [
            { type: "text", text: `Transport options from ${it.origin} to ${it.destination}\nDate: ${it.date}` },
          ],
        };
      }
      case "get_accommodations": {
        const it = GetAccommodationsSchema.parse(args);
        return {
          content: [
            { type: "text", text: `Accommodation options in ${it.location}\nDates: ${it.checkIn} to ${it.checkOut}\nBudget: ${it.budget || "Not specified"} per night` },
          ],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return {
      content: [
        { type: "text", text: `Error: ${(e as Error).message}` },
      ],
      isError: true,
    };
  }
});

// --- 4. Запускаем через StdioServerTransport для полного MCP ---
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Travel Planner MCP Server running on stdio");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
