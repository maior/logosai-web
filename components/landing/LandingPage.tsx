'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GoogleIcon } from './GoogleIcon';

interface LandingPageProps {
  onSignIn: () => void;
  isConnected: boolean;
  isCheckingConnection: boolean;
}

// Animated product demo — shows the multi-agent pipeline in action
function AgentDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2000),
      setTimeout(() => setStep(3), 3400),
      setTimeout(() => setStep(4), 5000),
      setTimeout(() => setStep(0), 8000),
    ];
    const loop = setInterval(() => {
      setStep(0);
      timers.push(
        setTimeout(() => setStep(1), 800),
        setTimeout(() => setStep(2), 2000),
        setTimeout(() => setStep(3), 3400),
        setTimeout(() => setStep(4), 5000),
      );
    }, 8000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-2xl shadow-black/40">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/80 bg-slate-900">
        <div className="w-2 h-2 rounded-full bg-slate-700" />
        <div className="w-2 h-2 rounded-full bg-slate-700" />
        <div className="w-2 h-2 rounded-full bg-slate-700" />
        <span className="ml-2 text-[11px] text-slate-600 font-mono">LogosAI</span>
      </div>

      <div className="p-5 space-y-4 min-h-[280px]">
        {/* User query */}
        <div className="flex justify-end">
          <div className="bg-slate-800 rounded-2xl rounded-br-sm px-4 py-2.5">
            <p className="text-[13px] text-slate-200">
              Analyze Korea semiconductor export trends and forecast Q3 outlook
            </p>
          </div>
        </div>

        {/* Step 1: Agent selection */}
        {step >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <p className="text-[11px] text-slate-600 font-mono">Ontology selected 3 agents</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'internet', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
                { name: 'analysis', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                { name: 'llm_search', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              ].map((a) => (
                <span
                  key={a.name}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] ${a.color}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current" />
                  {a.name}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Parallel execution */}
        {step >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            {[
              { name: 'internet_agent', time: '3.2s', done: step >= 3 },
              { name: 'analysis_agent', time: '2.8s', done: step >= 3 },
              { name: 'llm_search_agent', time: '1.9s', done: step >= 3 },
            ].map((a) => (
              <div key={a.name} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${a.done ? 'bg-emerald-400' : 'bg-sky-400 animate-pulse'}`} />
                <span className="text-[11px] text-slate-500 font-mono w-32">{a.name}</span>
                {a.done ? (
                  <span className="text-[10px] text-emerald-400/70 font-mono">{a.time}</span>
                ) : (
                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-20">
                    <motion.div
                      className="h-full bg-sky-500/40 rounded-full"
                      initial={{ width: '10%' }}
                      animate={{ width: '85%' }}
                      transition={{ duration: 1.2 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* Step 3: Result */}
        {step >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-slate-800/60 pt-3 space-y-1.5"
          >
            <p className="text-[13px] text-slate-200 leading-relaxed">
              Korea&apos;s semiconductor exports reached <span className="text-white font-medium">$13.2B in June 2024</span>, up 51% YoY.
            </p>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Memory chip demand recovery + AI server investment driving growth.
              Q3 forecast: $14.5-15.8B range based on DRAM spot prices...
            </p>
            <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-600 font-mono">
              <span>3 agents</span>
              <span>·</span>
              <span>4.1s total</span>
              <span>·</span>
              <span>12 sources</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' } as const,
};

export function LandingPage({
  onSignIn,
  isConnected,
  isCheckingConnection,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.06),transparent)] pointer-events-none" />

      <div className="relative">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-5">
          <span className="text-lg font-semibold text-slate-200 tracking-tight">
            LogosAI
          </span>
          <div className="flex items-center gap-6">
            <a href="/architecture" className="text-sm text-slate-500 hover:text-slate-300 transition-colors hidden sm:block">
              Architecture
            </a>
            <a href="#use-cases" className="text-sm text-slate-500 hover:text-slate-300 transition-colors hidden sm:block">
              Use Cases
            </a>
            <a href="#technology" className="text-sm text-slate-500 hover:text-slate-300 transition-colors hidden sm:block">
              Technology
            </a>
            <button
              onClick={onSignIn}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign in
            </button>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="px-6 md:px-12 lg:px-20 pt-16 sm:pt-20 md:pt-28 pb-20">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-800 bg-slate-900/50 mb-6"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-slate-400">47 agents online</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold text-white leading-[1.08] tracking-tight"
              >
                One question.
                <br />
                <span className="text-slate-400">
                  A team of AI agents.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-6 text-base sm:text-lg text-slate-400 max-w-lg leading-relaxed"
              >
                LogosAI deploys specialized agents — research, analysis, code,
                writing, scheduling — that{' '}
                <span className="text-slate-200">work in parallel</span> on your
                query and return one integrated answer.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-8 flex flex-wrap items-center gap-4"
              >
                <button
                  onClick={onSignIn}
                  className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 text-sm font-medium rounded-lg transition-colors shadow-lg shadow-white/5"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Get Started Free</span>
                </button>
                <a
                  href="#use-cases"
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors px-2"
                >
                  See use cases &darr;
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-8 flex items-center gap-6 text-xs text-slate-600"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCheckingConnection
                        ? 'bg-yellow-500/80'
                        : isConnected
                        ? 'bg-emerald-500/80'
                        : 'bg-red-500/80'
                    }`}
                  />
                  {isCheckingConnection ? 'Connecting...' : isConnected ? 'System online' : 'Offline'}
                </div>
                <span className="text-slate-800">|</span>
                <span>No credit card required</span>
              </motion.div>
            </div>

            {/* Animated demo */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-lg lg:justify-self-end"
            >
              <AgentDemo />
            </motion.div>
          </div>
        </section>

        {/* ─── PARADIGM SHIFT ─── */}
        <section className="px-6 md:px-12 lg:px-20 py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <motion.div {...FADE_UP} transition={{ duration: 0.5 }}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                You ask one AI a question.<br />
                <span className="text-slate-500">We deploy an entire team.</span>
              </h2>
              <p className="text-slate-400 max-w-2xl leading-relaxed mb-12">
                Traditional AI gives you one model, one perspective, one answer.
                LogosAI&apos;s ontology engine analyzes your query, selects the right
                combination of specialized agents, and orchestrates them in parallel —
                delivering faster, deeper, more comprehensive results.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before */}
              <motion.div
                {...FADE_UP}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-lg border border-slate-800/60 p-6"
              >
                <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-4">Traditional AI</p>
                <div className="space-y-3">
                  {[
                    'Ask ChatGPT for market research',
                    'Copy result, open another tool for data',
                    'Search Google for latest numbers',
                    'Manually combine everything',
                    'Repeat for each new question',
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-slate-700 mt-0.5 text-sm">0{i + 1}</span>
                      <span className="text-sm text-slate-500">{s}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs text-slate-600 font-mono">~15 minutes per task</p>
              </motion.div>

              {/* After */}
              <motion.div
                {...FADE_UP}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.03] p-6"
              >
                <p className="text-xs font-mono text-indigo-400/70 uppercase tracking-wider mb-4">LogosAI Multi-Agent</p>
                <div className="space-y-3">
                  {[
                    { text: 'Ask one question in natural language', highlight: false },
                    { text: 'Ontology engine selects optimal agents', highlight: true },
                    { text: 'Agents execute in parallel (3-8 seconds)', highlight: true },
                    { text: 'Results automatically integrated', highlight: true },
                    { text: 'One comprehensive answer, multiple sources', highlight: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 text-sm ${s.highlight ? 'text-indigo-400/60' : 'text-slate-600'}`}>0{i + 1}</span>
                      <span className={`text-sm ${s.highlight ? 'text-slate-200' : 'text-slate-400'}`}>{s.text}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs text-indigo-400/50 font-mono">~8 seconds, fully automated</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── USE CASES ─── */}
        <section id="use-cases" className="px-6 md:px-12 lg:px-20 py-20 sm:py-28 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <motion.div {...FADE_UP} transition={{ duration: 0.5 }}>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-3">
                Real-world applications
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                What enterprises build with multi-agent AI
              </h2>
              <p className="text-slate-400 max-w-2xl leading-relaxed mb-14">
                Every query activates a tailored combination of agents. Here are scenarios
                where multi-agent collaboration outperforms single-model approaches.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: 'Market Intelligence',
                  query: '"Analyze Korean EV battery market and top 3 competitors"',
                  agents: ['internet', 'analysis', 'llm_search'],
                  result: 'Real-time market data + competitor analysis + trend forecast in one response',
                },
                {
                  title: 'Financial Analysis',
                  query: '"Calculate ROI for 50M KRW investment in Samsung stock over 5 years"',
                  agents: ['calculator', 'internet', 'analysis'],
                  result: 'Historical performance, dividend yield, risk assessment with calculations',
                },
                {
                  title: 'Code Generation',
                  query: '"Build a REST API with JWT auth, rate limiting, and Swagger docs"',
                  agents: ['code', 'llm_search'],
                  result: 'Production-ready code with security best practices and documentation',
                },
                {
                  title: 'Research Synthesis',
                  query: '"Summarize latest papers on transformer architecture improvements"',
                  agents: ['internet', 'summarization', 'analysis'],
                  result: 'Academic papers crawled, summarized, and synthesized with key insights',
                },
                {
                  title: 'Multilingual Operations',
                  query: '"Translate this board proposal to English, Japanese, and Chinese"',
                  agents: ['translation', 'writing'],
                  result: 'Professional translations with cultural adaptation and business tone',
                },
                {
                  title: 'Automated Scheduling',
                  query: '"Schedule a team meeting next Tuesday with the product review agenda"',
                  agents: ['scheduler', 'writing'],
                  result: 'Calendar event created with agenda, participants notified, memo drafted',
                },
              ].map((uc, i) => (
                <motion.div
                  key={uc.title}
                  {...FADE_UP}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="rounded-lg border border-slate-800/60 p-5 hover:border-slate-700/60 transition-colors group"
                >
                  <h3 className="text-sm font-medium text-slate-200 mb-2">{uc.title}</h3>
                  <p className="text-xs text-slate-500 font-mono leading-relaxed mb-3">{uc.query}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {uc.agents.map((a) => (
                      <span
                        key={a}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500 border border-slate-800"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{uc.result}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PIPELINE ─── */}
        <section className="px-6 md:px-12 lg:px-20 py-20 sm:py-28 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <motion.div {...FADE_UP} transition={{ duration: 0.5 }}>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-3">
                Architecture
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-14">
                From question to answer in 4 stages
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  num: '01',
                  title: 'Query Analysis',
                  body: 'Natural language understanding extracts intent, entities, and complexity. No keyword matching — pure semantic analysis.',
                  detail: 'LLM-powered',
                },
                {
                  num: '02',
                  title: 'Agent Selection',
                  body: 'Ontology engine scores all 47 agents against your query and selects the optimal combination. Agents are never hardcoded.',
                  detail: 'Ontology-based',
                },
                {
                  num: '03',
                  title: 'Parallel Execution',
                  body: 'Selected agents run simultaneously. Real-time SSE streaming shows each agent\'s progress as it works.',
                  detail: 'Concurrent',
                },
                {
                  num: '04',
                  title: 'Result Integration',
                  body: 'Outputs from all agents are semantically merged into a single, coherent response with sources cited.',
                  detail: 'Multi-source',
                },
              ].map((step, i) => (
                <motion.div
                  key={step.num}
                  {...FADE_UP}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl font-bold text-slate-800 font-mono">{step.num}</span>
                    {i < 3 && <div className="hidden md:block flex-1 h-px bg-slate-800/60" />}
                  </div>
                  <h3 className="text-sm font-medium text-slate-200 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-3">{step.body}</p>
                  <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{step.detail}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TECHNOLOGY ─── */}
        <section id="technology" className="px-6 md:px-12 lg:px-20 py-20 sm:py-28 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <motion.div {...FADE_UP} transition={{ duration: 0.5 }}>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-3">
                Under the hood
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Built for complexity, not just conversation
              </h2>
              <p className="text-slate-400 max-w-2xl leading-relaxed mb-14">
                LogosAI isn&apos;t a wrapper around one LLM. It&apos;s a full orchestration
                system with ontology-based reasoning, parallel execution, and
                continuous learning.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: 'Ontology-Based Selection',
                  body: 'Knowledge graph + LLM scoring selects agents semantically. No hardcoded keyword matching — works across languages and domains.',
                },
                {
                  title: 'Parallel Agent Execution',
                  body: 'ThreadPoolExecutor runs agents concurrently. 60-70% faster than sequential execution for multi-agent queries.',
                },
                {
                  title: 'Real-Time SSE Streaming',
                  body: 'Every stage — selection, execution, integration — streams to the UI in real-time. Users see agents working, not just a spinner.',
                },
                {
                  title: 'User Memory System',
                  body: 'Preferences, facts, and instructions are extracted from conversations and persisted. Context carries across sessions.',
                },
                {
                  title: 'Self-Healing Code Generation',
                  body: 'FORGE AI generates new agents on demand with 3-stage error correction: rule-based, LLM-based, and pattern-based.',
                },
                {
                  title: 'Knowledge Graph Integration',
                  body: 'Agent relationships and query patterns are stored in a graph database, enabling intelligent routing that improves over time.',
                },
              ].map((tech, i) => (
                <motion.div
                  key={tech.title}
                  {...FADE_UP}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="p-5 rounded-lg border border-slate-800/60"
                >
                  <h3 className="text-sm font-medium text-slate-200 mb-2">{tech.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{tech.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── NUMBERS ─── */}
        <section className="px-6 md:px-12 lg:px-20 py-16 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '47', label: 'Specialized Agents', sub: 'search, analysis, code, scheduling, writing, translation, crawling' },
              { value: '<8s', label: 'Average Response', sub: 'parallel execution with real-time streaming' },
              { value: '3-5', label: 'Agents per Query', sub: 'automatically selected by ontology engine' },
              { value: '95%', label: 'Self-Healing Rate', sub: 'automatic code generation error correction' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                {...FADE_UP}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="text-center md:text-left"
              >
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm font-medium text-slate-300 mb-1">{stat.label}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── AGENT LIST ─── */}
        <section className="px-6 md:px-12 lg:px-20 py-20 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <motion.div {...FADE_UP} transition={{ duration: 0.5 }}>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-3">
                Agent roster
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-10">
                47 agents, each a specialist
              </h2>
            </motion.div>

            <motion.div
              {...FADE_UP}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2"
            >
              {[
                'Internet Search', 'Data Analysis', 'Code Generation', 'LLM Search',
                'Scheduler', 'Translation', 'Writing', 'Summarization',
                'Calculator', 'Currency Exchange', 'Weather', 'Web Crawler',
                'Document RAG', 'Memo & Notes', 'Task Classifier', 'PDF Processor',
                'Email Composer', 'Image Analysis', 'Academic Research', 'News Aggregator',
                'Legal Analysis', 'Health Advisor', 'Shopping', 'Travel Planner',
              ].map((name) => (
                <div
                  key={name}
                  className="px-3 py-2 rounded border border-slate-800/40 text-xs text-slate-500 text-center hover:text-slate-300 hover:border-slate-700/60 transition-colors"
                >
                  {name}
                </div>
              ))}
              <div className="px-3 py-2 rounded border border-dashed border-slate-800/40 text-xs text-slate-600 text-center italic">
                +23 more
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="px-6 md:px-12 lg:px-20 py-20 sm:py-28 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto text-center">
            <motion.div {...FADE_UP} transition={{ duration: 0.5 }}>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Stop switching tools.<br />
                <span className="text-slate-400">Start deploying agents.</span>
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed">
                Sign in, ask anything, and watch 47 specialized agents collaborate
                on your answer in real-time.
              </p>
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-3 px-8 py-3.5 bg-white hover:bg-slate-100 text-slate-900 text-sm font-medium rounded-lg transition-colors shadow-lg shadow-white/5"
              >
                <GoogleIcon className="w-4 h-4" />
                Get Started Free
              </button>
              <p className="mt-4 text-xs text-slate-600">
                Free to use · No credit card · Google sign-in
              </p>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 md:px-12 lg:px-20 py-8 border-t border-slate-800/40">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500">LogosAI</span>
              <span className="text-xs text-slate-700">Ontology-Based Multi-Agent AI System</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>SKKU AI Research</span>
              <span className="text-slate-800">·</span>
              <span>Built with FastAPI + Next.js</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
