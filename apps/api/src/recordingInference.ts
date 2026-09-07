import { createProvider, type Inference } from '@guaca/agents';
import { parseEnv } from 'node:util';

const disabled = async (): Promise<never> => { throw new Error('Live inference is disabled in the isolated rehearsal API.'); };

/** Only text inference credentials cross into the recording runtime. */
export function createRecordingInference(
  database: string,
  env: NodeJS.ProcessEnv,
  configText = '',
  factory = createProvider,
): Inference {
  if (env.NODE_ENV === 'production' || !/^guaca_recording(?:_[a-z0-9]+)*$/.test(database)) {
    throw new Error('Recording inference requires an isolated recording database outside production.');
  }
  if (env.RECORDING_AI_ENABLED !== 'true') return { json: disabled, vision: disabled };
  const file = parseEnv(configText);
  const value = (key: string) => env[key] ?? file[key];
  const baseUrl = value('INFERENCE_BASE_URL');
  const apiKey = value('INFERENCE_API_KEY');
  const model = value('INFERENCE_MODEL');
  if (!baseUrl || !apiKey || !model) throw new Error('Recording AI requires INFERENCE_BASE_URL, INFERENCE_API_KEY and INFERENCE_MODEL.');
  const inner = factory({
    INFERENCE_BASE_URL: baseUrl,
    INFERENCE_API_KEY: apiKey,
    INFERENCE_MODEL: model,
    INFERENCE_TIMEOUT_MS: value('INFERENCE_TIMEOUT_MS') ?? '30000',
    INFERENCE_MAX_RETRIES: value('INFERENCE_MAX_RETRIES') ?? '1',
  });
  return { json: (request) => inner.json(request), vision: disabled };
}
