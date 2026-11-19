import path from 'node:path';
import { saveInstallationSource } from '../tracking/node.ts';
import { createAppTracking, closeTracking, trackingLocked, trackingPreference } from './tracking.ts';

export async function recordInstallation(directory: string, host: string, source?: string): Promise<void> {
  if (trackingLocked() || !trackingPreference(directory)) return;
  await saveInstallationSource(path.join(directory, 'tracking'), source);
  const tracking = await createAppTracking(directory, 'installer');
  const hostProduct = ['codex', 'claude', 'deepseek', 'workbuddy'].includes(host) ? host : 'other';
  tracking.track('installation_result', { outcome: 'success', host_product: hostProduct });
  await closeTracking(tracking);
}
