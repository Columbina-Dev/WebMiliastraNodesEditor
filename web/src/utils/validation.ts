import { z } from 'zod';

export const portIdSchema = z.string().min(1);

const graphCommentSchema = z
  .object({
    id: z.string().optional(),
    nodeId: z.string().min(1).optional(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .optional(),
    text: z.string().optional(),
    pinned: z.boolean().optional(),
    collapsed: z.boolean().optional(),
  })
  .refine((value) => Boolean((value.nodeId && value.nodeId.trim().length) || value.position), {
    message: '注释缺少关联节点或坐标',
  });

export const graphDocumentSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
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
      }),
    )
    .default([]),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.object({ nodeId: z.string(), portId: portIdSchema }),
        target: z.object({ nodeId: z.string(), portId: portIdSchema }),
      }),
    )
    .default([]),
  comments: z.array(graphCommentSchema).optional().default([]),
});

export type ParsedGraphDocument = z.infer<typeof graphDocumentSchema>;
