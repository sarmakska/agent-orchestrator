import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { graph, GraphValidationError } from '../src/graph/definition.js'
import { clearGraphs, register } from '../src/graph/executor.js'

// Structural validation guards the executor's core assumption: a graph is a
// finite DAG with at least one entry node. Each case below is a defect that
// would otherwise yield a silently wrong or never-terminating run.

beforeEach(() => clearGraphs())
afterEach(() => clearGraphs())

describe('graph validation', () => {
  it('accepts a well-formed acyclic graph', () => {
    const g = graph('ok')
      .node('a', { agent: 'supervisor', llm: 'sarmalink' })
      .node('b', { agent: 'pipeline' })
      .node('c', { agent: 'pipeline' })
      .edge('a', 'b')
      .edge('a', 'c')
    expect(g.problems()).toEqual([])
    expect(() => g.validate()).not.toThrow()
    expect(() => register(g)).not.toThrow()
  })

  it('rejects an empty graph', () => {
    expect(graph('empty').problems()).toContain('graph has no nodes')
  })

  it('rejects an edge that names an unknown source node', () => {
    const g = graph('dangling-from').node('a', { agent: 'pipeline' }).edge('ghost', 'a')
    expect(g.problems()).toContain('edge ghost -> a starts at unknown node "ghost"')
  })

  it('rejects an edge that names an unknown target node', () => {
    const g = graph('dangling-to').node('a', { agent: 'pipeline' }).edge('a', 'ghost')
    expect(g.problems()).toContain('edge a -> ghost ends at unknown node "ghost"')
  })

  it('rejects a duplicate edge between the same ordered pair', () => {
    const g = graph('dupe')
      .node('a', { agent: 'pipeline' })
      .node('b', { agent: 'pipeline' })
      .edge('a', 'b')
      .edge('a', 'b')
    expect(g.problems()).toContain('duplicate edge a -> b')
  })

  it('detects a two-node cycle and reports no entry node', () => {
    const g = graph('cycle2')
      .node('a', { agent: 'pipeline' })
      .node('b', { agent: 'pipeline' })
      .edge('a', 'b')
      .edge('b', 'a')
    const problems = g.problems()
    expect(problems).toContain('graph has no entry node (every node has an incoming edge)')
    expect(problems.some((p) => p.startsWith('cycle detected:'))).toBe(true)
  })

  it('detects a back-edge cycle that still has a valid entry node', () => {
    const g = graph('cycle3')
      .node('a', { agent: 'pipeline' })
      .node('b', { agent: 'pipeline' })
      .node('c', { agent: 'pipeline' })
      .edge('a', 'b')
      .edge('b', 'c')
      .edge('c', 'b') // back edge: b -> c -> b
    const problems = g.problems()
    expect(problems.some((p) => p === 'cycle detected: b -> c -> b')).toBe(true)
  })

  it('flags a node that is unreachable from any entry', () => {
    const g = graph('orphan')
      .node('a', { agent: 'pipeline' })
      .node('island', { agent: 'pipeline' })
      .node('also-island', { agent: 'pipeline' })
      .edge('island', 'also-island')
      .edge('also-island', 'island') // the island pair forms its own cycle
    const problems = g.problems()
    expect(problems).toContain('node "island" is unreachable from any entry node')
    expect(problems).toContain('node "also-island" is unreachable from any entry node')
  })

  it('throws GraphValidationError carrying every problem when registering', () => {
    const g = graph('bad')
      .node('a', { agent: 'pipeline' })
      .node('b', { agent: 'pipeline' })
      .edge('a', 'b')
      .edge('b', 'a')
      .edge('a', 'ghost')
    let caught: unknown
    try {
      register(g)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GraphValidationError)
    const err = caught as GraphValidationError
    expect(err.problems.length).toBeGreaterThan(1)
    expect(err.message).toContain('Graph bad is invalid')
  })
})
