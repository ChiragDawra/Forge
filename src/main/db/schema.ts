import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull().default('pending'),
  techStack: text('tech_stack'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

export const phases = sqliteTable('phases', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  phaseName: text('phase_name').notNull(),
  status: text('status').notNull().default('pending'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' })
})

export const phaseLogs = sqliteTable('phase_logs', {
  id: text('id').primaryKey(),
  phaseId: text('phase_id')
    .notNull()
    .references(() => phases.id),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  level: text('level').notNull().default('info'),
  message: text('message').notNull()
})

export const modelUsage = sqliteTable(
  'model_usage',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => projects.id),
    phaseId: text('phase_id').references(() => phases.id),
    modelName: text('model_name').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costUsd: real('cost_usd').notNull().default(0),
    calledAt: integer('called_at', { mode: 'timestamp' }).notNull()
  },
  (t) => ({
    // Hot paths: ai:usage-daily (filter by calledAt, group by model_name)
    // and ai:usage-by-project (filter by project_id, order by calledAt).
    calledAtIdx: index('idx_model_usage_called_at').on(t.calledAt),
    projectCalledAtIdx: index('idx_model_usage_project_called_at').on(t.projectId, t.calledAt)
  })
)

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  summary: text('summary')
})
