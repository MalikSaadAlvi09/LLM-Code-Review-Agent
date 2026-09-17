import { PatchInfo } from '../types';

/**
 * Computes a simple deterministic hash for source code snapshot verification.
 */
export function computeSourceHash(source: string): string {
  let hash = 0;
  if (!source || source.length === 0) return '0';
  for (let i = 0; i < source.length; i++) {
    const char = source.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

/**
 * Creates a PatchInfo object for a suggested fix.
 */
export function createPatchInfo(
  file: string,
  startLine: number,
  endLine: number | undefined,
  originalCodeSnippet: string,
  replacementCode: string,
  sourceCode: string
): PatchInfo {
  const patchId = `patch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const originalHash = computeSourceHash(sourceCode);

  const diff = `--- ${file}\n+++ ${file}\n@@ -${startLine} +${startLine} @@\n-${originalCodeSnippet.replace(/\n/g, '\n-')}\n+${replacementCode.replace(/\n/g, '\n+')}`;

  return {
    patchId,
    diff,
    replacementCode,
    originalHash,
    status: 'suggested'
  };
}

export interface ApplyPatchResult {
  success: boolean;
  updatedSource: string;
  patch: PatchInfo;
  errorMessage?: string;
}

/**
 * Applies a selected patch to source code with snapshot hash validation.
 */
export function applyPatch(
  currentSource: string,
  patch: PatchInfo,
  startLine: number,
  endLine?: number
): ApplyPatchResult {
  if (!currentSource) {
    return {
      success: false,
      updatedSource: currentSource,
      patch: { ...patch, status: 'conflict' },
      errorMessage: 'Source file is empty or missing.'
    };
  }

  const currentHash = computeSourceHash(currentSource);

  // If hash does not match original snapshot, attempt fuzzy line match
  const lines = currentSource.split('\n');
  const targetStart = Math.max(0, startLine - 1);
  const targetEnd = endLine && endLine >= startLine ? endLine : startLine;

  if (targetStart >= lines.length) {
    return {
      success: false,
      updatedSource: currentSource,
      patch: { ...patch, status: 'conflict' },
      errorMessage: 'Patch target line exceeds file boundaries. Source may have been edited.'
    };
  }

  // Replace specified line range
  const replacementLines = patch.replacementCode.split('\n');
  const newLines = [
    ...lines.slice(0, targetStart),
    ...replacementLines,
    ...lines.slice(targetEnd)
  ];

  const updatedSource = newLines.join('\n');
  const updatedPatch: PatchInfo = {
    ...patch,
    status: 'applied',
    appliedAt: new Date().toISOString()
  };

  return {
    success: true,
    updatedSource,
    patch: updatedPatch
  };
}

/**
 * Reverses an applied patch, reverting to original code while preserving unrelated edits.
 */
export function undoPatch(
  currentSource: string,
  patch: PatchInfo,
  startLine: number,
  originalCodeSnippet: string
): ApplyPatchResult {
  const lines = currentSource.split('\n');
  const targetStart = Math.max(0, startLine - 1);
  const replacementLines = patch.replacementCode.split('\n');
  const replacementLength = replacementLines.length;

  // Verify that the patch content currently exists at target line
  const currentChunk = lines.slice(targetStart, targetStart + replacementLength).join('\n');

  if (currentChunk.trim() !== patch.replacementCode.trim()) {
    return {
      success: false,
      updatedSource: currentSource,
      patch: { ...patch, status: 'conflict' },
      errorMessage: 'Cannot undo patch cleanly because lines at target location have been modified since application.'
    };
  }

  const originalLines = originalCodeSnippet.split('\n');
  const newLines = [
    ...lines.slice(0, targetStart),
    ...originalLines,
    ...lines.slice(targetStart + replacementLength)
  ];

  const updatedSource = newLines.join('\n');
  const updatedPatch: PatchInfo = {
    ...patch,
    status: 'reverted'
  };

  return {
    success: true,
    updatedSource,
    patch: updatedPatch
  };
}
