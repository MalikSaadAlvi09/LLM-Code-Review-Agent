import React, { useState } from 'react';
import { FileText, Copy, Check, Download, AlertTriangle, Bug, CheckCircle2, ShieldAlert } from 'lucide-react';

const SAMPLE_MARKDOWN = `# Code Review Report

- **Repository:** \`https://github.com/example-org/payment-service\`
- **Date:** 2026-08-16 02:20:00
- **Review Model:** \`claude-3-5-sonnet-20241022\`
- **Files Analyzed:** 5
- **Total Findings:** 6 (2 bugs, 2 logic errors, 2 style issues)

---

## Executive Summary

| Metric | Count |
|---|---|
| Total Files Checked | 5 |
| Critical Bugs | 2 |
| Logic Errors | 2 |
| Style & Maintainability | 2 |

## Detailed File Findings

### \`services/payment_gateway.py\` — [CRITICAL (2 bugs)]

*Core transaction processing module. Contains critical resource leaks and potential null reference exceptions during payment webhook dispatch.*

#### Line 58 — [BUG] Unhandled NoneType on Customer Metadata
**Description:** \`customer.get("metadata")["stripe_id"]\` assumes the \`"metadata"\` key exists and is non-None. If metadata is missing or null in the payload, this triggers a \`TypeError: 'NoneType' object is not subscriptable\` at runtime during live charge creation.

**Suggested Fix:**
\`\`\`python
metadata = customer.get("metadata") or {}
stripe_id = metadata.get("stripe_id")
if not stripe_id:
    raise ValueError(f"Missing stripe_id for customer {customer.get('id')}")
\`\`\`

#### Line 114 — [BUG] Unclosed HTTPS Connection in Webhook Retry Loop
**Description:** In the retry handler for failed webhook dispatches, \`urllib3.PoolManager\` creates new connection pools on every failed attempt without invoking \`.clear()\` or closing existing sessions, leaking socket file descriptors under high burst traffic.

**Suggested Fix:**
\`\`\`python
with urllib3.PoolManager() as http:
    response = http.request("POST", webhook_url, json=payload, timeout=5.0)
\`\`\`

---

### \`workers/reconciliation.py\` — [WARNING (2 logic)]

*Batch settlement reconciliation task.*

#### Line 32 — [LOGIC] Floating-point Rounding in Currency Aggregation
**Description:** The accumulator \`total_amount += transaction.amount\` uses standard IEEE-754 binary floats (\`float\`) instead of \`decimal.Decimal\` or integer cents. Repeated addition across large ledger sweeps introduces precision drift (e.g. \`$0.01\` discrepancy over thousands of transactions).

**Suggested Fix:**
\`\`\`python
from decimal import Decimal

total_amount = Decimal("0.00")
for tx in transactions:
    total_amount += Decimal(str(tx.amount))
\`\`\`

#### Line 87 — [LOGIC] Race Condition in Status Check-and-Set
**Description:** The query \`if not ledger_entry.is_settled: ledger_entry.mark_settled()\` does not use atomic row-level locking (\`SELECT ... FOR UPDATE\`), creating a race condition if two reconciliation workers execute concurrently on identical batch partitions.

**Suggested Fix:**
\`\`\`python
with db.transaction():
    entry = db.query(LedgerEntry).filter_by(id=entry_id).with_for_update().first()
    if entry and not entry.is_settled:
        entry.is_settled = True
\`\`\`

---

### \`models/account.py\` — [NOTICE (2 style)]

*Data schemas and entity definitions.*

#### Line 14 — [STYLE] Explicit Comparison to Boolean Literal
**Description:** Comparison \`if is_active == True:\` violates PEP 8. Use standard truth value testing \`if is_active:\` or \`if not is_active:\`.

**Suggested Fix:**
\`\`\`python
if is_active:
    return self.generate_token()
\`\`\`

#### Line 45 — [STYLE] Mutable Default Argument in Function Definition
**Description:** Default parameter \`allowed_scopes: list = []\` binds a mutable list instance once at module definition time. Any in-place mutations (\`allowed_scopes.append(...)\`) will bleed across unrelated caller invocations.

**Suggested Fix:**
\`\`\`python
def create_account(username: str, allowed_scopes: Optional[List[str]] = None) -> Account:
    if allowed_scopes is None:
        allowed_scopes = []
\`\`\`
`;

