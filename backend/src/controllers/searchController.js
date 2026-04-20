const rapidApiXService = require('../services/rapidApiXService');
const rapidApiFacebookService = require('../services/rapidApiFacebookService');
const rapidApiInstagramService = require('../services/rapidApiInstagramService');
const youtubeService = require('../services/youtube.service');
const redditService = require('../services/redditService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const googleSearchService = require('../services/googleSearchService');
const rankingService = require('../services/rankingService');
const googleAiModeService = require('../services/googleAiModeService');
const urlParserService = require('../services/urlParserService');
const globalSearchService = require('../services/globalSearchService');
const Source = require('../models/Source');
const Content = require('../models/Content');
const openaiGlanceService = require('../services/openaiGlanceService');

const getRetryAfterSeconds = (error) => {
    const header = error?.response?.headers?.['retry-after'];
    const parsedHeader = Number(header);
    if (Number.isFinite(parsedHeader) && parsedHeader > 0) return parsedHeader;
    if (Number.isFinite(error?.retryAfterSeconds) && error.retryAfterSeconds > 0) return error.retryAfterSeconds;

    const fallback = Number(process.env.RAPIDAPI_FACEBOOK_COOLDOWN_SECONDS);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 90;
};

// Timeout wrapper - prevents any single platform from hanging the response
const withTimeout = (promise, ms = 30000, label = 'operation') => {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
        })
    ]).finally(() => clearTimeout(timer));
};

// Search Profiles (Users/Channels/Pages)
const searchProfiles = async (req, res) => {
    try {
        const { platform, query } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        let results = [];
        const timeout = 35000; // 35s per platform

        if (platform === 'x') {
            results = await withTimeout(rapidApiXService.searchUsers(query), timeout, 'X search');
        } else if (platform === 'youtube') {
            results = await withTimeout(youtubeService.searchChannels(query), timeout, 'YouTube search');
        } else if (platform === 'reddit') {
            results = await withTimeout(redditService.searchUsers(query), timeout, 'Reddit search');
        } else if (platform === 'facebook') {
            results = await withTimeout(rapidApiFacebookService.searchPages(query, { throwOnCooldown: true }), timeout, 'Facebook search');
        } else if (platform === 'instagram') {
            results = await withTimeout(rapidApiInstagramService.searchUsers(query), timeout, 'Instagram search');
        } else if (platform === 'all') {
            results = await globalSearchService.searchProfiles(query);
        } else {
            return res.status(400).json({ error: 'Invalid platform. Use "x", "youtube", "reddit", "facebook", "instagram", or "all".' });
        }

        res.json(Array.isArray(results) ? results : []);
    } catch (error) {
        const status = error?.response?.status;
        if (status === 429 || error?.code === 'FB_RAPIDAPI_COOLDOWN') {
            return res.status(429).json({
                error: 'Search is temporarily rate limited. Please retry later.',
                retryAfterSeconds: getRetryAfterSeconds(error)
            });
        }

        console.error('Search Profiles Error:', error?.message || error);
        res.status(500).json({ error: 'Failed to search profiles' });
    }
};

// Search Content (Tweets/Videos/Posts)
const searchContent = async (req, res) => {
    try {
        const { platform, query } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        let results = [];
        const timeout = 35000;

        if (platform === 'x') {
            results = await withTimeout(rapidApiXService.searchTweets(query), timeout, 'X content search');
        } else if (platform === 'youtube') {
            results = await withTimeout(youtubeService.searchVideos(query), timeout, 'YouTube search');
        } else if (platform === 'reddit') {
            results = await withTimeout(redditService.searchPosts(query), timeout, 'Reddit search');
        } else if (platform === 'facebook') {
            results = await withTimeout(rapidApiFacebookService.searchPosts(query, 40, { throwOnCooldown: true }), timeout, 'Facebook search');
        } else if (platform === 'instagram') {
            results = await withTimeout(rapidApiInstagramService.searchPosts(query), timeout, 'Instagram search');
        } else if (platform === 'all') {
            results = await globalSearchService.searchContent(query);
        } else {
            return res.status(400).json({ error: 'Invalid platform. Use "x", "youtube", "reddit", "facebook", "instagram", or "all".' });
        }

        res.json(Array.isArray(results) ? results : []);
    } catch (error) {
        const status = error?.response?.status;
        if (status === 429 || error?.code === 'FB_RAPIDAPI_COOLDOWN') {
            return res.status(429).json({
                error: 'Search is temporarily rate limited. Please retry later.',
                retryAfterSeconds: getRetryAfterSeconds(error)
            });
        }

        console.error('Search Content Error:', error?.message || error);
        res.status(500).json({ error: 'Failed to search content' });
    }
};

