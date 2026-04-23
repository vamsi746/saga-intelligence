const axios = require('axios');
const GrievanceSettings = require('../models/GrievanceSettings');
const translationService = require('./translationService');
const { ALL_TELANGANA_LOCATIONS } = require('../config/telanganaLocations');

// ═══════════════════════════════════════════════════════════════
//          LOCATION EXTRACTION CONSTANTS
// ═══════════════════════════════════════════════════════════════
const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://178.255.44.130:5003';

const KEYWORD_TO_DISTRICT = {
    // Hyderabad district
    'hyderabad': 'Hyderabad', 'secunderabad': 'Hyderabad', 'begumpet': 'Hyderabad',
    'ameerpet': 'Hyderabad', 'banjara hills': 'Hyderabad', 'jubilee hills': 'Hyderabad',
    'madhapur': 'Hyderabad', 'gachibowli': 'Hyderabad', 'kukatpally': 'Hyderabad',
    'miyapur': 'Hyderabad', 'dilsukhnagar': 'Hyderabad', 'malakpet': 'Hyderabad',
    'nampally': 'Hyderabad', 'charminar': 'Hyderabad', 'mehdipatnam': 'Hyderabad',
    'abids': 'Hyderabad', 'koti': 'Hyderabad', 'shamshabad': 'Hyderabad',
    'lb nagar': 'Hyderabad', 'uppal': 'Hyderabad',
    // Rangareddy district
    'rangareddy': 'Rangareddy', 'ranga reddy': 'Rangareddy', 'ibrahimpatnam': 'Rangareddy',
    'chevella': 'Rangareddy', 'tandur': 'Rangareddy', 'maheshwaram': 'Rangareddy',
    'kandukur': 'Rangareddy', 'kothur': 'Rangareddy', 'farooqnagar': 'Rangareddy',
    'shadnagar': 'Rangareddy',
    // Medchal-Malkajgiri district
    'medchal': 'Medchal-Malkajgiri', 'malkajgiri': 'Medchal-Malkajgiri',
    'kompally': 'Medchal-Malkajgiri', 'alwal': 'Medchal-Malkajgiri',
    'boduppal': 'Medchal-Malkajgiri', 'ghatkesar': 'Medchal-Malkajgiri',
    // Mahabubnagar district
    'mahabubnagar': 'Mahabubnagar', 'mahbubnagar': 'Mahabubnagar',
    'jadcherla': 'Mahabubnagar', 'devarkadra': 'Mahabubnagar',
    'koilkonda': 'Mahabubnagar', 'addakal': 'Mahabubnagar',
    // Narayanpet district
    'narayanpet': 'Narayanpet', 'makthal': 'Narayanpet', 'utkoor': 'Narayanpet',
    // Vikarabad district
    'vikarabad': 'Vikarabad', 'kodangal': 'Vikarabad', 'bomraspet': 'Vikarabad',
    'doultabad': 'Vikarabad', 'parigi': 'Vikarabad', 'mominpet': 'Vikarabad',
    // Wanaparthy district
    'wanaparthy': 'Wanaparthy', 'pebbair': 'Wanaparthy', 'gadwal': 'Wanaparthy',
    // Nagarkurnool district
    'nagarkurnool': 'Nagarkurnool', 'kalwakurthy': 'Nagarkurnool',
    'achampet': 'Nagarkurnool', 'kollapur': 'Nagarkurnool',
    // Warangal district
    'warangal': 'Warangal', 'hanamkonda': 'Warangal', 'kazipet': 'Warangal',
    'narsampet': 'Warangal', 'parkal': 'Warangal', 'wardhannapet': 'Warangal',
    // Karimnagar district
    'karimnagar': 'Karimnagar', 'huzurabad': 'Karimnagar', 'choppadandi': 'Karimnagar',
    'manakondur': 'Karimnagar', 'vemulawada': 'Karimnagar',
    // Nizamabad district
    'nizamabad': 'Nizamabad', 'bodhan': 'Nizamabad', 'armoor': 'Nizamabad',
    // Kamareddy district
    'kamareddy': 'Kamareddy', 'yellareddy': 'Kamareddy', 'banswada': 'Kamareddy',
    // Sircilla district
    'sircilla': 'Rajanna Sircilla',
    // Khammam district
    'khammam': 'Khammam', 'kothagudem': 'Khammam', 'bhadrachalam': 'Khammam',
    'yellandu': 'Khammam', 'sathupalli': 'Khammam', 'madhira': 'Khammam', 'wyra': 'Khammam',
    // Nalgonda district
    'nalgonda': 'Nalgonda', 'miryalaguda': 'Nalgonda', 'devarakonda': 'Nalgonda',
    // Suryapet district
    'suryapet': 'Suryapet', 'kodad': 'Suryapet', 'huzurnagar': 'Suryapet',
    // Medak / Sangareddy / Siddipet
    'medak': 'Medak', 'siddipet': 'Siddipet', 'sangareddy': 'Sangareddy',
    'zaheerabad': 'Sangareddy', 'narayankhed': 'Sangareddy', 'gajwel': 'Siddipet',
    // Adilabad district
    'adilabad': 'Adilabad', 'mancherial': 'Mancherial', 'nirmal': 'Nirmal',
    'bellampalli': 'Mancherial', 'asifabad': 'Adilabad',
    // Jagtial district
    'jagtial': 'Jagtial', 'koratla': 'Jagtial', 'metpally': 'Jagtial',
    // Peddapalli district
    'peddapalli': 'Peddapalli', 'ramagundam': 'Peddapalli', 'godavarikhani': 'Peddapalli',
    // Jangaon district
    'jangaon': 'Jangaon', 'ghanpur': 'Jangaon',
    // Mahabubabad district
    'mahabubabad': 'Mahabubabad', 'dornakal': 'Mahabubabad', 'thorrur': 'Mahabubabad',
    // Yadadri Bhuvanagiri
    'bhongir': 'Yadadri Bhuvanagiri', 'yadagirigutta': 'Yadadri Bhuvanagiri',
    // State reference
    'telangana': 'Hyderabad',
};

