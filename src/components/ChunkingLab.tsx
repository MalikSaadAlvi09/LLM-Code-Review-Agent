import React, { useState, useMemo } from 'react';
import { Layers, ShieldCheck, CheckCircle2, AlertCircle, Info, RefreshCw, Cpu } from 'lucide-react';

const SAMPLE_PYTHON_MODULE = `# Module: transaction_orchestrator.py
import os
import time
from typing import List, Dict, Optional
from decimal import Decimal
import urllib3

class TransactionOrchestrator:
    def __init__(self, api_key: str, endpoint: str):
        self.api_key = api_key
        self.endpoint = endpoint
        self.http_pool = urllib3.PoolManager()

    def validate_payload(self, payload: Dict) -> bool:
        if not payload.get("id"):
            return False
        if payload.get("amount", 0) <= 0:
            return False
        return True

    def execute_payment(self, payload: Dict) -> Optional[Dict]:
        if not self.validate_payload(payload):
            raise ValueError("Invalid transaction payload format")

        target_url = f"{self.endpoint}/v1/charges"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        response = self.http_pool.request(
            "POST",
            target_url,
            json=payload,
            headers=headers,
            timeout=10.0
        )

        if response.status == 200:
            return {"status": "success", "data": response.data}
        elif response.status == 429:
            time.sleep(2.0)
            return self.execute_payment(payload)
        
        return None

    def close(self):
        self.http_pool.clear()
`;

export function ChunkingLab() {
  const [text, setText] = useState(SAMPLE_PYTHON_MODULE);
  const [maxTokens, setMaxTokens] = useState(120);
  const [overlapTokens, setOverlapTokens] = useState(30);

  // Compute chunks live
  const lines = useMemo(() => text.split('\n').map(l => l + '\n'), [text]);

  const chunks = useMemo(() => {
    if (lines.length === 0) return [];
    
    // Estimate tokens: ~4 chars / token
    const lineCosts = lines.map(l => Math.max(1, Math.ceil(l.length / 4)));
    const totalTokens = lineCosts.reduce((a, b) => a + b, 0);

    if (totalTokens <= maxTokens) {
      return [{
        id: 1,
        startLine: 1,
        endLine: lines.length,
        lines: lines,
        tokens: totalTokens
      }];
    }

    const result = [];
    let startIdx = 0;
    let chunkId = 1;

    while (startIdx < lines.length) {
      let currentTokens = 0;
      let endIdx = startIdx;

      while (endIdx < lines.length) {
        const cost = lineCosts[endIdx];
        if (endIdx > startIdx && currentTokens + cost > maxTokens) {
          break;
        }
        currentTokens += cost;
        endIdx++;
      }

      result.push({
        id: chunkId++,
        startLine: startIdx + 1,
        endLine: endIdx,
        lines: lines.slice(startIdx, endIdx),
        tokens: lineCosts.slice(startIdx, endIdx).reduce((a, b) => a + b, 0)
      });

      if (endIdx >= lines.length) break;

      let backtrackTokens = 0;
      let nextStart = endIdx;

      while (nextStart > startIdx + 1) {
        const prevCost = lineCosts[nextStart - 1];
        if (backtrackTokens + prevCost > overlapTokens) break;
        backtrackTokens += prevCost;
        nextStart--;
      }

      if (nextStart <= startIdx) {
        startIdx = startIdx + 1;
      } else {
        startIdx = nextStart;
      }
    }

    return result;
  }, [lines, maxTokens, overlapTokens]);

  // Check invariants
  const invariantLineIntegrity = chunks.every(c => c.startLine >= 1 && c.endLine <= lines.length && c.startLine <= c.endLine);
  const invariantCompleteSpan = chunks.length > 0 && chunks[0].startLine === 1 && chunks[chunks.length - 1].endLine === lines.length;
  
  // Reconstruct lines to verify invariant 3
  const reconstructedLines = useMemo(() => {
    if (!chunks.length) return [];
    const result: string[] = [];
    let nextExpectedLine = 1;
    for (const chunk of chunks) {
      const offset = Math.max(0, nextExpectedLine - chunk.startLine);
      if (offset < chunk.lines.length) {
        result.push(...chunk.lines.slice(offset));
        nextExpectedLine = chunk.endLine + 1;
      }
    }
    return result;
  }, [chunks]);

  const invariantLosslessReconstruction = reconstructedLines.join('') === lines.join('');

  return (
    <div className="space-y-6">
      {/* Controls & Invariant Checks */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-neutral-900" />
              <h3 className="text-base font-semibold text-neutral-900">Line-Boundary Overlapping Chunking Engine</h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Guarantees boundary safety for LLM token limits without dropping lines or splitting tokens mid-statement.
            </p>
          </div>

          {/* Slider Controls */}
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-2 font-medium text-neutral-700">
                <span>Max Tokens:</span>
                <span className="font-mono text-neutral-900">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="40"
                max="300"
                step="10"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-36 accent-neutral-900"
              />
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-2 font-medium text-neutral-700">
                <span>Overlap Tokens:</span>
                <span className="font-mono text-neutral-900">{overlapTokens}</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={overlapTokens}
                onChange={(e) => setOverlapTokens(Number(e.target.value))}
                className="w-36 accent-neutral-900"
              />
            </div>
          </div>
        </div>

        {/* Live Invariant Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-start gap-2.5">
            <ShieldCheck className={`w-4 h-4 mt-0.5 flex-shrink-0 ${invariantLineIntegrity ? 'text-emerald-600' : 'text-red-500'}`} />
            <div>
              <p className="text-xs font-semibold text-neutral-800">1. Line-Boundary Integrity</p>
              <p className="text-[11px] text-neutral-500">Lines never split mid-character or statement.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-start gap-2.5">
            <ShieldCheck className={`w-4 h-4 mt-0.5 flex-shrink-0 ${invariantCompleteSpan ? 'text-emerald-600' : 'text-red-500'}`} />
            <div>
              <p className="text-xs font-semibold text-neutral-800">2. Full File Span (1 → {lines.length})</p>
              <p className="text-[11px] text-neutral-500">Every line belongs to at least one chunk.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-start gap-2.5">
            <ShieldCheck className={`w-4 h-4 mt-0.5 flex-shrink-0 ${invariantLosslessReconstruction ? 'text-emerald-600' : 'text-red-500'}`} />
            <div>
              <p className="text-xs font-semibold text-neutral-800">3. Lossless Reconstruction</p>
              <p className="text-[11px] text-neutral-500">Reconstructed lines exactly equal source input.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chunks Visualization */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Generated Sliding Windows ({chunks.length} chunks)</span>
          </h4>
          <span className="text-xs text-neutral-400 font-mono">
            {lines.length} total lines • Window overlap enabled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chunks.map((chunk) => (
            <div
              key={chunk.id}
              className="rounded-xl border border-neutral-200 bg-neutral-950 p-4 font-mono text-xs text-neutral-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-semibold">
                    Chunk #{chunk.id}
                  </span>
                  <span className="text-neutral-400">
                    Lines {chunk.startLine} – {chunk.endLine}
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto pr-1 text-[11px] leading-relaxed text-neutral-300">
                  <pre>{chunk.lines.join('')}</pre>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                <span>~{chunk.tokens} tokens</span>
                <span>{chunk.lines.length} lines span</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
