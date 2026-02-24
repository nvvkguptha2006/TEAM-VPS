/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ShieldAlert, 
  Zap, 
  Terminal, 
  Loader2, 
  Copy, 
  Check, 
  FileCode,
  AlertCircle,
  GitMerge,
  XCircle,
  FolderPlus
} from 'lucide-react';
import { motion } from 'motion/react';
import hljs from 'highlight.js';
import ReactMarkdown from 'react-markdown';
import Editor, { Monaco } from '@monaco-editor/react';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SECTIONS = [
  "ALL",
  "Critical Issues",
  "Complexity Analysis",
  "Scalability Verdict",
  "Adversarial Test Cases",
  "Optimized Production Rewrite",
  "Competitive Scorecard"
];

const LANGUAGES = [
  "C++", "Python", "JavaScript", "TypeScript", "Java", "Go", "Rust", "HTML", "CSS"
];

const OPTIMIZATION_GOALS = [
  "Balanced Optimization", "Optimize for Speed", "Optimize for Memory", "Optimize for Security", "Optimize for Readability"
];

interface CodeFile {
  name: string;
  content: string;
}

export default function App() {
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [language, setLanguage] = useState('C++');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [optimizationGoal, setOptimizationGoal] = useState('Balanced Optimization');
  const [loading, setLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [optimizedCode, setOptimizedCode] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState({ log: false, code: false });
  const [error, setError] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(true);

  const resultRef = useRef<HTMLDivElement>(null);
  const optimizedCodeRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const auditRequestRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('webkitdirectory', '');
    }
  }, []);

  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [auditReport]);

  useEffect(() => {
    if (optimizedCodeRef.current) {
      optimizedCodeRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [optimizedCode]);

  function handleEditorDidMount(editor: any, monaco: Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme('codearena-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#101010',
      },
    });
    monaco.editor.setTheme('codearena-dark');
  }

  useEffect(() => {
    if (editorRef.current && monacoRef.current && heatmapData.length > 0 && isHeatmapVisible) {
      const decorations = heatmapData.map(item => ({
        range: new monacoRef.current.Range(item.lineNumber, 1, item.lineNumber, 1),
        options: {
          isWholeLine: true,
          className: `heatmap-${item.color}`,
          glyphMarginClassName: `glyph-${item.color}`,
          glyphMarginHoverMessage: { value: item.description },
        }
      }));
      editorRef.current.deltaDecorations([], decorations);
    } else if (editorRef.current) {
      editorRef.current.deltaDecorations([], []);
    }
  }, [heatmapData, isHeatmapVisible]);

  const handleAudit = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);
    setAuditReport(null);
    setOptimizedCode(null);

    const requestId = Date.now();
    auditRequestRef.current = requestId;

    try {
      const model = "gemini-3.1-pro-preview";
      const prompt = `
        You are a world-class ${language} performance engineer and security auditor. Your analysis is forensic and you uncover subtle issues others miss.
        Your job is to analyze the following collection of files as a single, unified project. You must consider the interactions between files to identify architectural flaws, security vulnerabilities, and optimization opportunities that span the entire codebase. Produce a structured audit report, a code intelligence heatmap, and a radically optimized version of the code based on the user's selected optimization goal.

        When providing the 'Optimized Production Rewrite', it is CRITICAL that you provide the absolute best, most optimized code possible. Do not make superficial improvements. The goal is the theoretical maximum optimization, even if it requires significant algorithmic and architectural changes.

        Optimization Goal: ${optimizationGoal}

        In addition to the report, you MUST generate a JSON object for a code intelligence heatmap. The JSON object must be enclosed in a markdown block with the language 'json_heatmap'.

        The JSON object should contain a single key, "heatmap", which is an array of objects. Each object in the array must have the following properties:
        - "lineNumber": The line number of the code issue.
        - "severity": "high", "medium", "low", or "optimization".
        - "color": "red", "orange", "yellow", or "green".
        - "description": A brief, technical description of the issue or optimization.

        Example Heatmap JSON block:
        \`\`\`json_heatmap
        {
          "heatmap": [
            {
              "lineNumber": 10,
              "severity": "high",
              "color": "red",
              "description": "SQL injection vulnerability."
            }
          ]
        }
        \`\`\`

        CRITICAL OUTPUT RULES (MANDATORY):
        1. Output ONLY bullet points for the text report.
        2. No paragraphs.
        3. For the 'Optimized Production Rewrite' section, you MUST use a markdown code block for ${language} code. For all other sections, do not use markdown.
        4. No emojis.
        5. No introductory or closing sentences.
        6. Each bullet must be maximum 2 short lines.
        7. No unnecessary explanations.
        8. Be precise and technical.
        9. If the user specifies a single section, return ONLY that section.
        10. If the user does NOT specify any section, return ALL sections.
        11. Do not invent sections.
        12. Do not repeat section titles unless requested.

        Available Sections:
        - Static Pre-Analysis
        - Critical Issues
        - High Priority
        - Medium Priority
        - Low Priority
        - Complexity Analysis
        - Scalability Verdict
        - Adversarial Test Cases
        - Optimized Production Rewrite
        - Competitive Scorecard

        User Requirement:
        ${selectedSection}

        Codebase:\n${files.map(f => `--- FILE: ${f.name} ---\n${f.content}`).join('\n\n')}
      `;

      const response = await genAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      let resultText = response.text;
      if (resultText && auditRequestRef.current === requestId) {
        // Extract Heatmap Data
        const heatmapRegex = /\`\`\`json_heatmap\n([\s\S]*?)\n\`\`\`/;
        const heatmapMatch = resultText.match(heatmapRegex);
        if (heatmapMatch && heatmapMatch[1]) {
          try {
            const heatmapJson = JSON.parse(heatmapMatch[1]);
            setHeatmapData(heatmapJson.heatmap || []);
          } catch (e) {
            console.error("Failed to parse heatmap JSON:", e);
            setHeatmapData([]);
          }
          resultText = resultText.replace(heatmapRegex, '').trim();
        } else {
          setHeatmapData([]);
        }

        // Extract Optimized Code
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
        const escapedLanguage = escapeRegExp(language.toLowerCase());
        const optimizedCodeRegex = new RegExp('Optimized Production Rewrite\\s*\\`\\`\\`(?:' + escapedLanguage + ')?\\n([\\s\\S]*?)\\n\\`\\`\\`', 'i');
        const optimizedMatch = resultText.match(optimizedCodeRegex);

        if (optimizedMatch && optimizedMatch[1]) {
            setOptimizedCode('```' + language.toLowerCase() + '\n' + optimizedMatch[1].trim() + '\n```');
            const report = resultText.replace(optimizedCodeRegex, 'Optimized Production Rewrite\n- See optimized code panel.').trim();
            setAuditReport(report);
        } else {
            setOptimizedCode(null);
            setAuditReport(resultText);
        }
      } else {
        throw new Error("Empty response from auditor.");
      }
    } catch (err: any) {
      console.error(err);
      if (auditRequestRef.current === requestId) {
        setError(err.message || "An error occurred during the audit.");
      }
    } finally {
      if (auditRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (uploadedFiles) {
      const newFiles: CodeFile[] = [];
      const filesToProcess = Array.from(uploadedFiles).filter(file => file.size > 0);
      
      if (filesToProcess.length === 0) return;

      let processedCount = 0;
      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileName = (file as any).webkitRelativePath || file.name;
          newFiles.push({ name: fileName, content: e.target?.result as string });
          processedCount++;
          if (processedCount === filesToProcess.length) {
            setFiles(prev => [...prev, ...newFiles].sort((a, b) => a.name.localeCompare(b.name)));
            if (!activeFile) {
              setActiveFile(newFiles.sort((a, b) => a.name.localeCompare(b.name))[0].name);
            }
          }
        };
        reader.readAsText(file);
      });
    }
  };

  const handleStop = () => {
    auditRequestRef.current = 0; // Invalidate the current request
    setLoading(false);
    setError("Analysis stopped by user.");
  };

  const copyToClipboard = (text: string | null, type: 'log' | 'code') => {
    if (text) {
      const codeToCopy = text.replace(new RegExp('```' + language.toLowerCase() + '\\n|```', 'g'), '');
      navigator.clipboard.writeText(codeToCopy);
      setCopiedStates(prev => ({ ...prev, [type]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [type]: false })), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Sidebar / Navigation */}
      <div className="fixed top-0 left-0 h-full w-16 md:w-20 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-8 gap-8 z-50">
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 shadow-lg shadow-emerald-500/5">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1 flex flex-col gap-6 text-zinc-600">
          <button className="text-emerald-500"><FileCode className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="pl-16 md:pl-20">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-100">Code Auditor <span className="text-emerald-500">v4.0</span></h1>
            <div className="h-4 w-px bg-zinc-800" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Strict Protocol Enabled</span>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select 
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
            >
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              value={optimizationGoal}
              onChange={(e) => setOptimizationGoal(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
            >
              {OPTIMIZATION_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {loading ? (
              <button
                onClick={handleStop}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
              >
                <XCircle className="w-3 h-3" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleAudit}
                disabled={files.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                <Zap className="w-3 h-3" />
                Run Audit
              </button>
            )}
          </div>
        </header>

        <main className={`p-8 grid ${optimizedCode ? 'grid-cols-[250px_1fr_1fr_1fr]' : 'grid-cols-[250px_1fr_1fr]'} gap-8`}>
          {/* File Browser */}
          <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl flex flex-col">
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Project Folder</h2>
              <button onClick={() => fileInputRef.current?.click()} className="text-zinc-500 hover:text-emerald-500">
                <FolderPlus className="w-4 h-4" />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {files.map(file => (
                <button 
                  key={file.name}
                  onClick={() => setActiveFile(file.name)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded ${activeFile === file.name ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:bg-zinc-800'}`}>
                  {file.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <Terminal className="w-3 h-3" /> {optimizedCode ? 'Original Source' : 'Input Buffer'}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setIsHeatmapVisible(!isHeatmapVisible)} className="flex items-center gap-2 text-[10px] text-zinc-600 hover:text-zinc-400 uppercase font-bold">
                  <div className={`w-2 h-2 rounded-full ${isHeatmapVisible ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                  Heatmap
                </button>
                <button onClick={() => { setFiles([]); setActiveFile(null); }} className="text-[10px] text-zinc-600 hover:text-zinc-400 uppercase font-bold">Flush</button>
              </div>
            </div>
            <div className="relative group">
              <Editor
                height="calc(100vh - 200px)"
                language={language.toLowerCase()}
                value={files.find(f => f.name === activeFile)?.content || ''}
                onChange={(value) => {
                  if (activeFile) {
                    setFiles(files.map(f => f.name === activeFile ? { ...f, content: value || '' } : f));
                  }
                }}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                  scrollBeyondLastLine: false,
                  glyphMargin: true,
                }}
                className="border border-zinc-900 rounded-xl overflow-hidden"
              />
              <div className="absolute bottom-4 right-4 text-[10px] font-mono text-zinc-800 pointer-events-none">
                {files.find(f => f.name === activeFile)?.content.length || 0} chars
              </div>
            </div>
          </div>
          
          {/* Optimized Code Area */}
          {optimizedCode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <GitMerge className="w-3 h-3" /> Optimized Rewrite
                </div>
                <button onClick={() => copyToClipboard(optimizedCode, 'code')} className="flex items-center gap-2 text-[10px] text-zinc-600 hover:text-zinc-400 uppercase font-bold transition-colors">
                  {copiedStates.code ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedStates.code ? 'Copied' : 'Copy Code'}
                </button>
              </div>
              <div ref={optimizedCodeRef} className="w-full h-[calc(100vh-200px)] bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden flex flex-col relative markdown-body custom-scrollbar">
                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-zinc-400">
                  <ReactMarkdown>{optimizedCode}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Output Area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <Zap className="w-3 h-3" /> Audit Log
              </div>
              {auditReport && (
                <button onClick={() => copyToClipboard(auditReport, 'log')} className="flex items-center gap-2 text-[10px] text-zinc-600 hover:text-zinc-400 uppercase font-bold transition-colors">
                  {copiedStates.log ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedStates.log ? 'Copied' : 'Copy Log'}
                </button>
              )}
            </div>

            <div className="w-full h-[calc(100vh-200px)] bg-zinc-900/10 border border-zinc-900 rounded-xl overflow-hidden flex flex-col relative">
              {!auditReport && !loading && !error && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full border border-zinc-900 flex items-center justify-center text-zinc-800">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">System Idle</p>
                    <p className="text-[10px] text-zinc-800 max-w-[200px] leading-relaxed">Awaiting code injection for technical evaluation and stress-testing.</p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <div className="absolute inset-0 blur-2xl bg-emerald-500/20 animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 animate-pulse">Running Static Analysis</p>
                    <p className="text-[10px] text-zinc-600">Evaluating memory safety and complexity constraints.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <AlertCircle className="w-10 h-10 text-red-900/50" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-900">Protocol Failure</p>
                    <p className="text-[10px] text-zinc-700">{error}</p>
                  </div>
                </div>
              )}

              {auditReport && (
                <div 
                  ref={resultRef}
                  className="flex-1 overflow-y-auto p-8 font-mono text-[11px] leading-relaxed text-zinc-400 custom-scrollbar"
                >
                  <div className="whitespace-pre-wrap">
                    {auditReport.split('\n').map((line, i) => {
                      const isHeader = SECTIONS.some(s => line.trim().startsWith(s));
                      if (isHeader) {
                        return (
                          <div key={i} className="mt-8 mb-4 first:mt-0">
                            <span className="text-zinc-100 font-bold uppercase tracking-widest border-b border-zinc-800 pb-1 block">
                              {line}
                            </span>
                          </div>
                        );
                      }
                      if (line.trim().startsWith('-')) {
                        return (
                          <div key={i} className="flex gap-3 mb-2 group">
                            <span className="text-emerald-500/50 group-hover:text-emerald-500 transition-colors">•</span>
                            <span className="flex-1">{line.trim().substring(1).trim()}</span>
                          </div>
                        );
                      }
                      return <div key={i} className="mb-1">{line}</div>;
                    })}
                  </div>
                </div>
              )}
              
              {/* Decorative scan line */}
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20 blur-sm animate-scan" />}
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .heatmap-red { background-color: rgba(239, 68, 68, 0.1); }
        .heatmap-orange { background-color: rgba(249, 115, 22, 0.1); }
        .heatmap-yellow { background-color: rgba(234, 179, 8, 0.1); }
        .heatmap-green { background-color: rgba(34, 197, 94, 0.1); }
        .glyph-red { background: #ef4444; }
        .glyph-orange { background: #f97316; }
        .glyph-yellow { background: #eab308; }
        .glyph-green { background: #22c55e; }

        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(calc(100vh - 200px)); }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #18181b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #27272a;
        }
      `}</style>
    </div>
  );
}
