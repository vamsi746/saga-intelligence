import React from 'react';
import { BarChart3, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const SENTIMENT_CONFIG = {
  positive: {
    label: 'Positive',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    bar: 'bg-emerald-500',
    icon: TrendingUp,
  },
  neutral: {
    label: 'Moderate',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    bar: 'bg-amber-400',
    icon: Minus,
  },
  negative: {
    label: 'Negative',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    bar: 'bg-red-500',
    icon: TrendingDown,
  },
};

const TOPIC_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

/**
 * Analytics summary panel for the selected politician in Grievances MLA mode.
 * Derives analytics from the already-fetched grievances — no extra API calls.
 *
 * Props:
 *   analytics: { total, sentiments: { positive, neutral, negative }, topTopics: [[topic, count], ...] }
 *   politician: { name, role, constituency }
 *   loading: boolean
 */
export const MlaAnalyticsSummary = ({ analytics, politician, loading }) => {
  if (loading || !analytics || analytics.total === 0) return null;

  const { total, sentiments, topTopics } = analytics;
  const sentimentTotal = (sentiments.positive || 0) + (sentiments.neutral || 0) + (sentiments.negative || 0);
  const dominantSentiment = sentimentTotal > 0
    ? ['positive', 'neutral', 'negative'].reduce((best, key) =>
        (sentiments[key] || 0) > (sentiments[best] || 0) ? key : best
      , 'neutral')
    : null;

  return (
    <div className="mx-2 mb-2 rounded-xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40">
        <BarChart3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
        <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
          Grievance Analytics
        </span>
        {dominantSentiment && (
          <span className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SENTIMENT_CONFIG[dominantSentiment].bg} ${SENTIMENT_CONFIG[dominantSentiment].color}`}>
            {React.createElement(SENTIMENT_CONFIG[dominantSentiment].icon, { className: 'h-2.5 w-2.5' })}
            Mostly {SENTIMENT_CONFIG[dominantSentiment].label}
          </span>
        )}
        <span className="ml-auto text-[11px] font-semibold text-slate-500">
          {total} post{total !== 1 ? 's' : ''} matched
        </span>
      </div>

      {/* Body: two-column */}
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
        {/* Sentiment breakdown */}
        <div className="px-4 py-3 border-b sm:border-b-0 sm:border-r border-slate-100">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Sentiment Breakdown</p>
          <div className="space-y-2">
            {['positive', 'neutral', 'negative'].map((key) => {
              const count = sentiments[key] || 0;
              const pct = sentimentTotal > 0 ? Math.round((count / sentimentTotal) * 100) : 0;
              const cfg = SENTIMENT_CONFIG[key];
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                  <span className={`text-[10px] font-medium w-14 ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 w-12 text-right tabular-nums">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top topics */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Top Topics</p>
          {topTopics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topTopics.map(([topic, count], i) => (
                <span
                  key={topic}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TOPIC_COLORS[i % TOPIC_COLORS.length]}`}
                >
                  {topic}
                  <span className="opacity-70">· {count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 italic">No topic data for this selection</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MlaAnalyticsSummary;
