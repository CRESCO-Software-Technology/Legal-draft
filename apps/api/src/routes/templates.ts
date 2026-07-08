/**
 * Templates API — Phase 4.1
 *
 * CRUD for contract templates + generate/preview endpoints.
 * Templates are assembled by the template-engine into contract HTML.
 */
import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requirePermission } from '../middleware/permissions.js'
import {
  generateDocument,
  buildSampleVariables,
  type VariableMap,
} from '../lib/template-engine.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

const VariableDefSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Variable key must be snake_case'),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  required: z.boolean().default(false),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(), // for select type
})

const SectionSchema = z.object({
  title: z.string().min(1),
  sortOrder: z.number().int().default(0),
  content: z.string().default(''),
  conditionalLogic: z
    .object({
      field: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_empty', 'empty']),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    })
    .nullable()
    .optional(),
  clauseRefs: z.array(z.string()).default([]),
})

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2048).optional(),
  contractType: z.string().nullable().optional(),
  variables: z.array(VariableDefSchema).default([]),
  isPublished: z.boolean().default(false),
  sections: z.array(SectionSchema).default([]),
})

const UpdateTemplateSchema = CreateTemplateSchema.partial().omit({ sections: true })

const UpdateSectionSchema = SectionSchema.partial().extend({
  id: z.string().optional(), // existing section
})

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function templateRoutes(app: FastifyInstance) {
  // ── List templates ────────────────────────────────────────────────────────
  app.get('/', { preHandler: requirePermission('view', 'template') }, async (req, reply) => {
    const { orgId } = req.user
    const query = req.query as {
      contractType?: string
      published?: string
      q?: string
      limit?: string
      offset?: string
    }

    const where: any = {
      orgId,
      deletedAt: null,
      ...(query.contractType && { contractType: query.contractType }),
      ...(query.published !== undefined && { isPublished: query.published === 'true' }),
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
    }

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        include: { sections: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
        take: Number(query.limit ?? 50),
        skip: Number(query.offset ?? 0),
      }),
      prisma.template.count({ where }),
    ])

    return reply.send({ data: templates, total })
  })

  // ── Get single template ───────────────────────────────────────────────────
  app.get('/:id', { preHandler: requirePermission('view', 'template') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { orgId } = req.user

    const template = await prisma.template.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) return reply.status(404).send({ detail: 'Template not found' })
    return reply.send(template)
  })

  // ── Create template ───────────────────────────────────────────────────────
  app.post('/', { preHandler: requirePermission('create', 'template') }, async (req, reply) => {
    const { orgId, sub: userId } = req.user
    const body = CreateTemplateSchema.parse(req.body)
    const { sections, ...templateData } = body

    const template = await prisma.template.create({
      data: {
        orgId,
        createdById: userId,
        ...templateData,
        sections: {
          create: sections.map((s, i) => ({
            ...s,
            sortOrder: s.sortOrder ?? i,
            clauseRefs: s.clauseRefs,
            conditionalLogic: s.conditionalLogic ?? undefined,
          })),
        },
      },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    return reply.status(201).send(template)
  })

  // ── Update template metadata ──────────────────────────────────────────────
  app.patch('/:id', { preHandler: requirePermission('edit', 'template') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { orgId } = req.user
    const body = UpdateTemplateSchema.parse(req.body)

    const existing = await prisma.template.findFirst({ where: { id, orgId, deletedAt: null } })
    if (!existing) return reply.status(404).send({ detail: 'Template not found' })

    const template = await prisma.template.update({
      where: { id },
      data: { ...body, version: { increment: 1 } },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    return reply.send(template)
  })

  // ── Update sections (replace all) ────────────────────────────────────────
  app.put('/:id/sections', { preHandler: requirePermission('edit', 'template') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { orgId } = req.user
    const { sections } = req.body as { sections: z.infer<typeof SectionSchema>[] }

    const existing = await prisma.template.findFirst({ where: { id, orgId, deletedAt: null } })
    if (!existing) return reply.status(404).send({ detail: 'Template not found' })

    // Replace all sections in a transaction
    await prisma.$transaction([
      prisma.templateSection.deleteMany({ where: { templateId: id } }),
      prisma.templateSection.createMany({
        data: sections.map((s, i) => ({
          templateId: id,
          title: s.title,
          content: s.content ?? '',
          sortOrder: s.sortOrder ?? i,
          clauseRefs: s.clauseRefs ?? [],
          conditionalLogic: (s.conditionalLogic ?? null) as Prisma.InputJsonValue,
        })) as Prisma.TemplateSectionCreateManyInput[],
      }),
      prisma.template.update({ where: { id }, data: { version: { increment: 1 } } }),
    ])

    const updated = await prisma.template.findFirst({
      where: { id },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    return reply.send(updated)
  })

  // ── Delete template (soft) ────────────────────────────────────────────────
  app.delete('/:id', { preHandler: requirePermission('delete', 'template') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { orgId } = req.user

    const existing = await prisma.template.findFirst({ where: { id, orgId, deletedAt: null } })
    if (!existing) return reply.status(404).send({ detail: 'Template not found' })

    await prisma.template.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })

  // ── Generate contract HTML from template + variable values ────────────────
  app.post('/:id/generate', { preHandler: requirePermission('view', 'template') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { orgId } = req.user
    const { variables = {} } = req.body as { variables?: VariableMap }

    const template = await prisma.template.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) return reply.status(404).send({ detail: 'Template not found' })

    // Fetch any clause library items referenced by sections
    const allClauseRefs = template.sections.flatMap(s =>
      Array.isArray(s.clauseRefs) ? (s.clauseRefs as string[]) : [],
    )
    const clauseItems = allClauseRefs.length
      ? await prisma.clauseLibraryItem.findMany({
          where: { id: { in: allClauseRefs }, orgId, deletedAt: null },
        })
      : []

    const clauseMap = new Map(clauseItems.map(c => [c.id, c]))

    const result = generateDocument({ template, variables, clauseMap })

    // Increment usage count
    await prisma.template.update({ where: { id }, data: { usageCount: { increment: 1 } } })

    return reply.send(result)
  })

  // ── Preview template with sample data ────────────────────────────────────
  app.post('/:id/preview', { preHandler: requirePermission('view', 'template') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { orgId } = req.user
    const { variables: overrides = {} } = (req.body as { variables?: VariableMap }) ?? {}

    const template = await prisma.template.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) return reply.status(404).send({ detail: 'Template not found' })

    const variableDefs = Array.isArray(template.variables)
      ? (template.variables as Array<{ key: string; type: string; defaultValue?: string }>)
      : []

    const sampleVars = { ...buildSampleVariables(variableDefs), ...overrides }

    const allClauseRefs = template.sections.flatMap(s =>
      Array.isArray(s.clauseRefs) ? (s.clauseRefs as string[]) : [],
    )
    const clauseItems = allClauseRefs.length
      ? await prisma.clauseLibraryItem.findMany({
          where: { id: { in: allClauseRefs }, orgId, deletedAt: null },
        })
      : []

    const clauseMap = new Map(clauseItems.map(c => [c.id, c]))
    const result = generateDocument({ template, variables: sampleVars, clauseMap })

    return reply.send({ ...result, isSample: true })
  })
}
