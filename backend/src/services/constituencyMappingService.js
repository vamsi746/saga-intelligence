const { ALL_LEADERS } = require('../config/politicalData');
const { TOWN_TO_CONSTITUENCY } = require('../config/telanganaLocations');

/**
 * Constituency Mapping Service
 * 
 * Provides unified logic for:
 * 1. Finding which leader (MLA/MP) belongs to a constituency.
 * 2. Mapping a detected location/city/town to its respective Assembly Constituency (AC).
 */

/**
 * Robust normalization for constituency names.
 * Removes non-alphanumeric characters and handles common spelling variants.
 */
const normalizeConstituencyName = (name) => {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove spaces, hyphens, dots
        .replace(/mahabubnagar/g, 'mahbubnagar')
        .replace(/mulug$/g, 'mulugu') // Handle Mulug vs Mulugu
        .trim();
};

/**
 * Finds all leaders associated with a constituency name.
 * Matches against the 'constituency' field in politicalData.js.
 */
const getLeadersForConstituency = (constituencyName) => {
    if (!constituencyName) return [];
    const normalizedSearch = normalizeConstituencyName(constituencyName);
    
    return ALL_LEADERS.filter(leader => {
        if (!leader.constituency) return false;
        return normalizeConstituencyName(leader.constituency) === normalizedSearch;
    });
};

/**
 * Resolves a raw location string (city/town) to a canonical Assembly Constituency.
 */
const resolveLocationToConstituency = (locationName) => {
    if (!locationName) return null;
    const lower = locationName.trim().toLowerCase();
    const normalizedLocation = normalizeConstituencyName(locationName);
    
    // 1. Direct match: If the location is already a constituency name
    const directMatch = ALL_LEADERS.find(l => {
        if (!l.constituency) return false;
        return normalizeConstituencyName(l.constituency) === normalizedLocation;
    });
    if (directMatch) return directMatch.constituency;
    
    // 2. Keyword mapping: Check TOWN_TO_CONSTITUENCY from telanganaLocations.js
    // We use word boundaries to avoid false positives (e.g., 'krishna' matching 'ramakrishna')
    for (const [town, constituency] of Object.entries(TOWN_TO_CONSTITUENCY)) {
        const escapedTown = town.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${escapedTown}\\b`, 'i');
        
        if (wordRegex.test(lower)) {
            return constituency;
        }
    }
    
    return null;
};

module.exports = {
    getLeadersForConstituency,
    resolveLocationToConstituency,
    normalizeConstituencyName
};
