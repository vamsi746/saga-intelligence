/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║      TELANGANA LOCATION DATABASE — COMPREHENSIVE LOCATION DETECTION     ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Comprehensive list of every district, city, town, mandal, constituency,║
 * ║  and notable area in Telangana, India.                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ─── 33 DISTRICTS OF TELANGANA ──────────────────────────────────────────────
const TELANGANA_DISTRICTS = [
    'hyderabad', 'rangareddy', 'ranga reddy', 'medchal-malkajgiri', 'medchal',
    'sangareddy', 'medak', 'siddipet', 'kamareddy', 'nizamabad',
    'jagtial', 'karimnagar', 'rajanna sircilla', 'sircilla', 'peddapalli',
    'mancherial', 'adilabad', 'kumuram bheem asifabad', 'nirmal',
    'warangal', 'hanamkonda', 'jangaon', 'mahabubabad',
    'khammam', 'bhadradri kothagudem', 'suryapet', 'nalgonda',
    'mahabubnagar', 'nagarkurnool', 'wanaparthy', 'narayanpet',
    'jogulamba gadwal', 'vikarabad', 'yadadri bhuvanagiri'
];

// ─── ALL 119 ASSEMBLY CONSTITUENCIES ─────────────────────────────────────────
const TELANGANA_CONSTITUENCIES = [
    // Adilabad district
    'adilabad', 'boath', 'mudhole', 'nirmal', 'khanapur',
    // Karimnagar district
    'karimnagar', 'choppadandi', 'manakondur', 'huzurabad',
    // Jagtial district
    'jagtial', 'koratla', 'dharmapuri',
    // Peddapalli district
    'peddapalli', 'manthani', 'ramagundam',
    // Mancherial district
    'mancherial', 'bellampalli',
    // Nizamabad district
    'nizamabad urban', 'nizamabad rural', 'bodhan', 'armoor',
    // Kamareddy district
    'kamareddy', 'yellareddy', 'banswada',
    // Rajanna Sircilla district
    'sircilla', 'vemulawada',
    // Medak district
    'medak', 'narsapur',
    // Siddipet district
    'siddipet', 'dubbak', 'gajwel', 'husnabad',
    // Sangareddy district
    'sangareddy', 'zaheerabad', 'narayankhed', 'andole', 'patancheru',
    // Medchal-Malkajgiri district
    'medchal', 'malkajgiri', 'quthbullapur', 'kukatpally', 'uppal',
    // Hyderabad district
    'musheerabad', 'amberpet', 'khairatabad', 'jubilee hills', 'sanathnagar',
    'nampally', 'karwan', 'goshamahal', 'charminar', 'chandrayangutta',
    'yakutpura', 'bahadurpura', 'secunderabad', 'secunderabad cantonment',
    // Rangareddy district
    'chevella', 'pargi', 'vikarabad', 'tandur', 'shadnagar', 'kalwakurthy',
    'ibrahimpatnam', 'lb nagar', 'maheshwaram', 'rajendranagar', 'serilingampally',
    // Vikarabad district
    'kodangal', 'narayanpet',
    // Mahabubnagar district
    'mahabubnagar', 'jadcherla', 'devarkadra', 'makthal',
    // Wanaparthy district
    'wanaparthy', 'gadwal',
    // Nagarkurnool district
    'nagarkurnool', 'achampet', 'kollapur',
    // Nalgonda district
    'nalgonda', 'munugode', 'devarakonda', 'nakrekal',
    // Suryapet district
    'suryapet', 'kodad', 'huzurnagar',
    // Yadadri Bhuvanagiri district
    'bhongir', 'alair',
    // Warangal / Hanamkonda district
    'warangal west', 'warangal east', 'wardhannapet', 'parkal', 'narsampet',
    // Jangaon district
    'jangaon', 'station ghanpur', 'palakurthi',
    // Mahabubabad district
    'mahabubabad', 'dornakal', 'thorrur',
    // Khammam district
    'khammam', 'palair', 'madhira', 'wyra', 'sathupalli', 'yellandu',
    // Bhadradri Kothagudem
    'bhadrachalam', 'pinapaka', 'kothagudem',
    // Asifabad district
    'asifabad', 'sirpur', 'kaghaznagar'
];

// ─── TOWN TO CONSTITUENCY MAPPING ───────────────────────────────────────────
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
    'krishna mandal': 'Makthal',
    
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

