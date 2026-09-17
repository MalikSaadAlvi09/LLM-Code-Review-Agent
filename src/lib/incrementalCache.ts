import { Finding, ReviewResult } from '../types';
import { computeSourceHash } from './patchManager';

export interface CachedFileEntry {
  fileHash: string;
  configHash: string;
  timestamp: number;
  findings: Finding[];
}

class IncrementalReviewCache {
  private cache = new Map<string, CachedFileEntry>();

  private buildKey(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  public get(filePath: string, content: string, configHash: string): Finding[] | null {
    const key = this.buildKey(filePath);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const currentFileHash = computeSourceHash(content);
    if (entry.fileHash === currentFileHash && entry.configHash === configHash) {
      return entry.findings;
    }

    return null;
  }

  public set(filePath: string, content: string, configHash: string, findings: Finding[]): void {
    const key = this.buildKey(filePath);
    const fileHash = computeSourceHash(content);
    this.cache.set(key, {
      fileHash,
      configHash,
      timestamp: Date.now(),
      findings
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public getStats(): { cachedFiles: number } {
    return { cachedFiles: this.cache.size };
  }
}

export const reviewCache = new IncrementalReviewCache();
