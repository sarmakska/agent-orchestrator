import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/state/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://orchestrator:devpassword@localhost:5432/orchestrator',
  },
})