// AI-Powered Glance Search - Like Grok
// Searches across platforms and provides AI-generated analysis
const glanceSearch = async (req, res) => {
    try {
        const { query: originalQuery, timeRange = '2d', platforms = 'all', startDate, endDate } = req.query;
        let query = originalQuery; // Mutable copy for autocorrect

        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        // PERSONAL ASSISTANT MODE: Detect conversational/greeting queries
        const lowerQuery = query.toLowerCase().trim();
        const conversationalPatterns = {
            greetings: /^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening|night)|howdy|sup|yo)[\s!?.]*$/i,
            howAreYou: /^(how\s+are\s+you|how's\s+it\s+going|what's\s+up|wassup|how\s+do\s+you\s+do)[\s!?.]*$/i,
            thanks: /^(thanks?|thank\s+you|thx|ty|appreciated)[\s!?.]*$/i,
            bye: /^(bye|goodbye|see\s+you|later|take\s+care|cya)[\s!?.]*$/i,
            whoAreYou: /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|help)[\s!?.]*$/i,
            time: /^(what('s|\s+is)\s+the\s+time|current\s+time|time\s+now)[\s!?.]*$/i,
            date: /^(what('s|\s+is)\s+(the\s+)?date|today('s)?\s+date|what\s+day\s+is\s+it)[\s!?.]*$/i,
        };

        // Check for conversational queries and respond directly
        for (const [type, pattern] of Object.entries(conversationalPatterns)) {
            if (pattern.test(lowerQuery)) {
                let response = '';
                const now = new Date();

                switch (type) {
                    case 'greetings':
                        response = `## Hello!\n\nAsk me about **Telangana police/politics** from social media (e.g., \"Telangana police issues last 24h\").`;
                        break;
                    case 'howAreYou':
                        response = `## I'm doing great! 🚀\n\nThanks for asking! I'm fully operational and ready to help you explore the world of information.\n\n**What can I help you with today?**\n- Search any topic across social platforms\n- Get real-time news analysis\n- Track trending discussions`;
                        break;
                    case 'thanks':
                        response = `## You're welcome!\n\nHappy to help.\n\n💡 **Quick tip:** Use the time + platform filters (X / YouTube / Instagram / Facebook) for sharper results.`;
                        break;
                    case 'bye':
                        response = `## Goodbye! 👋\n\nTake care! I'll be here whenever you need intelligence updates or want to explore what's happening in the world.\n\n*Come back anytime!*`;
                        break;
                    case 'whoAreYou':
                        response = `## I'm Glance\n\n**Your Social Media Intelligence Assistant**\n\nI combine:\n- 🌐 **Multi-platform social coverage** (X, YouTube, Instagram, Facebook)\n- 🤖 **AI analysis** (GPT-powered insights)\n- ⚡ **Fast summaries** with post links for redirection\n\n**What I do best:**\n1. Summarize what’s happening on a topic\n2. Cluster themes (police / govt / scams / politics, etc.)\n3. Show platform-wise highlights\n4. Recommend the most relevant posts to open next`;
                        break;
                    case 'time':
                        response = `## Current Time ⏰\n\n**${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}**\n\n${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
                        break;
                    case 'date':
                        response = `## Today's Date 📅\n\n**${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}**\n\nTime: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                        break;
                }

                return res.json({
                    success: true,
                    query,
                    timeRange,
                    searchDuration: '0.0s',
                    totalResults: 0,
                    platformBreakdown: { x: 0, youtube: 0, reddit: 0, web: 0 },
                    aiAnalysis: response,
                    webSources: [],
                    results: [],
                    isConversational: true
                });
            }
        }

        // Check if query is too short or generic (less than 3 chars or single common words)
        const genericWords = ['a', 'an', 'the', 'is', 'it', 'to', 'of', 'in', 'on', 'at', 'ok', 'yes', 'no', 'ya', 'yeah', 'nah', 'lol', 'hmm', 'hm'];
        if (lowerQuery.length < 3 || genericWords.includes(lowerQuery)) {
            return res.json({
                success: true,
                query,
                timeRange,
                searchDuration: '0.0s',
                totalResults: 0,
                platformBreakdown: { x: 0, youtube: 0, reddit: 0, web: 0 },
                aiAnalysis: `## Need more details 🤔\n\nYour query "${query}" is a bit short. Try being more specific!\n\n**Example searches:**\n- "What's trending in technology?"\n- "Latest news about [topic]"\n- "Analyze sentiment on #hashtag"\n- "[City name] news today"\n\n💡 *The more specific your question, the better my analysis!*`,
                webSources: [],
                results: [],
                isConversational: true
            });
        }

        let optimizedQuery = query;

        // AUTOCORRECT: Fix common misspellings
        const corrections = {
            // Indian cities (expanded)
            'hyderbad': 'hyderabad', 'hydrabad': 'hyderabad', 'hyd': 'hyderabad', 'hyderabd': 'hyderabad',
            'banglore': 'bangalore', 'bengaluru': 'bangalore', 'blr': 'bangalore', 'bangalor': 'bangalore',
            'mumbai': 'mumbai', 'bombay': 'mumbai', 'mubai': 'mumbai',
            'chennai': 'chennai', 'madras': 'chennai', 'chenai': 'chennai',
            'kolkatta': 'kolkata', 'calcutta': 'kolkata', 'kolkta': 'kolkata',
            'delhi': 'delhi', 'dilli': 'delhi', 'newdelhi': 'new delhi', 'delih': 'delhi',
            'ahmedabad': 'ahmedabad', 'ahemdabad': 'ahmedabad', 'ahmadabad': 'ahmedabad',
            'pune': 'pune', 'poona': 'pune',
            'jaipur': 'jaipur', 'jaypur': 'jaipur', 'jaipr': 'jaipur',
            'lucknow': 'lucknow', 'lakhnau': 'lucknow', 'luknow': 'lucknow',
            'chandigarh': 'chandigarh', 'chandighar': 'chandigarh',
            'vizag': 'visakhapatnam', 'vishakha': 'visakhapatnam',
            'vijawada': 'vijayawada', 'bezawada': 'vijayawada',
            // States (expanded)
            'andhrapradesh': 'andhra pradesh', 'ap': 'andhra pradesh', 'andhra': 'andhra pradesh',
            'telangana': 'telangana', 'telengana': 'telangana', 'ts': 'telangana', 'telegana': 'telangana',
            'tamilnadu': 'tamil nadu', 'tn': 'tamil nadu',
            'karnataka': 'karnataka', 'karnatak': 'karnataka', 'ka': 'karnataka',
            'maharashtra': 'maharashtra', 'maharastra': 'maharashtra', 'mh': 'maharashtra',
            'uttarpradesh': 'uttar pradesh', 'up': 'uttar pradesh',
            'gujrat': 'gujarat', 'gujrath': 'gujarat',
            'rajastan': 'rajasthan', 'rajsthan': 'rajasthan',
            // Political terms (expanded)
            'politcal': 'political', 'politcial': 'political', 'politic': 'political', 'politicl': 'political',
            'goverment': 'government', 'govt': 'government', 'governement': 'government', 'govrnment': 'government',
            'parliment': 'parliament', 'parlament': 'parliament', 'parlaiment': 'parliament',
            'electon': 'election', 'elction': 'election', 'electoin': 'election',
            'minsiter': 'minister', 'ministor': 'minister', 'miniser': 'minister',
            'cheif': 'chief', 'cheaf': 'chief', 'chif': 'chief',
            'congres': 'congress', 'trs': 'brs',
            // Common typos
            'reltated': 'related', 'realted': 'related', 'relted': 'related',
            'trnding': 'trending', 'treding': 'trending', 'trendng': 'trending',
            'latets': 'latest', 'lates': 'latest', 'laetst': 'latest',
            'analsis': 'analysis', 'anaylsis': 'analysis',
            'newz': 'news', 'nws': 'news',
        };

        // Known keywords for fuzzy matching unknown words
        const knownKeywords = ['hyderabad', 'bangalore', 'mumbai', 'chennai', 'delhi', 'kolkata', 'pune', 'jaipur',
            'telangana', 'andhra', 'karnataka', 'maharashtra', 'tamil', 'kerala', 'gujarat', 'rajasthan',
            'political', 'government', 'parliament', 'election', 'minister', 'chief', 'police', 'congress', 'bjp',
            'trending', 'latest', 'breaking', 'news', 'update', 'analysis'];

        // Levenshtein distance for fuzzy matching
        const levenshtein = (a, b) => {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                    matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
                }
            }
            return matrix[b.length][a.length];
        };

        // Apply autocorrect with fuzzy matching
        let correctedQuery = query.toLowerCase();
        const words = correctedQuery.split(/\s+/);
        const correctedWords = words.map(word => {
            // Dictionary lookup first
            if (corrections[word]) return corrections[word];
            // Fuzzy match for words > 4 chars not in dictionary
            if (word.length > 4) {
                for (const keyword of knownKeywords) {
                    const distance = levenshtein(word, keyword);
                    const threshold = word.length > 7 ? 2 : 1;
                    if (distance > 0 && distance <= threshold) {
                        console.log(`[Glance] Fuzzy: "${word}" → "${keyword}"`);
                        return keyword;
                    }
                }
            }
            return word;
        });

        correctedQuery = correctedWords.join(' ');
        if (correctedQuery !== query.toLowerCase()) {
            console.log(`[Glance] Autocorrected: "${query}" → "${correctedQuery}"`);
            query = correctedQuery;
            optimizedQuery = correctedQuery;
        }

        // QUERY OPTIMIZATION: Extract hashtags or key terms
        // Heuristic: If hashtags exist, use them. Else, remove common "stop words".
        const hashtags = query.match(/#[\w\u0C00-\u0C7F]+/g);
        if (hashtags && hashtags.length > 0) {
            optimizedQuery = hashtags.join(' ');
            console.log(`[Glance] Optimized query (Hashtags): "${optimizedQuery}"`);
        } else {
            // Extended stop words list - includes common typos and conversational words
            const stopWords = [
                'analyze', 'analysis', 'sentiment', 'about', 'what', 'whats', 'what\'s', 'happening', 'happeining',
                'is', 'the', 'for', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'are', 'was', 'were', 'be',
                'latest', 'news', 'update', 'updates', 'trending', 'trends', 'trend',
                'right', 'now', 'today', 'currently', 'recent', 'recently', 'related', 'reltated', 'regarding',
                'tell', 'me', 'show', 'give', 'check', 'find', 'search', 'looking', 'look', 'get', 'can', 'you',
                'please', 'help', 'want', 'need', 'would', 'like', 'know', 'any', 'some', 'all', 'this', 'that',
                'how', 'why', 'when', 'where', 'who', 'which', 'there', 'their', 'they', 'them', 'these', 'those'
            ];

            // Remove punctuation and split
            const words = query.toLowerCase().replace(/[^\w\s#]/g, '').split(/\s+/).filter(w => !stopWords.includes(w) && w.length > 2);

            if (words.length > 0) {
                // Prioritize: Take first 3-4 meaningful keywords (locations, topics)
                optimizedQuery = words.slice(0, 4).join(' ');
                console.log(`[Glance] Optimized query (Keywords): "${optimizedQuery}"`);
            } else {
                // If all words were filtered, use original query but cleaner
                optimizedQuery = query.replace(/[^\w\s#]/g, '').trim();
                console.log(`[Glance] Using cleaned original query: "${optimizedQuery}"`);
            }
        }

        // LOCATION PRIORITIZATION: Default to Hyderabad/Telangana if no specific location context
        // This ensures broad queries are scoped to our operational area.
        const knownLocations = [
            'hyderabad', 'hyd', 'telangana', 'ts', 'secunderabad', 'cyberabad',
            'india', 'indian', 'delhi', 'mumbai', 'bangalore', 'chennai', 'andhra pradesh', 'kolkata', 'pune', 'jaipur',
            'us', 'usa', 'america', 'uk', 'london', 'china', 'japan', 'germany', 'france', 'europe', 'africa', 'australia', 'russia',
            'global', 'world', 'international'
        ];

        const lowerOptimized = optimizedQuery.toLowerCase();
        const hasLocation = knownLocations.some(loc => lowerOptimized.includes(loc));

        if (!hasLocation) {
            console.log(`[Glance] No location detected in "${optimizedQuery}". Prioritizing Hyderabad/Telangana.`);
            optimizedQuery += ' Hyderabad Telangana';
        }

        const searchStartTime = Date.now();

        // SOCIAL-ONLY MODE (Dashboard Glance): Use ONLY stored social content.
        const allowedPlatforms = ['x', 'youtube', 'instagram', 'facebook'];
        const normalizedPlatforms = String(platforms || 'all')
            .split(',')
            .map(p => p.trim().toLowerCase())
            .filter(Boolean)
            .map(p => (p === 'twitter' ? 'x' : p));
        const platformList = (normalizedPlatforms.length === 0 || normalizedPlatforms.includes('all'))
            ? allowedPlatforms
            : normalizedPlatforms.filter(p => allowedPlatforms.includes(p));

        const parseTimeRangeToWindow = () => {
            if (startDate && endDate) {
                const s = new Date(startDate);
                const e = new Date(endDate);
                if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
                    return { start: s, end: e };
                }
            }

            const now = new Date();
            const tr = String(timeRange || '2d').toLowerCase().trim();

            const hoursMatch = tr.match(/^(\d+)h$/);
            if (hoursMatch) {
                const hours = Number(hoursMatch[1]);
                return { start: new Date(now.getTime() - hours * 60 * 60 * 1000), end: now };
            }

            const daysMatch = tr.match(/^(\d+)d$/);
            if (daysMatch) {
                const days = Number(daysMatch[1]);
                return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), end: now };
            }

            if (tr === '24h') return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
            if (tr === '1w' || tr === '7d') return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
            if (tr === '2h') return { start: new Date(now.getTime() - 2 * 60 * 60 * 1000), end: now };

            // Default
            return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
        };

        const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const extractKeywords = (value) => {
            const stopWords = new Set([
                'analyze', 'analysis', 'sentiment', 'about', 'what', 'whats', "what's", 'happening', 'happeining',
                'is', 'the', 'for', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'are', 'was', 'were', 'be',
                'latest', 'news', 'update', 'updates', 'trending', 'trends', 'trend',
                'right', 'now', 'today', 'currently', 'recent', 'recently', 'related', 'reltated', 'regarding',
                'tell', 'me', 'show', 'give', 'check', 'find', 'search', 'looking', 'look', 'get', 'can', 'you',
                'please', 'help', 'want', 'need', 'would', 'like', 'know', 'any', 'some', 'all', 'this', 'that',
                'how', 'why', 'when', 'where', 'who', 'which', 'there', 'their', 'they', 'them', 'these', 'those',
                // platforms
                'x', 'twitter', 'youtube', 'instagram', 'facebook'
            ]);

            return String(value || '')
                .toLowerCase()
                .replace(/[^\w\s#]/g, ' ')
                .split(/\s+/)
                .map(w => w.trim())
                .filter(w => w.length > 2 && !stopWords.has(w))
                .slice(0, 8);
        };

        const window = parseTimeRangeToWindow();
        const effectiveTimeRange = String(timeRange || '24h');
        const keywords = extractKeywords(optimizedQuery);

        const baseFilter = {
            platform: { $in: platformList },
            published_at: { $gte: window.start, $lte: window.end }
        };

        const textOrFilter = [];
        for (const kw of keywords) {
            const re = new RegExp(escapeRegex(kw), 'i');
            textOrFilter.push({ text: re });
            textOrFilter.push({ scraped_content: re });
            textOrFilter.push({ author_handle: re });
            textOrFilter.push({ author: re });
        }

        const filter = textOrFilter.length > 0
            ? { ...baseFilter, $or: textOrFilter }
            : baseFilter;

        const docsRaw = await Content.find(filter)
            .sort({ published_at: -1 })
            .limit(500)
            .lean();

        // Scope filter: Telangana-only focus (primary), police + politics/government (primary).
        const topicRegex = /\b(police|ts\s*police|dgp|commissioner|fir|arrest|detain|detention|raid|crime|murder|assault|rape|molest|kidnap|law\s*and\s*order|public\s*safety|security|traffic|enforcement|checkpoint|protest|rally|stone\s*pelting|clash|communal|riot|court|hc|high\s*court|sc|supreme\s*court|bail|sit|ed|cbi|acb|vigilance|ghmc|collector|rdo|tahsildar|minister|mla|mp|cm|chief\s*minister|governor|cabinet|budget|assembly|parliament|election|polls|by\s*election|vote|evm|bjp|congress|brs|trs|aimim|kcr|revanth|owaisi|k\s*chandrashekar|revanth\s*reddy|hy\s*draa|hydraa|water|power|electricity|road|transport|metro|bus|rtc|drainage|flood|rain|weather|pollution|health|hospital|school|college|education|university|jobs|employment|student|farmer|agriculture)\b/i;

        // Telangana signals: state + Hyderabad + major districts/areas.
        const locRegex = /\b(telangana|hyderabad|hydera?bad|hyd|secunderabad|cyberabad|hitech\s*city|gachibowli|madhapur|kukatpally|uppal|lb\s*nagar|charminar|old\s*city|warangal|hanamkonda|nizamabad|karimnagar|khammam|nalgonda|suryapet|mahabubnagar|mahbubnagar|nagarkurnool|medak|siddipet|sangareddy|adilabad|mancherial|nirmal|jagtial|peddapalli|bhupalpally|mulugu|kothagudem|bhadradri|rajanna|sircilla|vikarabad|yadadri|bhongir|mahabubabad|jangaon|wanaparthy|narayanpet|komaram\s*bheem|asifabad|kamareddy|ranga\s*reddy|rangareddy|medchal|malkajgiri)\b/i;
        let docs = Array.isArray(docsRaw) ? docsRaw : [];
        const scoped = docs
            .filter(d => locRegex.test(d.text || '') || locRegex.test(d.scraped_content || '') || locRegex.test(d.author_handle || '') || locRegex.test(d.content_url || ''))
            .filter(d => topicRegex.test(d.text || '') || topicRegex.test(d.scraped_content || '') || topicRegex.test(d.author_handle || ''));

        // If scope filtering is too strict, fall back to location-only, then to raw.
        if (scoped.length >= 8) {
            docs = scoped;
        } else {
            const locOnly = docs.filter(d => locRegex.test(d.text || '') || locRegex.test(d.scraped_content || '') || locRegex.test(d.author_handle || '') || locRegex.test(d.content_url || ''));
            if (locOnly.length >= 8) docs = locOnly;
        }

        docs = docs.slice(0, 300);

        const allResults = (docs || []).map(d => ({
            id: d.content_id,
            db_id: d.id,
            platformKey: d.platform,
            platform: d.platform === 'x' ? 'X (Twitter)' : d.platform.charAt(0).toUpperCase() + d.platform.slice(1),
            text: d.text,
            title: (d.text || '').slice(0, 90) + ((d.text || '').length > 90 ? '...' : ''),
            url: d.content_url,
            link: d.content_url,
            author: d.author,
            author_handle: d.author_handle,
            published_at: d.published_at,
            engagement: d.engagement || {},
            media: d.media || [],
            url_cards: Array.isArray(d.url_cards) ? d.url_cards : []
        }));

        // Compute top shared links (from url_cards) for a card-like UI (derived from social shares).
        const topLinksMap = new Map();
        for (const post of allResults) {
            const cards = Array.isArray(post.url_cards) ? post.url_cards : [];
            for (const c of cards) {
                const expanded = c?.expanded_url || c?.url;
                if (!expanded) continue;
                const key = String(expanded);

                const existing = topLinksMap.get(key) || { url: key, count: 0 };
                existing.count += 1;
                existing.title = existing.title || c?.title || c?.display_url || key;
                existing.source = existing.source || c?.display_url || (() => {
                    try { return new URL(key).hostname.replace(/^www\./i, ''); } catch { return ''; }
                })();
                existing.image = existing.image || c?.image || null;
                existing.snippet = existing.snippet || c?.description || '';
                topLinksMap.set(key, existing);
            }
        }
        const topLinks = Array.from(topLinksMap.values())
            .sort((a, b) => (b.count - a.count))
            .slice(0, 6);

        const totalByPlatform = Object.fromEntries(platformList.map(p => [p, 0]));
        for (const r of allResults) {
            if (totalByPlatform[r.platformKey] === undefined) totalByPlatform[r.platformKey] = 0;
            totalByPlatform[r.platformKey] += 1;
        }

        const searchDuration = ((Date.now() - searchStartTime) / 1000).toFixed(1);

        let aiAnalysis = '';
        const webSources = [];

        // If we have no social posts, do not call GPT (avoids hallucinated narratives).
        if (!allResults || allResults.length === 0) {
            aiAnalysis = generateFallbackAnalysis(query, allResults, totalByPlatform, effectiveTimeRange, webSources);
            return res.json({
                success: true,
                query,
                timeRange: effectiveTimeRange,
                searchDuration: `${searchDuration}s`,
                totalResults: 0,
                platformBreakdown: totalByPlatform,
                aiAnalysis,
                webSources: webSources,
                topLinks: [],
                results: []
            });
        }

        try {
            aiAnalysis = await openaiGlanceService.createSocialGlanceMarkdown({
                question: query,
                timeRange: effectiveTimeRange,
                platforms: platformList,
                posts: allResults,
                platformBreakdown: totalByPlatform,
                topLinks
            });

            if (!aiAnalysis) {
                aiAnalysis = generateFallbackAnalysis(query, allResults, totalByPlatform, effectiveTimeRange, webSources);
            }
        } catch (err) {
            if (err?.code === 'OPENAI_COOLDOWN' && err?.retryAfterMs) {
                return res.status(429).json({
                    error: 'Glance is cooling down. Please retry shortly.',
                    retryAfterSeconds: Math.ceil(err.retryAfterMs / 1000)
                });
            }
            console.error('[Glance] OpenAI analysis failed:', err?.message || err);
            aiAnalysis = generateFallbackAnalysis(query, allResults, totalByPlatform, effectiveTimeRange, webSources);
        }

        res.json({
            success: true,
            query,
            timeRange: effectiveTimeRange,
            searchDuration: `${searchDuration}s`,
            totalResults: allResults.length,
            platformBreakdown: totalByPlatform,
            aiAnalysis,
            webSources: webSources,
            topLinks,
            results: allResults.slice(0, 100) // Return top 100 results
        });

    } catch (error) {
        console.error('Glance Search Error:', error);
        res.status(500).json({
            error: 'Failed to perform glance search',
            message: error.message
        });
    }
};

// Fallback analysis when AI Mode is not available or returns empty
function generateFallbackAnalysis(query, results, platformBreakdown, timeRange, webSources = []) {
    const totalResults = results.length;
    const platforms = Object.entries(platformBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([platform, count]) => `**${platform.toUpperCase()}:** ${count}`)
        .join(' • ');

    if (totalResults === 0) {
        return `## No Results Found

**Query:** "${query}"
**Time Range:** Last ${timeRange}

No significant activity found. Try:
- Using different keywords
- Expanding the time range
- Checking specific hashtags`;
    }

    // Extract hashtags and top content
    const hashtags = new Set();
    const topPosts = [];

    results.forEach(item => {
        const text = item.text || item.content || item.title || '';
        const matches = text.match(/#[\w\u0C00-\u0C7F]+/g) || [];
        matches.forEach(h => hashtags.add(h));

        if (topPosts.length < 4 && text.length > 30) {
            topPosts.push({
                platform: item.platform || (item.platformKey ? item.platformKey.toUpperCase() : 'Social'),
                author: item.author || item.author_handle || item.username || 'Unknown',
                text: text.slice(0, 150) + (text.length > 150 ? '...' : '')
            });
        }
    });

    const topHashtags = Array.from(hashtags).slice(0, 8);

    let analysis = `## Analysis: ${query}\n\n`;

    analysis += `**${totalResults} social results** found in the last ${timeRange}\n${platforms}\n\n`;

    if (topPosts.length > 0) {
        analysis += `### Key Discussions\n\n`;
        // Add top posts content
        topPosts.forEach((post, i) => {
            analysis += `**${i + 1}. @${post.author}** (${post.platform})\n> ${post.text}\n\n`;
        });
    }

    if (topHashtags.length > 0) {
        analysis += `### Related Hashtags\n${topHashtags.join('  ')}\n\n`;
    }

    analysis += `---\n*Generated via Glance (Social).*`;

    return analysis;
}

module.exports = { searchProfiles, searchContent, glanceSearch, fetchPostByUrl };

/**
 * Fetch post/content by URL - supports YouTube, X/Twitter, Facebook, Reddit
 * Parses the URL, fetches content from the platform, and checks if source is monitored
 */
async function fetchPostByUrl(req, res) {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        // Parse the URL to detect platform and extract IDs
        const parsedUrl = urlParserService.parsePostUrl(url);

        if (!parsedUrl) {
            return res.status(400).json({
                error: 'Unsupported URL format',
                message: 'Please provide a valid YouTube, X/Twitter, Facebook, or Reddit post URL'
            });
        }

        const { platform, postId, authorHandle } = parsedUrl;
        let postData = null;
        let sourceData = null;

        console.log(`[URL Search] Platform: ${platform}, PostId: ${postId}, Author: ${authorHandle || 'N/A'}`);

        // Fetch post content based on platform
        if (platform === 'youtube') {
            try {
                const videos = await youtubeService.getVideoDetails([postId]);
                if (videos && videos.length > 0) {
                    const video = videos[0];
                    postData = {
                        id: video.id,
                        platform: 'youtube',
                        title: video.title,
                        description: video.description,
                        url: `https://youtube.com/watch?v=${video.id}`,
                        thumbnail: video.thumbnails?.maxres?.url || video.thumbnails?.high?.url || video.thumbnails?.default?.url,
                        author: video.channelTitle,
                        author_id: video.channelId,
                        author_avatar: null,
                        published_at: video.publishedAt,
                        duration: video.duration,
                        metrics: {
                            views: video.statistics?.viewCount || 0,
                            likes: video.statistics?.likeCount || 0,
                            comments: video.statistics?.commentCount || 0
                        },
                        tags: video.tags || [],
                        media: [{
                            type: 'video',
                            url: `https://youtube.com/watch?v=${video.id}`,
                            preview: video.thumbnails?.maxres?.url || video.thumbnails?.high?.url || video.thumbnails?.default?.url
                        }]
                    };

                    // Check if channel is being monitored
                    sourceData = await Source.findOne({
                        platform: 'youtube',
                        identifier: video.channelId
                    });
                }
            } catch (error) {
                console.error('[URL Search] YouTube fetch error:', error.message);
            }

        } else if (platform === 'x') {
            // Fallback logic: RapidAPI X -> Official X API -> Scraper
            let tweet = null;
            let errorMessages = [];
            try {
                tweet = await rapidApiXService.fetchTweetById(postId);
            } catch (error) {
                errorMessages.push(`[RapidAPI X] ${error.message}`);
            }
            // If not found, try official X API
            if (!tweet && process.env.X_BEARER_TOKEN) {
                try {
                    const xApiService = require('../services/xApiService');
                    // Official API only supports fetch by user, so need authorHandle
                    if (authorHandle) {
                        const tweets = await xApiService.fetchUserTweets(authorHandle, 40);
                        tweet = tweets.find(t => t.id === postId);
                    }
                } catch (error) {
                    errorMessages.push(`[Official X API] ${error.message}`);
                }
            }
            // If still not found, try scraping
            if (!tweet && (!process.env.RAPIDAPI_KEY && !process.env.X_BEARER_TOKEN)) {
                try {
                    const { scrapeProfile, getHealthyAccount } = require('../services/scraperService');
                    if (authorHandle) {
                        const account = await getHealthyAccount();
                        if (account) {
                            const tweets = await scrapeProfile(authorHandle, account);
                            tweet = tweets.find(t => t.id === postId);
                        }
                    }
                } catch (error) {
                    errorMessages.push(`[Scraper] ${error.message}`);
                }
            }
            if (tweet) {
                postData = {
                    id: tweet.id,
                    platform: 'x',
                    text: tweet.text,
                    url: tweet.url,
                    author: tweet.author || tweet.author_name || authorHandle,
                    author_handle: tweet.author_handle || authorHandle,
                    author_avatar: tweet.author_avatar,
                    author_id: tweet.author_id,
                    is_verified: tweet.is_verified,
                    published_at: tweet.created_at,
                    metrics: tweet.metrics,
                    media: tweet.media || [],
                    quoted_content: tweet.quoted_content
                };
                // Check if account is being monitored (by handle)
                if (postData.author_handle) {
                    sourceData = await Source.findOne({
                        platform: 'x',
                        identifier: { $regex: new RegExp(`^@?${postData.author_handle}$`, 'i') }
                    });
                }
            } else if (errorMessages.length > 0) {
                console.error('[URL Search] X/Twitter fetch errors:', errorMessages.join(' | '));
            }

        } else if (platform === 'facebook') {
            try {
                if (authorHandle) {
                    const pageDetails = await rapidApiFacebookService.fetchPageDetails(authorHandle);
                    if (pageDetails) {
                        const posts = await rapidApiFacebookService.fetchPagePosts(
                            pageDetails.id || authorHandle,
                            20,
                            pageDetails.name
                        );

                        const matchingPost = posts.find(p =>
                            p.id === postId ||
                            String(p.id).includes(postId) ||
                            postId.includes(String(p.id))
                        );

                        if (matchingPost) {
                            postData = {
                                id: matchingPost.id,
                                platform: 'facebook',
                                text: matchingPost.text,
                                url: matchingPost.url || url,
                                author: matchingPost.author_name || pageDetails.name,
                                author_id: matchingPost.author_id || pageDetails.id,
                                author_avatar: pageDetails.image,
                                is_verified: pageDetails.is_verified,
                                published_at: matchingPost.created_at,
                                metrics: {
                                    likes: matchingPost.engagement?.likes || 0,
                                    comments: matchingPost.engagement?.comments || 0,
                                    shares: matchingPost.engagement?.shares || 0,
                                    views: matchingPost.engagement?.views || 0
                                },
                                media: matchingPost.media || []
                            };
                        } else if (posts.length > 0) {
                            const firstPost = posts[0];
                            postData = {
                                id: firstPost.id,
                                platform: 'facebook',
                                text: firstPost.text,
                                url: firstPost.url || url,
                                author: firstPost.author_name || pageDetails.name,
                                author_id: firstPost.author_id || pageDetails.id,
                                author_avatar: pageDetails.image,
                                is_verified: pageDetails.is_verified,
                                published_at: firstPost.created_at,
                                metrics: {
                                    likes: firstPost.engagement?.likes || 0,
                                    comments: firstPost.engagement?.comments || 0,
                                    shares: firstPost.engagement?.shares || 0,
                                    views: firstPost.engagement?.views || 0
                                },
                                media: firstPost.media || [],
                                note: 'Exact post not found - showing latest post from this page'
                            };
                        }

                        sourceData = await Source.findOne({
                            platform: 'facebook',
                            $or: [
                                { identifier: { $regex: authorHandle, $options: 'i' } },
                                { identifier: { $regex: pageDetails.id, $options: 'i' } }
                            ]
                        });
                    }
                }
            } catch (error) {
                console.error('[URL Search] Facebook fetch error:', error.message);
            }
        } else if (platform === 'reddit') {
            try {
                const post = await redditService.fetchPostById(postId);
                if (post) {
                    postData = {
                        id: post.id,
                        platform: 'reddit',
                        text: post.text,
                        url: post.url || url,
                        author: post.author,
                        author_handle: post.author_handle,
                        author_avatar: post.author_avatar,
                        published_at: post.created_at,
                        metrics: post.metrics,
                        media: post.media || []
                    };

                    if (post.author_handle) {
                        sourceData = await Source.findOne({
                            platform: 'reddit',
                            identifier: { $regex: new RegExp(`^@?${post.author_handle}$`, 'i') }
                        });
                    }
                }
            } catch (error) {
                console.error('[URL Search] Reddit fetch error:', error.message);
            }
        }

        if (!postData) {
            return res.status(404).json({
                error: 'Post not found',
                message: `Could not fetch content from ${urlParserService.getPlatformDisplayName(platform)}. The post may be private, deleted, or unavailable.`,
                parsed: parsedUrl
            });
        }

        const response = {
            success: true,
            post: postData,
            source: sourceData ? {
                isMonitored: true,
                sourceId: sourceData.id || sourceData._id,
                displayName: sourceData.display_name,
                category: sourceData.category,
                priority: sourceData.priority,
                isActive: sourceData.is_active
            } : {
                isMonitored: false,
                sourceId: null,
                suggestedIdentifier: postData.author_handle || postData.author_id || postData.author,
                suggestedDisplayName: postData.author
            }
        };

        res.json(response);

    } catch (error) {
        console.error('[URL Search] Error:', error);
        res.status(500).json({
            error: 'Failed to fetch post by URL',
            message: error.message
        });
    }
}
