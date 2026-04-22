import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Scan, MessageSquare, ArrowRight, ShieldAlert } from 'lucide-react';

const tools = [
  {
    name: 'Global Search',
    description: 'Search across all social media platforms for profiles and content.',
    icon: Globe,
    href: '/global-search',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
  },
  {
    name: 'Deepfake Analysis',
    description: 'Detect AI-generated and manipulated images and videos.',
    icon: Scan,
    href: '/deepfake-analysis',
    color: 'from-red-500 to-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
  },
  {
    name: 'Telegram',
    description: 'Monitor and analyze Telegram channels and groups.',
    icon: MessageSquare,
    href: '/telegram',
    color: 'from-sky-500 to-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-800',
  },
  {
    name: 'Dark Web Search',
    description: 'Review suspicious dark web mentions, actors, and leaked political narratives in one search workspace.',
    icon: ShieldAlert,
    href: '/dark-web-search',
    color: 'from-violet-600 to-fuchsia-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
  }
];

const AnalysisTools = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analysis Tools</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select a tool to get started</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => !tool.comingSoon && navigate(tool.href, { state: { fromTools: true } })}
            disabled={tool.comingSoon}
            className={`group relative text-left rounded-xl border ${tool.border} ${tool.bg} p-5 transition-all ${tool.comingSoon ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}
          >
            <div className={`inline-flex items-center justify-center h-11 w-11 rounded-lg bg-gradient-to-br ${tool.color} text-white mb-4 shadow-sm`}>
              <tool.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{tool.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{tool.description}</p>
            {!tool.comingSoon && <ArrowRight className="absolute top-5 right-5 h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AnalysisTools;
