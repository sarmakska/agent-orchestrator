import { graph } from '../../src/graph/definition.js'

/**
 * Research swarm.
 *
 * A supervisor plans, a pipeline gathers with the web_search tool, a swarm
 * analyses in parallel, and a pipeline summarises. Per-tool caps stop a runaway
 * search loop without throttling the whole run.
 */
export const research = graph('research-swarm')
  .node('plan', { agent: 'supervisor', llm: 'sarmalink' })
  .node('search', { agent: 'pipeline', tools: ['web_search'] })
  .node('analyse', { agent: 'swarm', llm: 'sarmalink', concurrency: 3 })
  .node('summarise', { agent: 'pipeline', llm: 'sarmalink' })
  .edge('plan', 'search')
  .edge('search', 'analyse')
  .edge('analyse', 'summarise')
  .budget({ tokens: 50000, tools: 100, wallClockSec: 300, perTool: { web_search: 20 } })
