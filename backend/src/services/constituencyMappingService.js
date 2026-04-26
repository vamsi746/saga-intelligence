const { ALL_LEADERS } = require('../config/politicalData');

/**
 * Constituency Mapping Service
 * 
 * Provides unified logic for:
 * 1. Finding which leader (MLA/MP) belongs to a constituency.
 * 2. Mapping a detected location/city/town to its respective Assembly Constituency (AC).
 */

// Mapping of notable towns/cities to their Assembly Constituencies.
// This supplements the direct constituency name matching.
const TOWN_TO_CONSTITUENCY = {
    // Hyderabad area
    'secunderabad': 'Secunderabad',
    'begumpet': 'Sanathnagar',
    'ameerpet': 'Sanathnagar',
    'banjara hills': 'Jubilee Hills',
    'jubilee hills': 'Jubilee Hills',
    'madhapur': 'Jubilee Hills',
    'gachibowli': 'Serilingampally',
    'kukatpally': 'Kukatpally',
    'miyapur': 'Serilingampally',
    'dilsukhnagar': 'LB Nagar',
    'uppal': 'Uppal',
    
    // Districts
    'kodangal': 'Kodangal',
    'bomraspet': 'Kodangal',
    'doultabad': 'Kodangal',
    'kosgi': 'Kodangal',
    'maddur': 'Kodangal',
    
    'narayanpet': 'Narayanpet',
    'utkoor': 'Narayanpet',
    'marikal': 'Narayanpet',
    'damaragidda': 'Narayanpet',
    
    'mahabubnagar': 'Mahbubnagar',
    'palamoor': 'Mahbubnagar',
    
    'jadcherla': 'Jadcherla',
    'nawabpet': 'Jadcherla',
    
    'devarkadra': 'Devarkadra',
    'koilkonda': 'Devarkadra',
    'addakal': 'Devarkadra',
    
    'makthal': 'Makthal',
    'maganoor': 'Makthal',
    'krishna': 'Makthal',
    
    'shadnagar': 'Shadnagar',
    'farooqnagar': 'Shadnagar',
    'kothur': 'Shadnagar',
    'kondurg': 'Shadnagar',
    
    'sircilla': 'Sircilla',
    'gajwel': 'Gajwel',
    'siddipet': 'Siddipet',
    'dubbak': 'Dubbak',
    'husnabad': 'Husnabad',
    
    'warangal': 'Warangal East',
    'hanamkonda': 'Warangal West',
    'kazipet': 'Warangal West',
    
    'karimnagar': 'Karimnagar',
    'huzurabad': 'Huzurabad',
    'choppadandi': 'Choppadandi',
    'manakondur': 'Manakondur',
    
    'nalgonda': 'Nalgonda',
    'munugode': 'Munugode',
    'devarakonda': 'Devarakonda',
    'miryalaguda': 'Miryalaguda',
    
    'khammam': 'Khammam',
    'palair': 'Palair',
    'madhira': 'Madhira',
    'wyra': 'Wyra',
    'sathupalli': 'Sathupalli',
    
    'suryapet': 'Suryapet',
    'kodad': 'Kodad',
    'huzurnagar': 'Huzurnagar',
    
    'nizamabad': 'Nizamabad Urban',
    'bodhan': 'Bodhan',
    'armoor': 'Armoor',
    
    'kamareddy': 'Kamareddy',
    'banswada': 'Banswada',
    'yellareddy': 'Yellareddy',
    
    'mancherial': 'Mancherial',
    'bellampalli': 'Bellampalli',
    'chennur': 'Chennur',
    
    'adilabad': 'Adilabad',
    'nirmal': 'Nirmal',
    'bhainsa': 'Mudhole'
};

/**
 * Finds all leaders associated with a constituency name.
 * Matches against the 'constituency' field in politicalData.js.
 */
const getLeadersForConstituency = (constituencyName) => {
    if (!constituencyName) return [];
    const normalized = constituencyName.trim().toLowerCase();
    
    return ALL_LEADERS.filter(leader => {
        if (!leader.constituency) return false;
        return leader.constituency.toLowerCase() === normalized;
    });
};

/**
 * Resolves a raw location string (city/town) to a canonical Assembly Constituency.
 */
const resolveLocationToConstituency = (locationName) => {
    if (!locationName) return null;
    const lower = locationName.trim().toLowerCase();
    
    // 1. Direct match: If the location is already a constituency name
    const directMatch = ALL_LEADERS.find(l => l.constituency && l.constituency.toLowerCase() === lower);
    if (directMatch) return directMatch.constituency;
    
    // 2. Keyword mapping: Check TOWN_TO_CONSTITUENCY
    for (const [town, constituency] of Object.entries(TOWN_TO_CONSTITUENCY)) {
        if (lower.includes(town)) return constituency;
    }
    
    return null;
};

module.exports = {
    getLeadersForConstituency,
    resolveLocationToConstituency
};
