import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  CheckCircle2,
  ArrowRight,
  Printer,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { EngineeringArtefact } from '../types';

interface ArtefactsViewProps {
  artefacts: EngineeringArtefact[];
  onNavigateToK6: () => void;
}

export const ArtefactsView: React.FC<ArtefactsViewProps> = ({
  artefacts,
  onNavigateToK6
}) => {
  const [selectedArtefactId, setSelectedArtefactId] = useState<string>(artefacts[0]?.id || '');
  const [copied, setCopied] = useState(false);

  const activeArtefact = artefacts.find((a) => a.id === selectedArtefactId) || artefacts[0];

  const handleCopy = () => {
    if (activeArtefact) {
      navigator.clipboard.writeText(activeArtefact.markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (activeArtefact) {
      const blob = new Blob([activeArtefact.markdownContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeArtefact.title.toLowerCase().replace(/\s+/g, '_')}_${activeArtefact.version}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-400" />
              <h2 className="text-base font-semibold text-white">
                Deterministic Engineering Artefacts (Constitution §8)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Documents are generated views over the canonical model, not competing sources of truth. Ready for export to Azure DevOps, Confluence, DOCX, and audit packages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              <span>Download .md</span>
            </button>

            <button
              id="proceed-to-k6-btn"
              onClick={onNavigateToK6}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <span>Build k6 Test Suite</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Artefact Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Document List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Available Canonical Artefacts
          </h3>

          <div className="space-y-2">
            {artefacts.map((art) => {
              const isSelected = art.id === activeArtefact?.id;
              return (
                <button
                  key={art.id}
                  onClick={() => setSelectedArtefactId(art.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span className="uppercase">{art.type}</span>
                    <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                      v{art.version} {art.approvalStatus}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white leading-snug">
                    {art.title}
                  </h4>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Author: {art.author}</span>
                    <span>{art.generatedDate}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Document Viewer Sheet */}
        {activeArtefact && (
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-sky-400 tracking-wider">
                  Generated Engineering Document
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {activeArtefact.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 font-mono">
                  Gov: {activeArtefact.approvedBy || 'Approved'}
                </span>
              </div>
            </div>

            {/* Document Content */}
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-xs text-slate-300 font-sans leading-relaxed space-y-4 whitespace-pre-wrap font-mono">
              {activeArtefact.markdownContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
