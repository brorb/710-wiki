import { z } from "zod"

export const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
})

export const oracleRequestSchema = z.object({
  conversationId: z.string().max(128).nullable().optional(),
  question: z.string().min(1).max(4000),
  messages: z.array(messageSchema).max(48),
  metadata: z.record(z.string(), z.unknown()).default({}),
  priority: z.enum(["low", "medium", "high"]).optional(),
  sections: z.number().int().min(1).max(12).optional(),
  creativeMode: z.boolean().optional(),
  captchaToken: z.string().min(1).optional(),
  channel: z.string().max(64).optional(),
})

export type OracleRequest = z.infer<typeof oracleRequestSchema>
