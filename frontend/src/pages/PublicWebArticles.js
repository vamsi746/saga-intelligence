import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ExternalLink, Globe, Newspaper, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const SUGGESTED_QUERIES = [
  'Revanth Reddy Telangana BRS',
  'Revanth Reddy Kodangal',
  'KCR BRS Telangana opposition',
  'Telangana election Revanth BRS',
  'Revanth Reddy doctored video'
];

const PublicWebArticles = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [articles, setArticles] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const runSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setErrorMessage('Enter keywords to scrape public web articles.');
      setArticles([]);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');
      const response = await api.get('/web-articles/search', {
        params: { q: query, limit: 40 }
      });
      setArticles(Array.isArray(response.data?.articles) ? response.data.articles : []);
      setSourceFilter('All');
    } catch (error) {
      setArticles([]);
      setErrorMessage(error?.response?.data?.message || 'Failed to scrape public web articles for this query.');
    } finally {
      setIsLoading(false);
    }
  };

  const sources = useMemo(() => {
    const items = articles.map((article) => article.source);
    return ['All', ...Array.from(new Set(items))];
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      const inSource = sourceFilter === 'All' || article.source === sourceFilter;
      return inSource;
    }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }, [articles, sourceFilter]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
              <Newspaper className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Public Web Articles</h1>
          </div>
          <p className="text-sm text-slate-600">
            Live keyword scraping from public web news feeds for analyst triage.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate('/analysis-tools')}
          className="mt-1"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Analysis Tools
        </Button>
      </div>

      <Card className="mb-5 border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="text-xs text-slate-500">
            Search with names, events, party keywords, or narrative terms.
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
                placeholder="Search keywords (example: Revanth Reddy Telangana BRS)"
                className="h-11 pl-9"
              />
            </div>
            <Button
              type="button"
              onClick={runSearch}
              disabled={isLoading}
              className="h-11 sm:px-6"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max pr-1">
            {SUGGESTED_QUERIES.map((query) => (
              <Button
                key={query}
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full bg-white"
                onClick={() => setSearchText(query)}
              >
                {query}
              </Button>
            ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-1">
            <label htmlFor="source-filter" className="text-xs text-slate-500 shrink-0">
              Filter by source
            </label>
            <select
              id="source-filter"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-300 sm:min-w-[180px]"
            >
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>

            <div className="sm:ml-auto text-xs text-slate-500">
              Showing {filtered.length} article{filtered.length === 1 ? '' : 's'}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Results</h2>
      </div>

      <div className="space-y-3 pb-6">
        {errorMessage && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {errorMessage}
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <Card className="border-slate-200">
            <CardContent className="p-6 text-sm text-slate-600">
              Scraping public web articles for your keywords...
            </CardContent>
          </Card>
        )}

        {filtered.map((article) => (
          <Card key={article.id} className="border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <article className="space-y-4">
                <header className="space-y-2 border-b border-slate-100 pb-3">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug tracking-tight">{article.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />{article.source}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />{new Date(article.publishedAt).toLocaleString()}
                    </span>
                  </div>
                </header>

                <p className="text-sm text-gray-700 dark:text-gray-300 leading-6">{article.summary}</p>

                <div className="flex flex-wrap gap-2">
                  {(article.tags || []).map((tag) => (
                    <Badge key={`${article.id}-${tag}`} variant="secondary">{tag}</Badge>
                  ))}
                  {typeof article.relevanceScore === 'number' && (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                      Score: {article.relevanceScore}
                    </Badge>
                  )}
                </div>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky-600 font-medium"
                >
                  <ExternalLink className="h-4 w-4" /> Open Source Article
                </a>
              </article>
            </CardContent>
          </Card>
        ))}

        {!isLoading && !errorMessage && filtered.length === 0 && searchText.trim() && (
          <Card className="border-slate-200">
            <CardContent className="p-10 text-center space-y-2">
              <div className="text-slate-700 font-medium">No articles found for this keyword set.</div>
              <div className="text-sm text-slate-500">Try broader terms or remove one keyword.</div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !errorMessage && filtered.length === 0 && !searchText.trim() && (
          <Card className="border-dashed border-slate-300 bg-slate-50/70">
            <CardContent className="p-12 text-center space-y-2">
              <Newspaper className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="text-slate-700 font-medium">Start with a keyword search</div>
              <div className="text-sm text-slate-500">Pick a suggestion or type your own query.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PublicWebArticles;