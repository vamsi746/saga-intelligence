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
};

export default MlaAnalyticsSummary;
