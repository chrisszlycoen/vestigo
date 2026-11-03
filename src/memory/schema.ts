import { z } from 'zod';

export const MAX_RECORD_BYTES = 2400;
export const PORTABLE_CONTEXT_FILE = 'vestigo.context.json';

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const recordInputSchema = z.object({
    kind: z.enum(['work', 'decision', 'constraint', 'issue']).default('work'),
    summary: shortText(320),
    reason: shortText(400).optional(),
    files: z.array(shortText(240)).max(8).default([]),
    verification: z.object({
        status: z.enum(['not_run', 'passed', 'failed']),
        command: shortText(200).optional(),
        detail: shortText(240).optional(),
    }).strict().optional(),
    next: shortText(320).optional(),
    visibility: z.enum(['private', 'project']).default('private'),
    supersedes: z.string().regex(/^[a-f0-9]{24}$/).optional(),
}).strict();

export type RecordInput = z.input<typeof recordInputSchema>;
export type NormalizedRecordInput = z.output<typeof recordInputSchema>;

export const workMemorySchema = z.object({
    version: z.literal(1),
    id: z.string().regex(/^[a-f0-9]{24}$/),
    input: recordInputSchema,
    capturedAt: z.string().datetime(),
    revision: z.string().regex(/^[a-f0-9]{40,64}$/).nullable(),
    dirty: z.boolean().nullable(),
    evidence: z.array(z.object({
        path: shortText(240),
        sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    }).strict()).max(8),
}).strict();

export type WorkMemory = z.output<typeof workMemorySchema>;
export type EvidenceState = 'unchanged' | 'changed' | 'missing' | 'unavailable';

export interface MemoryView extends WorkMemory {
    evidenceState: EvidenceState;
    verificationSource: 'agent_reported';
}

export const portableContextSchema = z.object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    revision: z.string().regex(/^[a-f0-9]{40,64}$/).nullable(),
    memories: z.array(workMemorySchema).max(200),
}).strict();

// This is an explicitly labelled size heuristic, never a provider billing count.
export function estimateTokens(value: unknown): number {
    return Math.ceil(Buffer.byteLength(JSON.stringify(value), 'utf8') / 4);
}