const KEYWORD_LIST = [...ALL_TELANGANA_LOCATIONS]
    .filter(kw => kw.length >= 3)
    .sort((a, b) => b.length - a.length);

const MAHABUBNAGAR_ACS = [
    'Kodangal', 'Narayanpet', 'Mahbubnagar', 'Jadcherla', 'Devarkadra', 'Makthal', 'Shadnagar'
];

const MAHABUBNAGAR_AC_ALIASES = {
    'Kodangal': ['kodangal', 'kodangallu'],
    'Narayanpet': ['narayanpet', 'narayanapet'],
    'Mahbubnagar': ['mahbubnagar', 'mahabubnagar', 'mahboobnagar', 'palamoor'],
    'Jadcherla': ['jadcherla', 'jadcharla'],
    'Devarkadra': ['devarkadra', 'devarakadra'],
    'Makthal': ['makthal', 'maktal'],
    'Shadnagar': ['shadnagar', 'shadnager', 'shad nagar']
};

const MAHABUBNAGAR_AC_TO_DISTRICT = {
    'Kodangal': 'Vikarabad',
    'Narayanpet': 'Narayanpet',
    'Mahbubnagar': 'Mahabubnagar',
    'Jadcherla': 'Mahabubnagar',
    'Devarkadra': 'Mahabubnagar',
    'Makthal': 'Narayanpet',
    'Shadnagar': 'Rangareddy'
};

const TELUGU_SCRIPT_REGEX = /[\u0C00-\u0C7F]/;
const TOKEN_BOUNDARY_REGEX = /[^a-z0-9_]/i;
let lastTeluguTranslationWarningAt = 0;
const TELUGU_TRANSLATION_WARNING_THROTTLE_MS = 30000;

