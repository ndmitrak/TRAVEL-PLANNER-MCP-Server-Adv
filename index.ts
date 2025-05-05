#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definitions
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

// Server implementation
const server = new Server(
  {
    name: "travel-planner",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_itinerary",
      description: "Creates a personalized travel itinerary based on user preferences",
      inputSchema: zodToJsonSchema(CreateItinerarySchema),
    },
    {
      name: "optimize_itinerary",
      description: "Optimizes an existing itinerary based on specified criteria",
      inputSchema: zodToJsonSchema(OptimizeItinerarySchema),
    },
    {
      name: "search_attractions",
      description: "Searches for attractions and points of interest in a specified location",
      inputSchema: zodToJsonSchema(SearchAttractionsSchema),
    },
    {
      name: "get_transport_options",
      description: "Retrieves available transportation options between two points",
      inputSchema: zodToJsonSchema(GetTransportOptionsSchema),
    },
    {
      name: "get_accommodations",
      description: "Searches for accommodation options in a specified location",
      inputSchema: zodToJsonSchema(GetAccommodationsSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_itinerary": {
        const validatedArgs = CreateItinerarySchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Created itinerary from ${validatedArgs.origin} to ${validatedArgs.destination}\n` +
                    `Dates: ${validatedArgs.startDate} to ${validatedArgs.endDate}\n` +
                    `Budget: ${validatedArgs.budget || "Not specified"}\n` +
                    `Preferences: ${validatedArgs.preferences?.join(", ") || "None specified"}`,
            },
          ],
        };
      }

      case "optimize_itinerary": {
        const validatedArgs = OptimizeItinerarySchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Optimized itinerary ${validatedArgs.itineraryId} based on: ${validatedArgs.optimizationCriteria.join(", ")}`,
            },
          ],
        };
      }

      case "search_attractions": {
        const validatedArgs = SearchAttractionsSchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Found attractions near ${validatedArgs.location}\n` +
                    `Radius: ${validatedArgs.radius || "5000"} meters\n` +
                    `Categories: ${validatedArgs.categories?.join(", ") || "All"}`,
            },
          ],
        };
      }

      case "get_transport_options": {
        const validatedArgs = GetTransportOptionsSchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Transport options from ${validatedArgs.origin} to ${validatedArgs.destination}\n` +
                    `Date: ${validatedArgs.date}`,
            },
          ],
        };
      }

      case "get_accommodations": {
        const validatedArgs = GetAccommodationsSchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Accommodation options in ${validatedArgs.location}\n` +
                    `Dates: ${validatedArgs.checkIn} to ${validatedArgs.checkOut}\n` +
                    `Budget: ${validatedArgs.budget || "Not specified"} per night`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Travel Planner MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
}); 
