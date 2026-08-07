import { z } from 'zod';

/** OSM import tracking — ids are unique per element type. */
export const OsmSourceSchema = z.object({
  osm_type: z.enum(['node', 'way', 'relation']),
  osm_id: z.number().int(),
});
