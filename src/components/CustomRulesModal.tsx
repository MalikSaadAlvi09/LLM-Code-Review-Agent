import React, { useState } from 'react';
import { Sliders, Plus, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import { CustomRule, SeverityLevel } from '../types';
import { DEFAULT_CUSTOM_RULES } from '../lib/customRules';

interface CustomRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: CustomRule[];
  onSaveRules: (updatedRules: CustomRule[]) => void;
}

export function CustomRulesModal({
  isOpen,
  onClose,
  rules,
  onSaveRules
}: CustomRulesModalProps) {
  const [ruleList, setRuleList] = useState<CustomRule[]>(rules.length > 0 ? rules : DEFAULT_CUSTOM_RULES);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleSeverity, setNewRuleSeverity] = useState<SeverityLevel>('Medium');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  if (!isOpen) return null;

  const handleToggleRule = (id: string) => {
    setRuleList(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDeleteRule = (id: string) => {
    setRuleList(prev => prev.filter(r => r.id !== id));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim()) return;

    const newRule: CustomRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim(),
      category: 'Custom Standard',
      pattern: newRulePattern.trim(),
      severity: newRuleSeverity,
      description: newRuleDesc.trim() || 'Custom project review rule requirement.',
      enabled: true
    };

    setRuleList(prev => [...prev, newRule]);
    setNewRuleName('');
    setNewRulePattern('');
    setNewRuleDesc('');
  };

  const handleSave = () => {
    onSaveRules(ruleList);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-neutral-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">Custom Project Review Rules</h3>
              <p className="text-[11px] text-neutral-400">Enforce repository coding conventions, architectural boundaries & prohibited patterns</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Rules List */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[55vh] text-xs">
          <div className="space-y-3">
            <h4 className="font-bold text-neutral-800 uppercase tracking-wider text-[11px]">Active Rules ({ruleList.filter(r => r.enabled).length}/{ruleList.length})</h4>
            {ruleList.map(rule => (
              <div key={rule.id} className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 font-bold text-neutral-900">
                    <span>{rule.name}</span>
                    <span className="font-mono text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.2 rounded">{rule.severity}</span>
                  </div>
                  <p className="text-neutral-600 text-[11px]">{rule.description}</p>
                  <code className="block bg-neutral-900 text-amber-300 p-1.5 rounded font-mono text-[10px]">
                    Pattern: {rule.pattern}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition cursor-pointer ${rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'}`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Rule Form */}
          <form onSubmit={handleAddRule} className="pt-3 border-t border-neutral-200 space-y-3">
            <h4 className="font-bold text-neutral-800 uppercase tracking-wider text-[11px]">Add Custom Review Rule</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                placeholder="Rule Name (e.g. Prohibit eval)"
                className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <input
                type="text"
                value={newRulePattern}
                onChange={e => setNewRulePattern(e.target.value)}
                placeholder="Regex Pattern (e.g. \\beval\\s*\\()"
                className="px-3 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={newRuleSeverity}
                onChange={e => setNewRuleSeverity(e.target.value as SeverityLevel)}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:outline-none"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Informational">Informational</option>
              </select>
              <input
                type="text"
                value={newRuleDesc}
                onChange={e => setNewRuleDesc(e.target.value)}
                placeholder="Description / Guidance"
                className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={!newRuleName.trim() || !newRulePattern.trim()}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Rules apply as review criteria only and do not override security controls.
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold cursor-pointer">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer">
              <Check className="w-3.5 h-3.5" />
              <span>Save Rules</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
