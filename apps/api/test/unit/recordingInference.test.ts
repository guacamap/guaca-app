import { describe, expect, it, vi } from 'vitest';
import { createRecordingInference } from '../../src/recordingInference.js';

describe('recording text AI isolation', () => {
  const config = 'INFERENCE_BASE_URL=https://example.test/v1\nINFERENCE_API_KEY=test-key\nINFERENCE_MODEL=test-model\nDATABASE_URL=working-db\nINFERENCE_VISION_MODEL=vision';
  it('refuses working databases and production', () => {
    expect(() => createRecordingInference('guaca', {})).toThrow('isolated');
    expect(() => createRecordingInference('guaca_recording', { NODE_ENV: 'production' })).toThrow('isolated');
  });
  it('stays disabled without explicit opt-in', async () => {
    const factory = vi.fn();
    const inference = createRecordingInference('guaca_recording', {}, config, factory);
    await expect(inference.vision({} as never)).rejects.toThrow('disabled');
    await expect(inference.json({} as never)).rejects.toThrow('disabled');
    expect(factory).not.toHaveBeenCalled();
  });
  it('enables text only without importing other settings', async () => {
    const inner = { json: vi.fn().mockResolvedValue({ raw: 'hello' }), vision: vi.fn() };
    const factory = vi.fn().mockReturnValue(inner);
    const env = { RECORDING_AI_ENABLED: 'true', INFERENCE_MODEL: 'override' };
    const inference = createRecordingInference('guaca_recording_test', env, config, factory);
    expect(factory.mock.calls[0]?.[0]).toEqual({ INFERENCE_BASE_URL: 'https://example.test/v1', INFERENCE_API_KEY: 'test-key', INFERENCE_MODEL: 'override', INFERENCE_TIMEOUT_MS: '30000', INFERENCE_MAX_RETRIES: '1' });
    await expect(inference.json({} as never)).resolves.toEqual({ raw: 'hello' });
    await expect(inference.vision({} as never)).rejects.toThrow('disabled');
    expect(inner.vision).not.toHaveBeenCalled();
    expect(env).not.toHaveProperty('DATABASE_URL');
  });
  it('fails clearly when enabled without credentials', () => {
    expect(() => createRecordingInference('guaca_recording', { RECORDING_AI_ENABLED: 'true' })).toThrow('requires INFERENCE');
  });
});
