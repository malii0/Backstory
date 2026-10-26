import { LogMetadata } from './types';

export function getEffectiveWatchCount(log?: LogMetadata): number {
  if (!log) return 0;
  if (log.watchCount !== undefined && log.watchCount > 0) {
    return log.watchCount;
  }
  return log.isCompleted ? 1 : 0;
}