// ─── CITIES, TOWNS, MANDALS, VILLAGES & NOTABLE AREAS ───────────────────────
const TELANGANA_CITIES_AND_VILLAGES = [
    ...Object.keys(TOWN_TO_CONSTITUENCY),
    // Hyderabad metro area
    'hyderabad', 'film nagar', 'hitech city', 'hitec city', 'kondapur', 'nanakramguda',
    'raidurg', 'kokapet', 'shamshabad', 'malakpet', 'nampally', 'koti', 'abids', 'charminar', 'mehdipatnam',
    'tolichowki', 'nacharam', 'kapra', 'alwal', 'kompally', 'boduppal', 'ghatkesar', 'amberpet', 'saroornagar',
    'musheerabad', 'chikkadpally', 'gandipet', 'shamirpet', 'patancheru', 'balanagar', 'jeedimetla', 'bollaram',
    'moosapet', 'erragadda', 'srinagar colony', 'balapur', 'nagole', 'hayathnagar', 'vanasthalipuram', 'meerpet',
    'shabad', 'rajendranagar', 'serilingampally', 'palem', 'gandeed', 'narva', 'pudur', 'hasanparthy', 'ghanpur',
    'paloncha', 'manuguru', 'keesara', 'yadagirigutta', 'yadadri', 'basara', 'bhadrachalam temple', 'ramappa',
    'pillalamarri', 'nagarjuna sagar', 'nagarjunasagar', 'srisailam', 'alampur jogulamba', 'musi river', 'godavari',
    'krishna mandal', 'krishna river', 'kaleshwaram', 'jurala', 'singur', 'pochampadu', 'srsp', 'cyberabad', 'mindspace', 'financial district',
    'genome valley', 'hardware park', 'fab city', 'pharma city', 'pashamylaram', 'osmania university',
    'university of hyderabad', 'jntu hyderabad', 'iiit hyderabad', 'iit hyderabad', 'bits hyderabad', 'isb hyderabad',
    'nalsar', 'nims', 'gandhi hospital', 'kakatiya university', 'nit warangal', 'palamuru university', 'hyderabad police',
    'cyberabad police', 'rachakonda police', 'telangana police', 'telangana dgp', 'mahbubnagar', 'mahaboobnagar',
    'warangal city', 'karimnagar city', 'nizamabad city', 'khammam city', 'adilabad city', 'ranga reddi', 'rangareddi',
    'medchal malkajgiri', 'telangana', 'state of telangana', 'govt of telangana', 'government of telangana',
    'telangana india', 'telangana state'
];

// ─── Build a single unified Set for O(1) lookups ────────────────────────────
const ALL_TELANGANA_LOCATIONS = new Set();

const addToSet = (arr) => {
    for (const item of arr) {
        const lower = item.toLowerCase().trim();
        if (lower) ALL_TELANGANA_LOCATIONS.add(lower);
    }
};

addToSet(TELANGANA_DISTRICTS);
addToSet(TELANGANA_CONSTITUENCIES);
addToSet(TELANGANA_CITIES_AND_VILLAGES);

/**
 * Check if a location name matches the Telangana location database.
 * @param {string} name
 * @returns {boolean}
 */
const isTelanganaLocation = (name) => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    if (ALL_TELANGANA_LOCATIONS.has(lower)) return true;
    if (lower.includes('telangana')) return true;
    if (lower.includes('hyderabad')) return true;
    if (lower.includes('secunderabad')) return true;
    if (lower.includes('warangal')) return true;
    if (lower.includes('karimnagar')) return true;
    if (lower.includes('nizamabad')) return true;
    if (lower.includes('khammam')) return true;
    if (lower.includes('mahabubnagar')) return true;
    if (lower.includes('mahbubnagar')) return true;
    if (lower.includes('nalgonda')) return true;
    if (lower.includes('adilabad')) return true;
    if (lower.includes('rangareddy')) return true;
    if (lower.includes('sangareddy')) return true;
    if (lower.includes('siddipet')) return true;
    return false;
};

module.exports = {
    TELANGANA_DISTRICTS,
    TELANGANA_CONSTITUENCIES,
    TELANGANA_CITIES_AND_VILLAGES,
    TOWN_TO_CONSTITUENCY,
    ALL_TELANGANA_LOCATIONS,
    isTelanganaLocation
};
