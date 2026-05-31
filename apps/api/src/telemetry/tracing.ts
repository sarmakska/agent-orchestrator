/**
 * OpenTelemetry tracing.
 *
 * Spans are emitted for every run, every node, every LLM call, and every tool
 * call. When OTEL_EXPORTER_OTLP_ENDPOINT is set the SDK exports over OTLP/HTTP;
 * otherwise spans are still created in-process (so the trace API works in tests
 * and the inspector trace view) but nothing is shipped off the box.
 */
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import { trace, type Tracer } from '@opentelemetry/api'

let started = false

export function startTelemetry(): void {
  if (started) return
  started = true
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) return
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'agent-orchestrator',
      [ATTR_SERVICE_VERSION]: '1.1.0',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  })
  sdk.start()
  const shutdown = () => {
    sdk.shutdown().finally(() => process.exit(0))
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

export function tracer(): Tracer {
  return trace.getTracer('agent-orchestrator')
}
