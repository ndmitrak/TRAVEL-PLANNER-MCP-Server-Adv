import express from 'express';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const app = express();
app.use(express.json());

// ————— SCHEMAS —————

const CreateItinerarySchema = z.object({
  origin: z.string().describe('Starting location'),
  destination: z.string().describe('Destination location'),
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
  budget: z.number().optional().describe('Budget in USD'),
  preferences: z.array(z.string()).optional().describe('Travel preferences'),
});

const OptimizeItinerarySchema = z.object({
  itineraryId: z.string().describe('ID of the itinerary to optimize'),
  optimizationCriteria: z.array(z.string()).describe('Criteria for optimization (time, cost, etc.)'),
});

const SearchAttractionsSchema = z.object({
  location: z.string().describe('Location to search attractions'),
  radius: z.number().optional().describe('Search radius in meters'),
  categories: z.array(z.string()).optional().describe('Categories of attractions'),
});

const GetTransportOptionsSchema = z.object({
  origin: z.string().describe('Starting point'),
  destination: z.string().describe('Destination point'),
  date: z.string().describe('Travel date (YYYY-MM-DD)'),
});

const GetAccommodationsSchema = z.object({
  location: z.string().describe('Location to search'),
  checkIn: z.string().describe('Check-in date (YYYY-MM-DD)'),
  checkOut: z.string().describe('Check-out date (YYYY-MM-DD)'),
  budget: z.number().optional().describe('Maximum price per night'),
});

// ————— ROUTES —————

// Здоровье сервиса
app.get('/health', (_req, res) => res.send('OK'));

// Список доступных инструментов
app.get('/tools', (_req, res) => {
  res.json([
    {
      name: 'create_itinerary',
      description: 'Creates a personalized travel itinerary based on user preferences',
      inputSchema: zodToJsonSchema(CreateItinerarySchema),
    },
    {
      name: 'optimize_itinerary',
      description: 'Optimizes an existing itinerary based on specified criteria',
      inputSchema: zodToJsonSchema(OptimizeItinerarySchema),
    },
    {
      name: 'search_attractions',
      description: 'Searches for attractions and points of interest in a specified location',
      inputSchema: zodToJsonSchema(SearchAttractionsSchema),
    },
    {
      name: 'get_transport_options',
      description: 'Retrieves available transportation options between two points',
      inputSchema: zodToJsonSchema(GetTransportOptionsSchema),
    },
    {
      name: 'get_accommodations',
      description: 'Searches for accommodation options in a specified location',
      inputSchema: zodToJsonSchema(GetAccommodationsSchema),
    },
  ]);
});

// Создать маршрут
app.post('/create_itinerary', (req, res) => {
  try {
    const args = CreateItinerarySchema.parse(req.body);
    return res.json({
      text:
        `Created itinerary from ${args.origin} to ${args.destination}\n` +
        `Dates: ${args.startDate} – ${args.endDate}\n` +
        `Budget: ${args.budget ?? 'Not specified'}\n` +
        `Preferences: ${args.preferences?.join(', ') || 'None'}`,
    });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Оптимизировать маршрут
app.post('/optimize_itinerary', (req, res) => {
  try {
    const args = OptimizeItinerarySchema.parse(req.body);
    return res.json({
      text: `Optimized itinerary ${args.itineraryId} based on: ${args.optimizationCriteria.join(', ')}`,
    });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Поиск достопримечательностей
app.post('/search_attractions', (req, res) => {
  try {
    const args = SearchAttractionsSchema.parse(req.body);
    return res.json({
      text: `Found attractions near ${args.location} (radius ${args.radius ?? 5000} m, categories: ${args.categories?.join(', ') || 'all'})`,
    });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Транспорт
app.post('/get_transport_options', (req, res) => {
  try {
    const args = GetTransportOptionsSchema.parse(req.body);
    return res.json({
      text: `Transport options from ${args.origin} to ${args.destination} on ${args.date}`,
    });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Проживание
app.post('/get_accommodations', (req, res) => {
  try {
    const args = GetAccommodationsSchema.parse(req.body);
    return res.json({
      text: `Accommodation options in ${args.location} from ${args.checkIn} to ${args.checkOut}, budget: ${args.budget ?? 'any'}`,
    });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Запуск сервера на порту из env и всех интерфейсах
const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Travel Planner API listening on port ${port}`);
});