// ═══════════════════════════════════════════════════════════════
//          UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCompact = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const appendSourceTagOnce = (source, tag) => {
    const tokens = String(source || '').split('+').map(s => s.trim()).filter(Boolean);
    if (!tokens.includes(tag)) tokens.push(tag);
    return tokens.join('+');
};

const findCanonicalMahbubnagarAc = (value = '') => {
    const normalized = normalizeCompact(value);
    if (!normalized) return null;
    for (const ac of MAHABUBNAGAR_ACS) {
        if (normalizeCompact(ac) === normalized) return ac;
    }
    return null;
};

const findCanonicalMahbubnagarAcFromLooseValue = (value = '') => {
    const lower = String(value || '').toLowerCase().trim();
    if (!lower) return null;
    const canonical = findCanonicalMahbubnagarAc(lower);
    if (canonical) return canonical;
    for (const [ac, aliases] of Object.entries(MAHABUBNAGAR_AC_ALIASES)) {
        for (const alias of aliases) {
            if (normalizeCompact(alias) === normalizeCompact(lower)) return ac;
        }
    }
    return null;
};

const isMahbubnagarTaggedLocation = (location = {}) => {
    const city = String(location.city || '').toLowerCase();
    const district = String(location.district || '').toLowerCase();
    const constituency = String(location.constituency || '').toLowerCase();
    const keyword = String(location.keyword_matched || '').toLowerCase();
    return (
        city.includes('mahabubnagar') || city.includes('mahbubnagar') ||
        district.includes('mahabubnagar') || district.includes('mahbubnagar') ||
        constituency.includes('mahabubnagar') || constituency.includes('mahbubnagar') ||
        !!findCanonicalMahbubnagarAc(constituency) ||
        !!findCanonicalMahbubnagarAcFromLooseValue(city) ||
        !!findCanonicalMahbubnagarAcFromLooseValue(district) ||
        !!findCanonicalMahbubnagarAcFromLooseValue(keyword)
    );
};

