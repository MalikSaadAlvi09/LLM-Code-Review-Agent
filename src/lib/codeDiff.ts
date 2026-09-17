export interface DiffLine {
  type: 'add' | 'delete' | 'equal';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export function computeLineDiff(original: string, refactored: string): DiffLine[] {
  const origLines = original.split('\n');
  const refLines = refactored.split('\n');
  const diffs: DiffLine[] = [];

  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;

  // Simple and fast Myers/LCS diff approximation for line arrays
  while (i < origLines.length || j < refLines.length) {
    if (i < origLines.length && j < refLines.length && origLines[i] === refLines[j]) {
      diffs.push({
        type: 'equal',
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: origLines[i],
      });
      i++;
      j++;
    } else {
      // Look ahead in refLines to see if origLines[i] was found later (addition)
      const lookAheadJ = refLines.indexOf(origLines[i], j);
      const lookAheadI = origLines.indexOf(refLines[j], i);

      if (lookAheadJ !== -1 && (lookAheadI === -1 || lookAheadJ - j <= lookAheadI - i)) {
        while (j < lookAheadJ) {
          diffs.push({
            type: 'add',
            newLineNumber: newLine++,
            content: refLines[j],
          });
          j++;
        }
      } else if (lookAheadI !== -1) {
        while (i < lookAheadI) {
          diffs.push({
            type: 'delete',
            oldLineNumber: oldLine++,
            content: origLines[i],
          });
          i++;
        }
      } else {
        if (i < origLines.length) {
          diffs.push({
            type: 'delete',
            oldLineNumber: oldLine++,
            content: origLines[i],
          });
          i++;
        }
        if (j < refLines.length) {
          diffs.push({
            type: 'add',
            newLineNumber: newLine++,
            content: refLines[j],
          });
          j++;
        }
      }
    }
  }

  return diffs;
}
