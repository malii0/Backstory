import { LogMetadata } from './types';

export function getEffectiveWatchCount(log?: LogMetadata): number {
  if (!log) return 0;
  if (log.watchCount !== undefined && log.watchCount > 0) {
    return log.watchCount;
  }
  return log.isCompleted ? 1 : 0;
}

export function getRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay === 1) return 'Dün';
  if (diffDay < 7) return `${diffDay} gün önce`;

  return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}