const findMahbubnagarAcInText = (text = '') => {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    let bestMatch = null;

    for (const [canonical, aliases] of Object.entries(MAHABUBNAGAR_AC_ALIASES)) {
        for (const alias of aliases) {
            const aliasPattern = escapeRegex(alias.toLowerCase()).replace(/\s+/g, '[\\s_-]+');
            const regex = new RegExp(`(^|[^a-z0-9_])([@#]?${aliasPattern})(?=$|[^a-z0-9_])`, 'ig');
            let match;
            while ((match = regex.exec(lower)) !== null) {
                const candidate = {
                    constituency: canonical,
                    matched: (match[2] || '').trim(),
                    index: match.index + (match[1] || '').length,
                    length: (match[2] || '').replace(/^[@#]/, '').length
                };
                if (!bestMatch || candidate.index < bestMatch.index || (candidate.index === bestMatch.index && candidate.length > bestMatch.length)) {
                    bestMatch = candidate;
                }
            }
        }
    }
    return bestMatch;
};

const getNextMahbubnagarAcByRoundRobin = async ({ dryRun = false, rrState = null } = {}) => {
    if (dryRun) {
        if (!rrState || typeof rrState.nextIndex !== 'number') return MAHABUBNAGAR_ACS[0];
        const constituency = MAHABUBNAGAR_ACS[rrState.nextIndex % MAHABUBNAGAR_ACS.length];
        rrState.nextIndex += 1;
        return constituency;
    }
    const updated = await GrievanceSettings.findOneAndUpdate(
        { id: 'grievance_settings' },
        { $setOnInsert: { id: 'grievance_settings' }, $inc: { mahabubnagar_ac_rr_index: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const indexValue = Number(updated?.mahabubnagar_ac_rr_index || 1);
    return MAHABUBNAGAR_ACS[(indexValue - 1) % MAHABUBNAGAR_ACS.length];
};

const getMahbubnagarConstituencyFromText = async (text = '') => {
    if (!text || typeof text !== 'string') return null;
    const candidates = [text];
    if (TELUGU_SCRIPT_REGEX.test(text)) {
        try {
            const translated = await translationService.translate(text, 'en', 'auto');
            if (translated && translated.trim()) candidates.push(translated);
        } catch (error) {
            const now = Date.now();
            if (now - lastTeluguTranslationWarningAt >= TELUGU_TRANSLATION_WARNING_THROTTLE_MS) {
                console.warn(`[LocationExtraction] Telugu translation failed: ${error.message}`);
                lastTeluguTranslationWarningAt = now;
            }
        }
    }
    for (const candidate of candidates) {
        const match = findMahbubnagarAcInText(candidate);
        if (match) return match;
    }
    return null;
};

const isStateCapitalLocation = (location = {}) => {
    const city = String(location.city || '').toLowerCase();
    const district = String(location.district || '').toLowerCase();
    const keyword = String(location.keyword_matched || '').toLowerCase();
    return city.includes('hyderabad') || city.includes('telangana') ||
           district.includes('hyderabad') || district.includes('telangana') ||
           keyword.includes('hyderabad') || keyword.includes('telangana');
};

const enrichWithMahbubnagarConstituency = async (baseLocation = {}, text = '', options = {}) => {
    const keywordMatch = await getMahbubnagarConstituencyFromText(text);
    if (keywordMatch) {
        return {
            city: baseLocation.city || keywordMatch.constituency,
            district: baseLocation.district || MAHABUBNAGAR_AC_TO_DISTRICT[keywordMatch.constituency] || null,
            constituency: keywordMatch.constituency,
            keyword_matched: keywordMatch.matched,
            lat: baseLocation.lat ?? null,
            lng: baseLocation.lng ?? null,
            confidence: Math.max(Number(baseLocation.confidence || 0), 0.9),
            source: appendSourceTagOnce(baseLocation.source || 'keyword_match', 'mahabubnagar_ac_keyword')
        };
    }
    if (!isMahbubnagarTaggedLocation(baseLocation) && isStateCapitalLocation(baseLocation)) {
        const location = { ...baseLocation };
        location.constituency = await getNextMahbubnagarAcByRoundRobin(options);
        location.source = appendSourceTagOnce(location.source || '', 'mahabubnagar_ac_round_robin');
        location.confidence = Math.max(Number(location.confidence || 0), 0.6);
        return location;
    }
    if (!isMahbubnagarTaggedLocation(baseLocation)) return baseLocation;
    const location = {
        city: baseLocation.city || 'Mahabubnagar',
        district: baseLocation.district || 'Mahabubnagar',
        constituency: baseLocation.constituency || null,
        keyword_matched: baseLocation.keyword_matched || null,
        lat: baseLocation.lat ?? null,
        lng: baseLocation.lng ?? null,
        confidence: baseLocation.confidence ?? null,
        source: baseLocation.source || 'location_service'
    };
    const canonicalExisting = findCanonicalMahbubnagarAc(location.constituency);
    if (canonicalExisting) {
        location.constituency = canonicalExisting;
        return location;
    }
    location.constituency = await getNextMahbubnagarAcByRoundRobin(options);
    location.source = appendSourceTagOnce(location.source, 'mahabubnagar_ac_round_robin');
    location.confidence = Math.max(Number(location.confidence || 0), 0.6);
    return location;
};

const detectLocationFromText = (text) => {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    for (const keyword of KEYWORD_LIST) {
        const idx = lower.indexOf(keyword);
        if (idx === -1) continue;
        const before = idx > 0 ? lower[idx - 1] : ' ';
        const after = idx + keyword.length < lower.length ? lower[idx + keyword.length] : ' ';
        if (/[\s,.!?;:()\-#@"']/.test(before) && /[\s,.!?;:()\-#@"']/.test(after)) {
            return {
                city: keyword.replace(/\b\w/g, c => c.toUpperCase()),
                district: KEYWORD_TO_DISTRICT[keyword] || null,
                keyword_matched: keyword,
                confidence: 0.85,
                source: 'keyword_match',
            };
        }
    }
    return null;
};

const detectLocationFromContent = async (text) => {
    const directMatch = detectLocationFromText(text);
    if (directMatch) return directMatch;
    if (!text || !TELUGU_SCRIPT_REGEX.test(text)) return null;
    try {
        const translated = await translationService.translate(text, 'en', 'auto');
        if (!translated || !translated.trim()) return null;
        const translatedMatch = detectLocationFromText(translated);
        if (!translatedMatch) return null;
        return { ...translatedMatch, source: appendSourceTagOnce(translatedMatch.source, 'translated_keyword_match') };
    } catch (error) {
        return null;
    }
};

/**
 * Round-robin fallback for state-level tagging (Hyderabad vs Telangana)
 */
const getGlobalFallbackLocation = async () => {
    try {
        const updated = await GrievanceSettings.findOneAndUpdate(
            { id: 'grievance_settings' },
            { $setOnInsert: { id: 'grievance_settings' }, $inc: { global_location_rr_index: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const indexValue = Number(updated?.global_location_rr_index || 1);
        const isHyderabad = indexValue % 2 === 1;

        return {
            city: isHyderabad ? 'Hyderabad' : 'Telangana',
            district: isHyderabad ? 'Hyderabad' : 'Hyderabad', // Using Hyderabad as district for state-level too
            constituency: null,
            keyword_matched: null,
            confidence: 0.5,
            source: 'global_round_robin'
        };
    } catch (err) {
        return {
            city: 'Hyderabad',
            district: 'Hyderabad',
            confidence: 0.4,
            source: 'fallback_default'
        };
    }
};

/**
 * Main Location Extraction Pipeline (V6.5)
 * Priority: 
 * 1. External Location Model (Service)
 * 2. Keyword Match from Text
 * 3. Global Round Robin Fallback (Hyderabad/Telangana)
 */
const extractLocation = async (text, postedBy = {}) => {
    try {
        if (!text || !text.trim()) return await getGlobalFallbackLocation();

        // --- STEP 1: EXTERNAL LOCATION MODEL (SERVICE) ---
        let modelLoc = null;
        try {
            const payload = {
                items: [{
                    text,
                    user_location: postedBy.location || '',
                    user_bio: postedBy.bio || postedBy.description || '',
                    hashtags: (text.match(/#\w+/g) || []).join(' '),
                }]
            };
            const res = await axios.post(`${LOCATION_SERVICE_URL}/api/extract-locations-batch`, payload, { timeout: 10000 });
            const locData = res.data?.results?.[0];
            if (locData && locData.location_found) {
                modelLoc = {
                    city: locData.city || null,
                    district: locData.district || null,
                    constituency: locData.constituency || null,
                    keyword_matched: locData.keyword_matched || null,
                    lat: locData.lat || null,
                    lng: locData.lng || null,
                    confidence: locData.confidence || null,
                    source: locData.source || 'location_service'
                };
            }
        } catch (err) {
            console.warn(`[LocationExtraction] Service Call Failed: ${err.message}`);
        }

        if (modelLoc && modelLoc.city) {
            return await enrichWithMahbubnagarConstituency(modelLoc, text);
        }

        // --- STEP 2: KEYWORD MATCH FROM TEXT ---
        const keywordResult = await detectLocationFromContent(text);
        if (keywordResult) {
            return await enrichWithMahbubnagarConstituency({
                city: keywordResult.city,
                district: keywordResult.district,
                constituency: null,
                keyword_matched: keywordResult.keyword_matched,
                confidence: keywordResult.confidence,
                source: keywordResult.source
            }, text);
        }

        // --- STEP 3: GLOBAL ROUND ROBIN FALLBACK ---
        return await getGlobalFallbackLocation();

    } catch (err) {
        console.warn(`[LocationExtraction] Pipeline Error: ${err.message}`);
        return await getGlobalFallbackLocation();
    }
};

module.exports = {
    extractLocation,
    detectLocationFromContent,
    enrichWithMahbubnagarConstituency,
    KEYWORD_TO_DISTRICT,
    KEYWORD_LIST,
    MAHABUBNAGAR_ACS
};