export function ReportViewer() {
  const [copied, setCopied] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_MARKDOWN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([SAMPLE_MARKDOWN], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code_review_report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium">Files Checked</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">5</p>
          <span className="text-[11px] text-neutral-400">100% Python AST clean</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 font-medium">Critical Bugs</p>
            <Bug className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">2</p>
          <span className="text-[11px] text-red-600/80">Null deref & Socket leak</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 font-medium">Logic Errors</p>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">2</p>
          <span className="text-[11px] text-amber-600/80">Float drift & Race condition</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 font-medium">Style / PEP 8</p>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">2</p>
          <span className="text-[11px] text-blue-600/80">Mutable defaults & Bool syntax</span>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        {/* Header Actions */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-800" />
            <h3 className="text-sm font-semibold text-neutral-900">Rendered Markdown Report</h3>
            <span className="text-xs font-mono text-neutral-400 bg-neutral-200/60 px-2 py-0.5 rounded">
              code_review_report.md
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-medium transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>
          </div>
        </div>

        {/* Structured Report Preview */}
        <div className="p-6 md:p-8 space-y-6 font-sans text-neutral-800 max-w-4xl mx-auto">
          {/* Metadata Block */}
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-1.5 text-xs text-neutral-600">
            <p><span className="font-semibold text-neutral-800">Repository:</span> https://github.com/example-org/payment-service</p>
            <p><span className="font-semibold text-neutral-800">Review Model:</span> claude-3-5-sonnet-20241022</p>
            <p><span className="font-semibold text-neutral-800">Total Findings:</span> 6 (2 critical bugs, 2 logic errors, 2 style issues)</p>
          </div>

          {/* Detailed File Sections */}
          <div className="space-y-6">
            {/* File 1: Payment Gateway */}
            <div className="border border-neutral-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="font-mono text-sm font-bold text-neutral-900">services/payment_gateway.py</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  CRITICAL (2 bugs)
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-red-50/40 border border-red-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800">Line 58 — [BUG] Unhandled NoneType on Customer Metadata</span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    <code className="bg-red-100/70 px-1 py-0.5 rounded text-red-900">customer.get("metadata")["stripe_id"]</code> assumes metadata is always present. Triggers <code className="bg-red-100/70 px-1 py-0.5 rounded text-red-900">TypeError: 'NoneType' object is not subscriptable</code> if missing.
                  </p>
                  <div className="bg-neutral-900 text-neutral-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-emerald-400">{`metadata = customer.get("metadata") or {}
stripe_id = metadata.get("stripe_id")
if not stripe_id:
    raise ValueError(f"Missing stripe_id for customer {customer.get('id')}")`}</pre>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-red-50/40 border border-red-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800">Line 114 — [BUG] Unclosed HTTPS Connection in Webhook Retry Loop</span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    In the retry handler for failed dispatches, <code className="bg-red-100/70 px-1 py-0.5 rounded text-red-900">urllib3.PoolManager</code> is initialized inside the loop without closing, leaking sockets.
                  </p>
                  <div className="bg-neutral-900 text-neutral-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-emerald-400">{`with urllib3.PoolManager() as http:
    response = http.request("POST", webhook_url, json=payload, timeout=5.0)`}</pre>
                  </div>
                </div>
              </div>
            </div>

            {/* File 2: Reconciliation */}
            <div className="border border-neutral-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="font-mono text-sm font-bold text-neutral-900">workers/reconciliation.py</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  WARNING (2 logic)
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-100 space-y-2">
                  <span className="text-xs font-bold text-amber-900">Line 32 — [LOGIC] Floating-point Rounding in Currency Aggregation</span>
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    Binary float additions accumulate floating-point representation drift across thousands of ledger entries.
                  </p>
                  <div className="bg-neutral-900 text-neutral-200 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre className="text-emerald-400">{`from decimal import Decimal

total_amount = Decimal("0.00")
for tx in transactions:
    total_amount += Decimal(str(tx.amount))`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
