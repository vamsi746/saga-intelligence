import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Loader2, MapPin, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { GrievanceCard } from './GrievanceCard';
import usePoliticianGrievances from '../../hooks/usePoliticianGrievances';
import { usePoliticianNavigation } from '../../contexts/PoliticianNavigationContext';
import { getMinisterInitials } from '../../data/telanganaMinistersData';

const AUTO_REFRESH_MS = 10 * 60 * 1000;

export const TopMlaWatchCard = ({
  politician,
  rank,
  filters,
  onAction,
  getProxiedMediaUrl,
  downloadStates = {},
  actionedGrievanceIds = [],
  selectedGrievanceId = null,
}) => {
  const {
    grievances,
    loading,
    total,
    lastUpdatedAt,
    refresh,
  } = usePoliticianGrievances(politician, filters || {}, {
    autoRefreshMs: AUTO_REFRESH_MS,
    maxKeywords: 6,
    maxResults: 4,
    searchLimit: 30,
    constituencyLimit: 20,
  });

  const { navigateToPoliticianGrievances } = usePoliticianNavigation();

  const refreshLabel = lastUpdatedAt
    ? formatDistanceToNowStrict(lastUpdatedAt, { addSuffix: true })
    : 'waiting for first fetch';

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-indigo-600 px-2 text-[11px] font-bold text-white">
            #{rank}
          </div>
          <Avatar className="h-11 w-11 ring-2 ring-white shadow-sm">
            <AvatarImage src={politician.image} alt={politician.shortName} className="object-cover object-top" />
            <AvatarFallback className="bg-slate-700 text-white font-semibold">
              {getMinisterInitials(politician.shortName || politician.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{politician.shortName || politician.name}</h3>
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {politician.role || 'MLA'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {politician.constituency && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {politician.constituency}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Refreshes every 10 min
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[11px]"
            onClick={refresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[11px] bg-slate-900 hover:bg-slate-800"
            onClick={() => navigateToPoliticianGrievances(politician)}
          >
            Full Feed
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span>{total} related post{total !== 1 ? 's' : ''} matched</span>
        <span>Updated {refreshLabel}</span>
      </div>

      <div className="space-y-3 p-4">
        {loading && grievances.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Fetching related content...</p>
          </div>
        ) : grievances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No related content found</p>
            <p className="mt-1 text-xs text-slate-500">The next automatic refresh will try again in 10 minutes.</p>
          </div>
        ) : (
          grievances.map((grievance) => (
            <GrievanceCard
              key={grievance.id}
              grievance={grievance}
              onAction={onAction}
              getProxiedMediaUrl={getProxiedMediaUrl}
              downloadState={downloadStates[grievance.id]}
              isSelected={selectedGrievanceId === grievance.id && window.innerWidth >= 1280}
              isActioned={actionedGrievanceIds.includes(grievance.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
};

export default TopMlaWatchCard;
