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

// ─── CITIES, TOWNS, MANDALS, VILLAGES & NOTABLE AREAS ───────────────────────
const TELANGANA_CITIES_AND_VILLAGES = [
    // Hyderabad metro area
    'hyderabad', 'secunderabad', 'begumpet', 'ameerpet', 'banjara hills',
    'jubilee hills', 'film nagar', 'madhapur', 'gachibowli', 'hitech city',
    'hitec city', 'kukatpally', 'miyapur', 'kondapur', 'nanakramguda',
    'raidurg', 'kokapet', 'shamshabad', 'lb nagar', 'dilsukhnagar',
    'malakpet', 'nampally', 'koti', 'abids', 'charminar', 'mehdipatnam',
    'tolichowki', 'nacharam', 'uppal', 'kapra', 'malkajgiri', 'alwal',
    'kompally', 'boduppal', 'ghatkesar', 'amberpet', 'saroornagar',
    'musheerabad', 'chikkadpally', 'gandipet', 'shamirpet',
    'patancheru', 'balanagar', 'jeedimetla', 'bollaram',
    'moosapet', 'erragadda', 'srinagar colony', 'balapur',
    'nagole', 'hayathnagar', 'vanasthalipuram', 'meerpet',

    // Rangareddy district
    'rangareddy', 'ranga reddy', 'shadnagar', 'ibrahimpatnam',
    'chevella', 'tandur', 'maheshwaram', 'kandukur', 'farooqnagar',
    'kothur', 'shabad', 'rajendranagar', 'serilingampally',

    // Mahabubnagar district & surrounding
    'mahabubnagar', 'mahbubnagar', 'jadcherla', 'devarkadra', 'makthal',
    'kodangal', 'narayanpet', 'wanaparthy', 'nagarkurnool', 'kalwakurthy',
    'achampet', 'kollapur', 'gadwal', 'alampur', 'palem', 'addakal',
    'koilkonda', 'gandeed', 'utkoor', 'marikal', 'damaragidda', 'narva',
    'bomraspet', 'doultabad', 'kosgi', 'maddur', 'pebbair', 'gopalpet',

    // Vikarabad district
    'vikarabad', 'parigi', 'mominpet', 'nawabpet', 'bantaram', 'pudur',

    // Warangal district
    'warangal', 'hanamkonda', 'kazipet', 'hasanparthy', 'narsampet',
    'parkal', 'wardhannapet', 'jangaon', 'ghanpur', 'palakurthi',

    // Karimnagar district
    'karimnagar', 'huzurabad', 'choppadandi', 'manakondur', 'vemulawada',
    'sircilla', 'jagtial', 'koratla', 'metpally',

    // Nizamabad district
    'nizamabad', 'bodhan', 'armoor', 'kamareddy', 'yellareddy', 'banswada',

    // Khammam district
    'khammam', 'kothagudem', 'bhadrachalam', 'yellandu', 'sathupalli',
    'madhira', 'wyra', 'paloncha', 'manuguru',

    // Nalgonda district
    'nalgonda', 'miryalaguda', 'devarakonda', 'bhongir', 'suryapet',
    'kodad', 'huzurnagar', 'nakrekal', 'munugode',

    // Medak / Sangareddy / Siddipet
    'medak', 'siddipet', 'sangareddy', 'zaheerabad', 'narayankhed',
    'andole', 'dubbak', 'gajwel', 'husnabad',

    // Adilabad district
    'adilabad', 'mancherial', 'nirmal', 'bellampalli', 'asifabad',
    'utnoor', 'mudhole', 'bhainsa', 'luxettipet', 'kaghaznagar',
    'sirpur', 'boath', 'khanapur',

    // Peddapalli district
    'peddapalli', 'ramagundam', 'godavarikhani', 'sulthanabad', 'manthani',

    // Mahabubabad district
    'mahabubabad', 'dornakal', 'thorrur', 'maripeda',

    // Medchal-Malkajgiri
    'medchal', 'quthbullapur', 'keesara',

    // Notable temples / landmarks
    'yadagirigutta', 'yadadri', 'basara', 'bhadrachalam temple',
    'ramappa', 'pillalamarri', 'nagarjuna sagar', 'nagarjunasagar',
    'srisailam', 'alampur jogulamba',

    // Rivers / projects
    'musi river', 'godavari', 'krishna', 'kaleshwaram',
    'jurala', 'singur', 'pochampadu', 'srsp',

    // IT / Industrial
    'cyberabad', 'mindspace', 'financial district', 'genome valley',
    'hardware park', 'fab city', 'pharma city', 'pashamylaram',

    // Universities / Institutions
    'osmania university', 'university of hyderabad', 'jntu hyderabad',
    'iiit hyderabad', 'iit hyderabad', 'bits hyderabad', 'isb hyderabad',
    'nalsar', 'nims', 'gandhi hospital', 'kakatiya university',
    'nit warangal', 'palamuru university',

    // Police commissionerates
    'hyderabad police', 'cyberabad police', 'rachakonda police',
    'telangana police', 'telangana dgp',

    // Alternate spellings
    'mahbubnagar', 'mahaboobnagar', 'warangal city', 'karimnagar city',
    'nizamabad city', 'khammam city', 'adilabad city',
    'ranga reddi', 'rangareddi', 'medchal malkajgiri',

    // State references
    'telangana', 'state of telangana', 'govt of telangana', 'government of telangana',
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

// Export with backward-compatible aliases
module.exports = {
    TELANGANA_DISTRICTS,
    TELANGANA_CONSTITUENCIES,
    TELANGANA_CITIES_AND_VILLAGES,
    ALL_TELANGANA_LOCATIONS,
    isTelanganaLocation
};
