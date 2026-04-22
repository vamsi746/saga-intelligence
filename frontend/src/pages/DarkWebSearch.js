import React, { useMemo, useRef, useState } from 'react';
import { ShieldAlert, CalendarDays, Globe, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const ARTICLES = [
  {
    id: 'dw-001',
    title: 'Thread discussing campaign smear package targeting Revanth Reddy',
    source: 'onion forum mirror',
    url: 'http://rvrtnarrative5x2k3dw.onion/thread/001',
    category: 'Political Narrative',
    risk: 'high',
    actor: 'tg_ops_cell',
    keyword: 'Revanth Reddy',
    location: 'Hyderabad',
    firstSeen: '2026-04-21T02:35:00Z',
    summary: 'A closed thread advertises coordinated message packs aimed at discrediting Revanth Reddy ahead of district events.',
    fullArticle: `Executive Summary
    A high-engagement discussion thread on an onion mirror documented a coordinated effort to shape negative political sentiment around Revanth Reddy. The discussion was not limited to opinion sharing; it included operational sequencing, posting templates, and a content-amplification model that appears optimized for short-cycle social media spikes.

    Context and Timeline
    The thread first appeared in the early hours before a cluster of district-level campaign events and quickly accumulated responses from known pseudonymous operators. Participants mapped planned activity to specific public appearances and media moments, indicating intent to synchronize messaging with predictable spikes in audience attention.

    Observed Tactics
    The content pack included pre-written text variants in multiple tones: accusatory, sarcastic, and pseudo-neutral. Operators advised reusing old screenshots with cropped context to manufacture ambiguity while preserving shareability. Several comments recommended launching with quote-chains and indirect references before posting direct allegations, likely to reduce moderation risk and increase organic carry.

    Amplification Design
    A separate sub-thread listed high-volume accounts, relay groups, and timing windows for each wave. The suggested cadence was three-phase: seed narrative, trigger confrontation, then saturate hashtag streams. One participant proposed staggered posting by account age so newly created handles would avoid immediate clustering signals.

    Credibility Signals
    The thread showed repeat participation patterns associated with prior coordinated political discourse activity. Linguistic overlap and recurring operational language suggest this was not a one-off exchange, but part of a structured influence workflow.

    Risk Relevance
    This activity indicates deliberate narrative manipulation against a named political individual with explicit planning around timing, message framing, and multi-account amplification. The combination of campaign-aware scheduling and evasion guidance elevates this from general chatter to a credible coordination signal.`
  },
  {
    id: 'dw-002',
    title: 'Leaked voter-contact spreadsheet mention in dark channel',
    source: 'encrypted board repost',
    url: 'http://brokerchannel98a4f67.onion/post/772',
    category: 'Data Leak',
    risk: 'critical',
    actor: 'data_broker_9',
    keyword: 'Revanth Reddy',
    location: 'Warangal',
    firstSeen: '2026-04-20T19:10:00Z',
    summary: 'Post claims access to politically segmented contact data tagged with references to Revanth Reddy campaign circles.',
    fullArticle: `Executive Summary
    An encrypted board repost advertised a dataset described as a voter-contact spreadsheet with district segmentation and political profiling fields. The seller positioned the file as operationally useful for targeted messaging and campaign-adjacent influence activity.

    Listing Characteristics
    The post included a structured preview of column headers, sample row formatting, and a pricing matrix tied to update frequency. Advertised fields referenced locality clusters, contact confidence scores, likely affiliation markers, and custom labels that appear aligned with campaign-period narrative targeting.

    Operational Intent Indicators
    Reply traffic focused less on authenticity and more on deployment use cases. Multiple responses discussed message routing by district and selective forwarding to high-response contact bands. One buyer requested add-on filtering for rally-adjacent zones, while another asked for language preference tagging to improve conversion rates for local narrative pushes.

    Data Handling Risk
    Even if partially fabricated, the listing presents immediate harm potential by combining personal contact metadata with political segmentation logic. If authentic, it indicates unauthorized distribution of sensitive voter-related information. If mixed or synthetic, it still enables large-scale spam, intimidation messaging, and disinformation seeding by plausible demographic targeting.

    Cross-Channel Linkage
    The seller account identifier has posting overlaps with prior broker-style listings involving phone databases and locality-coded records. Temporal proximity between this listing and nearby political event dates strengthens the hypothesis of tactical release timing.

    Risk Relevance
    The signal is high severity due to possible data leakage coupled with clear evidence of operational targeting discussions. The thread reflects not just data trade but direct intent to weaponize segmented contact information for political narrative influence.`
  },
  {
    id: 'dw-003',
    title: 'Narrative amplification plan around Telangana political hashtags',
    source: 'anonymous relay board',
    url: 'http://hashcluster89vt1xw.onion/board/343',
    category: 'Coordinated Influence',
    risk: 'medium',
    actor: 'hashwave_unit',
    keyword: 'Revanth Reddy',
    location: 'Nizamabad',
    firstSeen: '2026-04-19T11:50:00Z',
    summary: 'Document outlines timing windows and hashtag sequences targeting pro and anti Revanth Reddy discourse.',
    fullArticle: `Executive Summary
    A relay-board planning document detailed a phased amplification framework around Telangana political hashtags, with explicit references to pro and anti Revanth Reddy discourse streams. The document reads as an operational playbook rather than informal commentary.

    Campaign Structure
    The outlined flow used three stages: teaser buildup, confrontation burst, and trend lock. Each stage included suggested message volume, account-tier allocation, and fallback hashtag options when primary tags faced suppression or dilution.

    Content Engineering
    Draft text blocks emphasized emotional contrast and identity signaling to increase quote-share behavior. The playbook encouraged slight lexical variation across accounts to evade repetitive-content detection while preserving narrative consistency.

    Evasion Guidance
    Operators were instructed to avoid synchronized exact-minute posting and to rotate media assets with small edits. The document also recommended blending non-political regional content between campaign posts, likely to reduce account-level anomaly flags.

    Potential Real-World Impact
    Coordinated hashtag pressure can distort organic discussion velocity, push misleading frames into local information ecosystems, and increase perceived consensus around synthetic narratives. Even medium-scale execution can shape media pickup decisions during sensitive political windows.

    Risk Relevance
    This source indicates coordinated influence behavior with mature tactic design, including suppression avoidance and narrative reinforcement methods. Severity is medium due to partial execution evidence, but operational intent is clear and repeatable.`
  },
  {
    id: 'dw-004',
    title: 'Offer to sell fake screenshot bundles linked to local political teams',
    source: 'market listing dump',
    url: 'http://forgecell17mpx9zq.onion/list/550',
    category: 'Forgery / Disinformation',
    risk: 'high',
    actor: 'forge_merchant_x',
    keyword: 'Revanth Reddy',
    location: 'Karimnagar',
    firstSeen: '2026-04-18T07:20:00Z',
    summary: 'Seller advertises fabricated evidence packs intended for rapid spread in political argument cycles.',
    fullArticle: `Executive Summary
    A marketplace vendor promoted fabricated screenshot bundles designed for political rumor campaigns, including customizable templates and rapid-deployment asset packs. The listing targeted buyers seeking short-format visual content that can be circulated as alleged evidence.

    Product Packaging
    Offerings included layered source files, compressed social-format exports, and language-swappable overlays. The vendor advertised turnaround windows aligned with breaking political conversations, indicating service-level support for time-sensitive narrative attacks.

    Buyer Behavior Signals
    Historical feedback entries referenced successful use in local political disputes and requested region-specific wording variants. Several comments prioritized "authentic chat look" and metadata styling, suggesting buyers seek believable visual forgeries rather than obvious edits.

    Distribution Strategy
    Recommended dissemination channels included anonymous image relays, closed groups, and disposable broadcast accounts. The vendor encouraged early release through low-visibility networks before escalation to larger public timelines once engagement proof appeared.

    Harm Potential
    Fabricated screenshot kits reduce technical barriers for disinformation actors and enable rapid reputational damage at scale. In political contexts, forged visuals can trigger reactive media cycles before verification catches up, extending the lifetime of false claims.

    Risk Relevance
    This listing indicates active commercialization of disinformation tooling with direct applicability to local political narratives. Severity remains high because packaging quality and distribution guidance materially increase campaign execution capability.`
  },
  {
    id: 'dw-005',
    title: 'Monitoring note on election-rally chatter in invite-only room',
    source: 'closed signal archive',
    url: 'http://closedrelay31qst8m.onion/room/205',
    category: 'Threat Watch',
    risk: 'medium',
    actor: 'observer_13',
    keyword: 'Revanth Reddy',
    location: 'Mahabubnagar',
    firstSeen: '2026-04-17T22:05:00Z',
    summary: 'Room participants discuss crowd movement and disruption rumors around rallies mentioning Revanth Reddy.',
    fullArticle: `Executive Summary
    Archive captures from an invite-only room showed sustained discussion about political rally logistics, with special focus on crowd movement choke points and disruption rumor narratives linked to events mentioning Revanth Reddy.

    Discussion Themes
    Participants exchanged route observations, transit bottleneck notes, and venue-adjacent timing assumptions. Conversation repeatedly returned to "confusion scripts" intended to circulate contradictory updates on entry gates, transport diversions, and schedule changes.

    Messaging Pattern
    Moderators advised using low-credibility rumor framing first, then introducing apparently corroborating reposts from secondary accounts. This staged approach appears designed to convert uncertain chatter into perceived real-time ground truth.

    Coordination Signals
    Multiple users referenced previously prepared broadcast lists and suggested timed forwarding across closed channels before moving into public hashtags. Several posts highlighted plausible deniability language and discouraged direct operational claims.

    Potential Impact
    During high-density public gatherings, misinformation about routes or safety conditions can increase panic risk, fragment crowd behavior, and strain local response coordination. Even limited rumor spread can create measurable friction around event management.

    Risk Relevance
    The source indicates event-adjacent disruption planning through narrative manipulation rather than direct physical coordination. Severity is medium, but timing sensitivity and recurring behavior patterns warrant active monitoring during rally windows.`
  }
];

const PREBUILT_QUERIES = [
  {
    id: 'data-leak',
    label: 'Political Data Leak Signals',
    match: ['data leak', 'spreadsheet', 'broker']
  },
  {
    id: 'influence-campaign',
    label: 'Coordinated Influence Campaigns',
    match: ['narrative', 'amplification', 'hashtag', 'influence']
  },
  {
    id: 'event-disruption',
    label: 'Rally Disruption Monitoring',
    match: ['rally', 'disruption', 'crowd movement']
  }
];

const riskClass = (risk) => {
  if (risk === 'critical') return 'bg-red-100 text-red-700 border-red-300';
  if (risk === 'high') return 'bg-orange-100 text-orange-700 border-orange-300';
  if (risk === 'medium') return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-emerald-100 text-emerald-700 border-emerald-300';
};

const serialize = (item) => [
  item.title,
  item.summary,
  item.keyword,
  item.category,
  item.actor,
  item.source,
  item.location
].join(' ').toLowerCase();

const DarkWebSearch = () => {
  const navigate = useNavigate();
  const [activeQueryId, setActiveQueryId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchingLabel, setSearchingLabel] = useState('');
  const searchTimerRef = useRef(null);

  const activeQuery = useMemo(
    () => PREBUILT_QUERIES.find((q) => q.id === activeQueryId) || null,
    [activeQueryId]
  );

  const visibleQueries = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return PREBUILT_QUERIES;
    return PREBUILT_QUERIES.filter((query) => query.label.toLowerCase().includes(text));
  }, [searchText]);

  const filtered = useMemo(() => {
    if (!activeQuery) return [];

    return ARTICLES.filter((item) => {
      const blob = serialize(item);
      const matchesPrebuilt = activeQuery.match.some((term) => blob.includes(term.toLowerCase()));
      return matchesPrebuilt;
    }).sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
  }, [activeQuery]);

  const isHome = !activeQuery;

  const handleQuerySelect = (query) => {
    if (isSearching) return;
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    setSearchingLabel(query.label);
    setIsSearching(true);

    searchTimerRef.current = setTimeout(() => {
      setActiveQueryId(query.id);
      setIsSearching(false);
      searchTimerRef.current = null;
    }, 1800);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dark Web Search</h1>
        </div>
        {isHome && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/analysis-tools')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Analysis Tools
          </Button>
        )}
      </div>

      {isHome ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search across darkweb"
              className="pl-9 h-11"
              disabled={isSearching}
            />
          </div>

          {isSearching ? (
            <Card className="border-violet-200 bg-violet-50/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse" />
                <div className="text-sm text-violet-900">
                  Searching across dark web for: <span className="font-semibold">{searchingLabel}</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:240ms]" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleQueries.map((query) => (
                <Button
                  key={query.id}
                  type="button"
                  variant="outline"
                  onClick={() => handleQuerySelect(query)}
                  className="rounded-full"
                >
                  {query.label}
                </Button>
              ))}
            </div>
          )}

          {visibleQueries.length === 0 && (
            <div className="text-sm text-slate-500">No queries found.</div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-violet-300 text-violet-700">{activeQuery.label}</Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setActiveQueryId(null)}
              className="text-slate-600"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>

          <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id} className="border-gray-200 hover:shadow-sm transition-shadow">
            <CardContent className="p-6">
              <article className="space-y-3">
                <header className="space-y-1.5 border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">{item.title}</h3>
                  <div className="text-xs text-emerald-700 break-all">{item.url}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{item.location}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(item.firstSeen).toLocaleString()}</span>
                    <Badge variant="outline" className="border-slate-300 text-slate-700">{item.source}</Badge>
                  </div>
                </header>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 leading-6">
                  {item.summary}
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-7">
                  {item.fullArticle}
                </div>

                <footer className="pt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={riskClass(item.risk)}>{item.risk.toUpperCase()}</Badge>
                <Badge variant="secondary">{item.category}</Badge>
                <Badge variant="outline" className="border-slate-300 text-slate-700">Actor: {item.actor}</Badge>
                <Badge variant="outline" className="border-slate-300 text-slate-700">Keyword: {item.keyword}</Badge>
                </footer>
              </article>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-gray-500">
              No records matched this query.
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DarkWebSearch;
