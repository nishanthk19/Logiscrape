import React, { useState } from 'react';
import { MicroserviceFile } from '../types';
import { FileCode, Copy, Check, Download, Folder, FileText, Code2, Sparkles } from 'lucide-react';

interface CodeInspectorProps {
  files: MicroserviceFile[];
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({ files }) => {
  const [selectedPath, setSelectedPath] = useState<string>('docker-compose.yml');
  const [copied, setCopied] = useState<boolean>(false);

  const selectedFile = files.find((f) => f.path === selectedPath) || files[0];

  const handleCopy = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-4">
      {/* Code Inspector Header */}
      <div className="bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-center">
            <Code2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Microservice Codebase Inspector
            </h2>
            <p className="text-xs text-slate-500">
              Production-ready docker-compose, Playwright scraper, Express API, and HTML dashboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy File Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadFile}
            className="px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {selectedFile?.name || 'File'}</span>
          </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex overflow-hidden shadow-sm">
        {/* Left Sidebar: File Explorer */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span>Architecture Files</span>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1">
            {files.map((file) => {
              const isActive = file.path === selectedPath;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{file.path}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Editor Preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {/* Editor File Bar */}
          <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">File:</span>
              <span className="text-indigo-400 font-bold">{selectedFile?.path}</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {selectedFile?.content.split('\n').length} lines
            </span>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 overflow-auto p-5 font-mono text-xs text-slate-200 leading-relaxed selection:bg-indigo-900 selection:text-white">
            <pre className="whitespace-pre">
              {selectedFile?.content.split('\n').map((line, idx) => (
                <div key={idx} className="table-row">
                  <span className="table-cell select-none text-right pr-4 text-slate-600 w-10">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
