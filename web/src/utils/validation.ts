import { z } from 'zod';

export const portIdSchema = z.string().min(1);

export const graphDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
        label: z.string().optional(),
        data: z
          .object({
            overrides: z.record(z.string(), z.unknown()).optional(),
            controls: z.record(z.string(), z.unknown()).optional(),
          })
          .optional(),
      })
    )
    .default([]),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.object({ nodeId: z.string(), portId: portIdSchema }),
        target: z.object({ nodeId: z.string(), portId: portIdSchema }),
      })
    )
    .default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ParsedGraphDocument = z.infer<typeof graphDocumentSchema>;
