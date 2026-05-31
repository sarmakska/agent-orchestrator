/**
 * Graph registry bootstrap.
 *
 * Importing this module registers the built-in tools and the example graphs so
 * the API can start runs against them by name. Add your own graphs here, or
 * import them from a separate package and register them in one place.
 */
import '../tools/builtin.js'
import { register } from '../graph/executor.js'
import { research } from '../../examples/research-swarm/graph.js'
import { triage } from '../../examples/triage/graph.js'

register(research)
register(triage)

export { research, triage }
