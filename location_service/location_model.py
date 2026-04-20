"""
Location extraction model — maps Indian place names, landmarks, neighborhoods,
districts, temples, tourist spots, and state names to the nearest city with coordinates.
"""

import re

# ═══════════════════════════════════════════════════════════════
#                   CITY COORDINATES
# ═══════════════════════════════════════════════════════════════
INDIA_CITY_COORDS = {
    'Mumbai':              (19.076, 72.877),
    'Delhi':               (28.613, 77.209),
    'Bangalore':           (12.971, 77.594),
    'Chennai':             (13.082, 80.270),
    'Hyderabad':           (17.385, 78.486),
    'Kolkata':             (22.572, 88.363),
    'Pune':                (18.520, 73.856),
    'Ahmedabad':           (23.022, 72.571),
    'Jaipur':              (26.912, 75.787),
    'Surat':               (21.170, 72.831),
    'Lucknow':             (26.846, 80.946),
    'Kanpur':              (26.449, 80.331),
    'Nagpur':              (21.145, 79.088),
    'Visakhapatnam':       (17.686, 83.218),
    'Indore':              (22.719, 75.857),
    'Bhopal':              (23.259, 77.412),
    'Patna':               (25.594, 85.137),
    'Vadodara':            (22.307, 73.181),
    'Ludhiana':            (30.901, 75.857),
    'Agra':                (27.176, 78.008),
    'Nashik':              (19.997, 73.789),
    'Varanasi':            (25.317, 82.973),
    'Coimbatore':          (11.016, 76.955),
    'Kochi':               (9.931, 76.267),
    'Chandigarh':          (30.733, 76.779),
    'Guwahati':            (26.144, 91.736),
    'Bhubaneswar':         (20.296, 85.824),
    'Mysuru':              (12.295, 76.639),
    'Thiruvananthapuram':  (8.524, 76.936),
    'Amritsar':            (31.633, 74.872),
    'Ranchi':              (23.343, 85.309),
    'Jodhpur':             (26.292, 73.016),
    'Vijayawada':          (16.506, 80.648),
    'Madurai':             (9.925, 78.120),
    'Srinagar':            (34.083, 74.797),
    'Tirupati':            (13.628, 79.419),
    'Goa':                 (15.299, 74.124),
    'Shimla':              (31.104, 77.173),
    'Dehradun':            (30.316, 78.032),
    'Mangalore':           (12.914, 74.856),
    'Raipur':              (21.251, 81.629),
    'Jammu':               (32.726, 74.857),
    'Udaipur':             (24.585, 73.712),
    'Rishikesh':           (30.086, 78.267),
    'Ayodhya':             (26.796, 82.194),

    # ── Telangana Districts & Major Towns ──
    'Warangal':            (17.978, 79.599),
    'Karimnagar':          (18.436, 79.129),
    'Nizamabad':           (18.672, 78.094),
    'Khammam':             (17.247, 80.151),
    'Nalgonda':            (17.050, 79.267),
    'Adilabad':            (19.667, 78.532),
    'Mahabubnagar':        (16.737, 77.985),
    'Rangareddy':          (17.295, 78.340),
    'Medak':               (17.769, 78.261),
    'Sangareddy':          (17.624, 78.087),
    'Siddipet':            (18.101, 78.852),
    'Vikarabad':           (17.338, 77.904),
    'Kodangal':            (17.112, 77.620),
    'Narayanpet':          (16.745, 77.496),
    'Jadcherla':           (16.763, 78.137),
    'Devarkadra':          (16.690, 77.898),
    'Makthal':             (16.503, 77.567),
    'Shadnagar':           (17.072, 78.206),
    'Suryapet':            (17.139, 79.638),
    'Kamareddy':           (18.320, 78.334),
    'Jagtial':             (18.794, 78.912),
    'Peddapalli':          (18.617, 79.383),
    'Mancherial':          (18.867, 79.450),
    'Nirmal':              (19.097, 78.344),
    'Wanaparthy':          (16.361, 78.062),
    'Nagarkurnool':        (16.482, 78.313),
    'Jangaon':             (17.726, 79.184),
    'Mahabubabad':         (17.602, 80.000),
    'Medchal':             (17.629, 78.481),
    'Sircilla':            (18.384, 78.838),
    'Secunderabad':        (17.434, 78.502),
}

_city_names = list(INDIA_CITY_COORDS.keys())

# ═══════════════════════════════════════════════════════════════
#              LOCATION KEYWORDS → CITY MAPPING
# ═══════════════════════════════════════════════════════════════
# Maps landmarks, temples, neighborhoods, districts, tourist spots,
# states, and alternate spellings to the nearest city.
# ALL keys must be lowercase.
LOCATION_KEYWORDS = {
    # --- Alternate city names ---
    'bengaluru': 'Bangalore',
    'bombay': 'Mumbai',
    'calcutta': 'Kolkata',
    'madras': 'Chennai',
    'trivandrum': 'Thiruvananthapuram',
    'cochin': 'Kochi',
    'mysore': 'Mysuru',
    'benaras': 'Varanasi',
    'kashi': 'Varanasi',
    'vizag': 'Visakhapatnam',
    'baroda': 'Vadodara',
    'panaji': 'Goa',
    'panjim': 'Goa',
    'mangaluru': 'Mangalore',
    'shimoga': 'Mangalore',
    'shivamogga': 'Mangalore',
    'hubli': 'Mangalore',
    'dharwad': 'Mangalore',
    'udupi': 'Mangalore',

    # --- Tirupati / Tirumala region ---
    'tirumala': 'Tirupati',
    'tirumale': 'Tirupati',
    'tirupathi': 'Tirupati',
    'tiruchanur': 'Tirupati',
    'srivari mettu': 'Tirupati',
    'balaji temple': 'Tirupati',
    'venkateswara': 'Tirupati',
    'venkateshwara': 'Tirupati',
    'ttd': 'Tirupati',
    'sri vari': 'Tirupati',
    'srivaru': 'Tirupati',
    'alipiri': 'Tirupati',
    'govinda': 'Tirupati',
    'ezhu malai': 'Tirupati',
    'seven hills': 'Tirupati',
    'chittoor': 'Tirupati',
    'srikalahasti': 'Tirupati',
    'nellore': 'Tirupati',
    'kadapa': 'Tirupati',
    'annamayya': 'Tirupati',

    # --- Hyderabad landmarks ---
    # (Moved to Telangana comprehensive section below)

    # --- Delhi landmarks ---
    'red fort': 'Delhi',
    'lal qila': 'Delhi',
    'india gate': 'Delhi',
    'qutub minar': 'Delhi',
    'qutb minar': 'Delhi',
    'chandni chowk': 'Delhi',
    'connaught place': 'Delhi',
    'cp delhi': 'Delhi',
    'janpath': 'Delhi',
    'rashtrapati bhavan': 'Delhi',
    'parliament house': 'Delhi',
    'nehru place': 'Delhi',
    'karol bagh': 'Delhi',
    'sarojini nagar': 'Delhi',
    'hauz khas': 'Delhi',
    'saket': 'Delhi',
    'dwarka': 'Delhi',
    'rohini': 'Delhi',
    'pitampura': 'Delhi',
    'noida': 'Delhi',
    'gurgaon': 'Delhi',
    'gurugram': 'Delhi',
    'faridabad': 'Delhi',
    'ghaziabad': 'Delhi',
    'ncr': 'Delhi',
    'lotus temple': 'Delhi',
    'akshardham delhi': 'Delhi',
    'jama masjid delhi': 'Delhi',
    'lodhi garden': 'Delhi',
    'pragati maidan': 'Delhi',
    'rajouri garden': 'Delhi',
    'lajpat nagar': 'Delhi',
    'jnu': 'Delhi',

    # --- Mumbai landmarks ---
    'gateway of india': 'Mumbai',
    'marine drive': 'Mumbai',
    'juhu beach': 'Mumbai',
    'bandra': 'Mumbai',
    'andheri': 'Mumbai',
    'worli': 'Mumbai',
    'colaba': 'Mumbai',
    'dadar': 'Mumbai',
    'borivali': 'Mumbai',
    'thane': 'Mumbai',
    'navi mumbai': 'Mumbai',
    'powai': 'Mumbai',
    'goregaon': 'Mumbai',
    'malad': 'Mumbai',
    'kandivali': 'Mumbai',
    'ghatkopar': 'Mumbai',
    'chembur': 'Mumbai',
    'dharavi': 'Mumbai',
    'bkc': 'Mumbai',
    'lower parel': 'Mumbai',
    'churchgate': 'Mumbai',
    'cst': 'Mumbai',
    'siddhivinayak': 'Mumbai',
    'mount mary': 'Mumbai',
    'haji ali': 'Mumbai',
    'elephanta caves': 'Mumbai',
    'virar': 'Mumbai',
    'panvel': 'Mumbai',
    'kharghar': 'Mumbai',
    'vasai': 'Mumbai',

    # --- Bangalore landmarks ---
    'cubbon park': 'Bangalore',
    'lalbagh': 'Bangalore',
    'mg road bangalore': 'Bangalore',
    'koramangala': 'Bangalore',
    'indiranagar': 'Bangalore',
    'whitefield': 'Bangalore',
    'electronic city': 'Bangalore',
    'hsr layout': 'Bangalore',
    'jp nagar': 'Bangalore',
    'jayanagar': 'Bangalore',
    'yelahanka': 'Bangalore',
    'marathahalli': 'Bangalore',
    'sarjapur': 'Bangalore',
    'hebbal': 'Bangalore',
    'majestic': 'Bangalore',
    'vidhana soudha': 'Bangalore',
    'ulsoor': 'Bangalore',
    'rajajinagar': 'Bangalore',
    'banashankari': 'Bangalore',
    'kempegowda': 'Bangalore',

    # --- Chennai landmarks ---
    'marina beach': 'Chennai',
    'kapaleeshwarar': 'Chennai',
    'mylapore': 'Chennai',
    'mount road': 'Chennai',
    'anna nagar': 'Chennai',
    'adyar': 'Chennai',
    't nagar': 'Chennai',
    'guindy': 'Chennai',
    'velachery': 'Chennai',
    'tambaram': 'Chennai',
    'egmore': 'Chennai',
    'nungambakkam': 'Chennai',
    'mahabalipuram': 'Chennai',
    'pondicherry': 'Chennai',
    'kanchipuram': 'Chennai',
    'vellore': 'Chennai',
    'sholinganallur': 'Chennai',
    'omr': 'Chennai',
    'ecr': 'Chennai',
    'besant nagar': 'Chennai',

    # --- Kolkata landmarks ---
    'victoria memorial': 'Kolkata',
    'howrah bridge': 'Kolkata',
    'howrah': 'Kolkata',
    'park street': 'Kolkata',
    'salt lake': 'Kolkata',
    'new town kolkata': 'Kolkata',
    'esplanade': 'Kolkata',
    'dakshineswar': 'Kolkata',
    'dum dum': 'Kolkata',
    'jadavpur': 'Kolkata',
    'ballygunge': 'Kolkata',
    'sealdah': 'Kolkata',
    'kalighat': 'Kolkata',
    'belur math': 'Kolkata',
    'rajarhat': 'Kolkata',

    # --- Agra ---
    'taj mahal': 'Agra',
    'fatehpur sikri': 'Agra',
    'agra fort': 'Agra',
    'mathura': 'Agra',
    'vrindavan': 'Agra',

    # --- Jaipur ---
    'hawa mahal': 'Jaipur',
    'amer fort': 'Jaipur',
    'amber fort': 'Jaipur',
    'city palace jaipur': 'Jaipur',
    'nahargarh': 'Jaipur',
    'jal mahal': 'Jaipur',
    'albert hall': 'Jaipur',
    'ajmer': 'Jaipur',
    'pushkar': 'Jaipur',

    # --- Varanasi ---
    'dashashwamedh ghat': 'Varanasi',
    'ganga ghat': 'Varanasi',
    'sarnath': 'Varanasi',
    'banaras': 'Varanasi',
    'kashi vishwanath': 'Varanasi',

    # --- Pune ---
    'shaniwar wada': 'Pune',
    'aga khan palace': 'Pune',
    'koregaon park': 'Pune',
    'hinjewadi': 'Pune',
    'kharadi': 'Pune',
    'hadapsar': 'Pune',
    'wakad': 'Pune',
    'baner': 'Pune',
    'pimpri chinchwad': 'Pune',
    'lonavala': 'Pune',
    'khandala': 'Pune',

    # --- Goa ---
    'calangute': 'Goa',
    'baga beach': 'Goa',
    'anjuna': 'Goa',
    'palolem': 'Goa',
    'basilica of bom jesus': 'Goa',
    'old goa': 'Goa',
    'mapusa': 'Goa',
    'margao': 'Goa',
    'vasco': 'Goa',
    'dona paula': 'Goa',
    'arambol': 'Goa',
    'morjim': 'Goa',
    'dudhsagar': 'Goa',

    # --- Shimla / Himachal ---
    'manali': 'Shimla',
    'dharamshala': 'Shimla',
    'mcleodganj': 'Shimla',
    'kullu': 'Shimla',
    'kasol': 'Shimla',
    'spiti': 'Shimla',
    'rohtang': 'Shimla',
    'himachal pradesh': 'Shimla',
    'himachal': 'Shimla',

    # --- Dehradun / Uttarakhand ---
    'mussoorie': 'Dehradun',
    'haridwar': 'Dehradun',
    'uttarakhand': 'Dehradun',
    'nainital': 'Dehradun',
    'jim corbett': 'Dehradun',
    'valley of flowers': 'Dehradun',
    'kedarnath': 'Rishikesh',
    'badrinath': 'Rishikesh',
    'char dham': 'Rishikesh',
    'uttarkashi': 'Rishikesh',
    'devprayag': 'Rishikesh',

    # --- Srinagar / J&K ---
    'dal lake': 'Srinagar',
    'gulmarg': 'Srinagar',
    'pahalgam': 'Srinagar',
    'sonamarg': 'Srinagar',
    'kashmir': 'Srinagar',
    'leh': 'Srinagar',
    'ladakh': 'Srinagar',

    # --- Vijayawada / AP ---
    'amaravati': 'Vijayawada',
    'guntur': 'Vijayawada',
    'rajahmundry': 'Vijayawada',
    'eluru': 'Vijayawada',
    'ongole': 'Vijayawada',
    'prakasam': 'Vijayawada',
    'krishna district': 'Vijayawada',
    'andhra pradesh': 'Vijayawada',

    # --- Bhubaneswar / Odisha ---
    'puri': 'Bhubaneswar',
    'jagannath': 'Bhubaneswar',
    'konark': 'Bhubaneswar',
    'sun temple': 'Bhubaneswar',
    'lingaraj': 'Bhubaneswar',
    'odisha': 'Bhubaneswar',
    'orissa': 'Bhubaneswar',
    'cuttack': 'Bhubaneswar',

    # --- Patna / Bihar ---
    'nalanda': 'Patna',
    'bodh gaya': 'Patna',
    'gaya': 'Patna',
    'bihar': 'Patna',
    'rajgir': 'Patna',
    'muzaffarpur': 'Patna',

    # --- Lucknow / UP ---
    'bara imambara': 'Lucknow',
    'rumi darwaza': 'Lucknow',
    'hazratganj': 'Lucknow',
    'gomti nagar': 'Lucknow',
    'uttar pradesh': 'Lucknow',
    'allahabad': 'Lucknow',
    'prayagraj': 'Lucknow',

    # --- Ranchi / Jharkhand ---
    'jharkhand': 'Ranchi',
    'jamshedpur': 'Ranchi',
    'bokaro': 'Ranchi',
    'deoghar': 'Ranchi',
    'baba baidyanath': 'Ranchi',

    # --- Guwahati / Northeast ---
    'kamakhya': 'Guwahati',
    'assam': 'Guwahati',
    'kaziranga': 'Guwahati',
    'shillong': 'Guwahati',
    'meghalaya': 'Guwahati',
    'tezpur': 'Guwahati',
    'jorhat': 'Guwahati',
    'dibrugarh': 'Guwahati',
    'nagaland': 'Guwahati',
    'manipur': 'Guwahati',
    'mizoram': 'Guwahati',
    'tripura': 'Guwahati',
    'arunachal': 'Guwahati',
    'imphal': 'Guwahati',
    'kohima': 'Guwahati',
    'aizawl': 'Guwahati',
    'agartala': 'Guwahati',
    'itanagar': 'Guwahati',
    'sikkim': 'Guwahati',
    'gangtok': 'Guwahati',

    # --- Raipur / Chhattisgarh ---
    'chhattisgarh': 'Raipur',
    'bilaspur': 'Raipur',
    'durg': 'Raipur',
    'bhilai': 'Raipur',

    # --- Bhopal / MP ---
    'madhya pradesh': 'Bhopal',
    'sanchi stupa': 'Bhopal',
    'sanchi': 'Bhopal',
    'ujjain': 'Bhopal',
    'mahakaleshwar': 'Bhopal',
    'jabalpur': 'Bhopal',
    'gwalior': 'Bhopal',
    'khajuraho': 'Bhopal',

    # --- Ahmedabad / Gujarat ---
    'sabarmati ashram': 'Ahmedabad',
    'sabarmati': 'Ahmedabad',
    'gujarat': 'Ahmedabad',
    'gandhinagar': 'Ahmedabad',
    'somnath': 'Ahmedabad',
    'dwarka temple': 'Ahmedabad',
    'kutch': 'Ahmedabad',
    'rann of kutch': 'Ahmedabad',
    'statue of unity': 'Ahmedabad',
    'rajkot': 'Ahmedabad',

    # --- Kochi / Kerala ---
    'alleppey': 'Kochi',
    'alappuzha': 'Kochi',
    'kerala': 'Kochi',
    'munnar': 'Kochi',
    'backwaters': 'Kochi',
    'fort kochi': 'Kochi',
    'thrissur': 'Kochi',
    'wayanad': 'Kochi',
    'thekkady': 'Kochi',
    'periyar': 'Kochi',
    'sabarimala': 'Kochi',
    'guruvayur': 'Kochi',
    'calicut': 'Kochi',
    'kozhikode': 'Kochi',
    'palakkad': 'Kochi',
    'kannur': 'Kochi',

    # --- Madurai / Tamil Nadu (non-Chennai) ---
    'meenakshi temple': 'Madurai',
    'meenakshi amman': 'Madurai',
    'rameshwaram': 'Madurai',
    'rameswaram': 'Madurai',
    'kodaikanal': 'Madurai',
    'ooty': 'Coimbatore',
    'nilgiris': 'Coimbatore',
    'thanjavur': 'Madurai',
    'trichy': 'Madurai',
    'tiruchirappalli': 'Madurai',
    'tanjore': 'Madurai',
    'salem': 'Coimbatore',
    'erode': 'Coimbatore',
    'tirunelveli': 'Madurai',
    'kanyakumari': 'Madurai',
    'tamil nadu': 'Chennai',

    # --- Udaipur / Rajasthan ---
    'city of lakes': 'Udaipur',
    'lake pichola': 'Udaipur',
    'mount abu': 'Udaipur',
    'rajasthan': 'Jaipur',
    'bikaner': 'Jodhpur',
    'jaisalmer': 'Jodhpur',
    'mehrangarh': 'Jodhpur',

    # --- Jammu ---
    'vaishno devi': 'Jammu',
    'katra': 'Jammu',
    'mata vaishno devi': 'Jammu',

    # --- Ayodhya ---
    'ram mandir': 'Ayodhya',
    'ram temple': 'Ayodhya',
    'ram lalla': 'Ayodhya',

    # ═══════════════════════════════════════════════════════════
    #          TELANGANA — COMPREHENSIVE LOCATION DATABASE
    # ═══════════════════════════════════════════════════════════

    'telangana': 'Hyderabad',

    # ── Hyderabad District ──
    'charminar': 'Hyderabad',
    'golconda': 'Hyderabad',
    'hussain sagar': 'Hyderabad',
    'tankbund': 'Hyderabad',
    'tank bund': 'Hyderabad',
    'hitech city': 'Hyderabad',
    'hitec city': 'Hyderabad',
    'gachibowli': 'Hyderabad',
    'madhapur': 'Hyderabad',
    'secunderabad': 'Secunderabad',
    'kukatpally': 'Hyderabad',
    'ameerpet': 'Hyderabad',
    'begumpet': 'Hyderabad',
    'banjara hills': 'Hyderabad',
    'jubilee hills': 'Hyderabad',
    'film nagar': 'Hyderabad',
    'paradise biryani': 'Hyderabad',
    'ramoji film city': 'Hyderabad',
    'shamshabad': 'Hyderabad',
    'miyapur': 'Hyderabad',
    'lb nagar': 'Hyderabad',
    'uppal': 'Hyderabad',
    'dilsukhnagar': 'Hyderabad',
    'osmania': 'Hyderabad',
    'salar jung': 'Hyderabad',
    'abids': 'Hyderabad',
    'mehdipatnam': 'Hyderabad',
    'tolichowki': 'Hyderabad',
    'malakpet': 'Hyderabad',
    'nampally': 'Hyderabad',
    'koti': 'Hyderabad',
    'nacharam': 'Hyderabad',
    'malkajgiri': 'Medchal',
    'kompally': 'Medchal',
    'alwal': 'Medchal',
    'boduppal': 'Medchal',
    'ghatkesar': 'Medchal',
    'patancheru': 'Sangareddy',
    'rajiv gandhi international airport': 'Hyderabad',
    'rgia': 'Hyderabad',
    'hyderabad metro': 'Hyderabad',
    'chikkadpally': 'Hyderabad',
    'musheerabad': 'Hyderabad',
    'gandipet': 'Hyderabad',
    'shamirpet': 'Hyderabad',
    'kapra': 'Hyderabad',
    'amberpet': 'Hyderabad',
    'saroornagar': 'Hyderabad',

    # ── Rangareddy District ──
    'rangareddy': 'Rangareddy',
    'ranga reddy': 'Rangareddy',
    'shadnagar': 'Shadnagar',
    'ibrahimpatnam': 'Rangareddy',
    'chevella': 'Rangareddy',
    'tandur': 'Rangareddy',
    'maheshwaram': 'Rangareddy',
    'kandukur': 'Rangareddy',
    'farooqnagar': 'Rangareddy',
    'kothur': 'Rangareddy',
    'shabad': 'Rangareddy',

    # ── Mahabubnagar District ──
    'mahabubnagar': 'Mahabubnagar',
    'mahbubnagar': 'Mahabubnagar',
    'palem': 'Mahabubnagar',
    'addakal': 'Mahabubnagar',
    'balanagar mbnr': 'Mahabubnagar',
    'devarkadra': 'Devarkadra',
    'jadcherla': 'Jadcherla',
    'koilkonda': 'Mahabubnagar',
    'gandeed': 'Mahabubnagar',

    # ── Narayanpet District ──
    'narayanpet': 'Narayanpet',
    'makthal': 'Makthal',
    'utkoor': 'Narayanpet',
    'marikal': 'Narayanpet',
    'damaragidda': 'Narayanpet',
    'narva': 'Narayanpet',

    # ── Vikarabad District ──
    'vikarabad': 'Vikarabad',
    'kodangal': 'Kodangal',
    'bomraspet': 'Kodangal',
    'doultabad': 'Kodangal',
    'parigi': 'Vikarabad',
    'mominpet': 'Vikarabad',
    'nawabpet': 'Vikarabad',
    'bantaram': 'Vikarabad',
    'pudur': 'Vikarabad',

    # ── Wanaparthy District ──
    'wanaparthy': 'Wanaparthy',
    'pebbair': 'Wanaparthy',
    'gopalpet': 'Wanaparthy',
    'atmakur wanaparthy': 'Wanaparthy',

    # ── Nagarkurnool District ──
    'nagarkurnool': 'Nagarkurnool',
    'kalwakurthy': 'Nagarkurnool',
    'achampet': 'Nagarkurnool',
    'kollapur': 'Nagarkurnool',

    # ── Warangal District ──
    'warangal': 'Warangal',
    'warangal fort': 'Warangal',
    'thousand pillar temple': 'Warangal',
    'hanamkonda': 'Warangal',
    'kazipet': 'Warangal',
    'hasanparthy': 'Warangal',
    'narsampet': 'Warangal',
    'parkal': 'Warangal',
    'wardhannapet': 'Warangal',
    'warangal rural': 'Warangal',

    # ── Karimnagar District ──
    'karimnagar': 'Karimnagar',
    'huzurabad': 'Karimnagar',
    'choppadandi': 'Karimnagar',
    'manakondur': 'Karimnagar',
    'vemulawada': 'Karimnagar',
    'sircilla': 'Sircilla',
    'rajanna sircilla': 'Sircilla',

    # ── Nizamabad District ──
    'nizamabad': 'Nizamabad',
    'bodhan': 'Nizamabad',
    'armoor': 'Nizamabad',
    'kamareddy': 'Kamareddy',
    'yellareddy': 'Kamareddy',
    'banswada': 'Kamareddy',

    # ── Khammam District ──
    'khammam': 'Khammam',
    'kothagudem': 'Khammam',
    'bhadrachalam': 'Khammam',
    'yellandu': 'Khammam',
    'sathupalli': 'Khammam',
    'madhira': 'Khammam',
    'wyra': 'Khammam',
    'paloncha': 'Khammam',

    # ── Nalgonda District ──
    'nalgonda': 'Nalgonda',
    'miryalaguda': 'Nalgonda',
    'devarakonda': 'Nalgonda',
    'bhongir': 'Nalgonda',
    'suryapet': 'Suryapet',
    'kodad': 'Suryapet',
    'huzurnagar': 'Suryapet',

    # ── Medak District ──
    'medak': 'Medak',
    'siddipet': 'Siddipet',
    'dubbak': 'Siddipet',
    'gajwel': 'Siddipet',
    'sangareddy': 'Sangareddy',
    'zaheerabad': 'Sangareddy',
    'narayankhed': 'Sangareddy',
    'andole': 'Sangareddy',

    # ── Adilabad District ──
    'adilabad': 'Adilabad',
    'mancherial': 'Mancherial',
    'nirmal': 'Nirmal',
    'bellampalli': 'Mancherial',
    'asifabad': 'Adilabad',
    'utnoor': 'Adilabad',
    'mudhole': 'Nirmal',
    'bhainsa': 'Nirmal',
    'luxettipet': 'Mancherial',

    # ── Jagtial District ──
    'jagtial': 'Jagtial',
    'koratla': 'Jagtial',
    'metpally': 'Jagtial',
    'dharmapuri jagtial': 'Jagtial',

    # ── Peddapalli District ──
    'peddapalli': 'Peddapalli',
    'ramagundam': 'Peddapalli',
    'godavarikhani': 'Peddapalli',
    'sulthanabad': 'Peddapalli',
    'manthani': 'Peddapalli',

    # ── Jangaon District ──
    'jangaon': 'Jangaon',
    'ghanpur': 'Jangaon',
    'palakurthi': 'Jangaon',
    'zaffergadh': 'Jangaon',

    # ── Mahabubabad District ──
    'mahabubabad': 'Mahabubabad',
    'dornakal': 'Mahabubabad',
    'thorrur': 'Mahabubabad',
    'maripeda': 'Mahabubabad',

    # ── Medchal-Malkajgiri District ──
    'medchal': 'Medchal',
    'medchal malkajgiri': 'Medchal',
    'quthbullapur': 'Medchal',
    'keesara': 'Medchal',
    'shamirpet deer park': 'Medchal',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — POLICE / COMMISSIONERATES
    # ═══════════════════════════════════════════════════════════
    'hyderabad police': 'Hyderabad',
    'cyberabad police': 'Hyderabad',
    'rachakonda police': 'Hyderabad',
    'warangal police': 'Warangal',
    'karimnagar police': 'Karimnagar',
    'nizamabad police': 'Nizamabad',
    'khammam police': 'Khammam',
    'nalgonda police': 'Nalgonda',
    'adilabad police': 'Adilabad',
    'mahabubnagar police': 'Mahabubnagar',
    'sangareddy police': 'Sangareddy',
    'siddipet police': 'Siddipet',
    'telangana police': 'Hyderabad',
    'telangana dgp': 'Hyderabad',
    'cp hyderabad': 'Hyderabad',
    'cp cyberabad': 'Hyderabad',
    'cp rachakonda': 'Hyderabad',
    'sp warangal': 'Warangal',
    'sp karimnagar': 'Karimnagar',
    'sp nizamabad': 'Nizamabad',
    'sp khammam': 'Khammam',
    'sp nalgonda': 'Nalgonda',
    'sp mahabubnagar': 'Mahabubnagar',
    'sp adilabad': 'Adilabad',
    'sp sangareddy': 'Sangareddy',
    'sp siddipet': 'Siddipet',
    'sp medak': 'Medak',
    'sp suryapet': 'Suryapet',
    'sp kamareddy': 'Kamareddy',
    'sp jagtial': 'Jagtial',
    'sp peddapalli': 'Peddapalli',
    'sp mancherial': 'Mancherial',
    'sp nirmal': 'Nirmal',
    'sp nagarkurnool': 'Nagarkurnool',
    'sp wanaparthy': 'Wanaparthy',
    'sp vikarabad': 'Vikarabad',
    'sp jangaon': 'Jangaon',
    'sp mahabubabad': 'Mahabubabad',
    'sp medchal': 'Medchal',
    'sp sircilla': 'Sircilla',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — RELIGIOUS / HISTORICAL PLACES
    # ═══════════════════════════════════════════════════════════
    'charminar mosque': 'Hyderabad',
    'mecca masjid': 'Hyderabad',
    'birla mandir hyderabad': 'Hyderabad',
    'chilkur balaji': 'Hyderabad',
    'keesaragutta temple': 'Medchal',
    'yadagirigutta': 'Nalgonda',
    'yadadri': 'Nalgonda',
    'bhadrachalam temple': 'Khammam',
    'sri rama temple bhadrachalam': 'Khammam',
    'basara saraswati temple': 'Nirmal',
    'basara': 'Nirmal',
    'alampur': 'Mahabubnagar',
    'jogulamba temple': 'Mahabubnagar',
    'pillalamarri': 'Mahabubnagar',
    'kolanupaka': 'Nalgonda',
    'thousand pillar temple warangal': 'Warangal',
    'warangal fort ruins': 'Warangal',
    'kakatiya kala thoranam': 'Warangal',
    'ramappa temple': 'Warangal',
    'medak cathedral': 'Medak',
    'medak church': 'Medak',
    'qutb shahi tombs': 'Hyderabad',
    'paigah tombs': 'Hyderabad',
    'falaknuma palace': 'Hyderabad',
    'golconda fort': 'Hyderabad',
    'nizam museum': 'Hyderabad',
    'salar jung museum': 'Hyderabad',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — RIVERS / GEOGRAPHY
    # ═══════════════════════════════════════════════════════════
    'river godavari telangana': 'Mancherial',
    'godavari telangana': 'Mancherial',
    'river krishna telangana': 'Nalgonda',
    'krishna river telangana': 'Nalgonda',
    'river musi': 'Hyderabad',
    'musi river': 'Hyderabad',
    'nagarjuna sagar': 'Nalgonda',
    'nagarjunasagar': 'Nalgonda',
    'srisailam': 'Nagarkurnool',
    'jurala project': 'Mahabubnagar',
    'singur dam': 'Sangareddy',
    'srsp': 'Nizamabad',
    'pochampadu': 'Nizamabad',
    'kaleshwaram': 'Peddapalli',
    'kaleshwaram project': 'Peddapalli',
    'palamuru rangareddy lift': 'Mahabubnagar',
    'telangana region': 'Hyderabad',
    'deccan plateau': 'Hyderabad',
    'nallamala hills': 'Nagarkurnool',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — UNIVERSITIES / INSTITUTIONS
    # ═══════════════════════════════════════════════════════════
    'osmania university': 'Hyderabad',
    'ou hyderabad': 'Hyderabad',
    'university of hyderabad': 'Hyderabad',
    'uoh': 'Hyderabad',
    'jntu hyderabad': 'Hyderabad',
    'jntuh': 'Hyderabad',
    'iiit hyderabad': 'Hyderabad',
    'iiith': 'Hyderabad',
    'iit hyderabad': 'Hyderabad',
    'iith': 'Hyderabad',
    'bits hyderabad': 'Hyderabad',
    'isb hyderabad': 'Hyderabad',
    'nalsar': 'Hyderabad',
    'nims hyderabad': 'Hyderabad',
    'gandhi hospital': 'Hyderabad',
    'gandhi medical college': 'Hyderabad',
    'kakatiya university': 'Warangal',
    'ku warangal': 'Warangal',
    'nit warangal': 'Warangal',
    'nitw': 'Warangal',
    'satavahana university': 'Karimnagar',
    'telangana university': 'Nizamabad',
    'palamuru university': 'Mahabubnagar',
    'mahatma gandhi university nalgonda': 'Nalgonda',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — HIGHWAYS / TRANSPORT
    # ═══════════════════════════════════════════════════════════
    'nh 44 telangana': 'Hyderabad',
    'nh 65 telangana': 'Hyderabad',
    'orr hyderabad': 'Hyderabad',
    'outer ring road hyderabad': 'Hyderabad',
    'pvnr expressway': 'Hyderabad',
    'nehru outer ring road': 'Hyderabad',
    'hyderabad metro rail': 'Hyderabad',
    'mmts hyderabad': 'Hyderabad',
    'secunderabad junction': 'Hyderabad',
    'nampally station': 'Hyderabad',
    'kachiguda station': 'Hyderabad',
    'hyderabad airport': 'Hyderabad',
    'warangal station': 'Warangal',
    'karimnagar bus stand': 'Karimnagar',
    'mahabubnagar bus stand': 'Mahabubnagar',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — IT / INDUSTRIAL ZONES
    # ═══════════════════════════════════════════════════════════
    'hitec city': 'Hyderabad',
    'financial district hyderabad': 'Hyderabad',
    'nanakramguda': 'Hyderabad',
    'raidurg': 'Hyderabad',
    'kondapur': 'Hyderabad',
    'kokapet': 'Hyderabad',
    'telangana secretariat': 'Hyderabad',
    'brkr bhavan': 'Hyderabad',
    'mindspace': 'Hyderabad',
    'cyberabad': 'Hyderabad',
    'raheja mindspace': 'Hyderabad',
    'wipro circle': 'Hyderabad',
    'infosys hyderabad': 'Hyderabad',
    'drd': 'Hyderabad',
    'genome valley': 'Medchal',
    'hardware park': 'Rangareddy',
    'fab city': 'Rangareddy',
    'pharma city': 'Rangareddy',
    'industrial area jeedimetla': 'Hyderabad',
    'nacharam industrial area': 'Hyderabad',
    'balanagar industrial area': 'Hyderabad',
    'pashamylaram': 'Sangareddy',
    'bollaram': 'Sangareddy',

    # ═══════════════════════════════════════════════════════════
    #     TELANGANA — ALTERNATE SPELLINGS & VARIATIONS
    # ═══════════════════════════════════════════════════════════
    'hyd': 'Hyderabad',
    'wgl': 'Warangal',
    'kmm': 'Khammam',
    'nlg': 'Nalgonda',
    'mbnr': 'Mahabubnagar',
    'krmngr': 'Karimnagar',
    'nzb': 'Nizamabad',
    'adl': 'Adilabad',
    'rr dist': 'Rangareddy',
    'mahbubnagar city': 'Mahabubnagar',
    'mahabubnagar city': 'Mahabubnagar',
    'warangal city': 'Warangal',
    'karimnagar city': 'Karimnagar',
    'nizamabad city': 'Nizamabad',
    'khammam city': 'Khammam',
    'adilabad city': 'Adilabad',

    # --- General / state-level ---
    'maharashtra': 'Mumbai',
    'west bengal': 'Kolkata',
    'andhra': 'Vijayawada',
    'andhra pradesh': 'Vijayawada',
}

# Short keywords (<=3 chars) that need word-boundary matching to avoid false positives
_SHORT_KEYWORDS = {k for k in LOCATION_KEYWORDS if len(k) <= 3}


def _scan_text_for_location(text: str) -> tuple:
    """
    Core scanner: check a single text string against city names + keywords.
    Returns (city, keyword_matched, confidence) or (None, None, None).
    """
    if not text or not text.strip():
        return None, None, None

    text_lower = text.lower()

    # Pass 1: Direct city name match (highest priority, most reliable)
    for city in _city_names:
        city_lower = city.lower()
        if len(city_lower) <= 3:
            if re.search(r'\b' + re.escape(city_lower) + r'\b', text_lower):
                return city, city_lower, 'city_name'
        else:
            if city_lower in text_lower:
                return city, city_lower, 'city_name'

    # Pass 2: Keyword match (landmarks, neighborhoods, states, etc.)
    for keyword, city in LOCATION_KEYWORDS.items():
        if keyword in _SHORT_KEYWORDS:
            if re.search(r'\b' + re.escape(keyword) + r'\b', text_lower):
                return city, keyword, 'keyword_match'
        else:
            if keyword in text_lower:
                return city, keyword, 'keyword_match'

    return None, None, None


def _build_result(city, keyword_matched, confidence):
    """Build a standard result dict."""
    if city:
        lat, lng = INDIA_CITY_COORDS[city]
        return {
            'location_found': True,
            'city': city,
            'keyword_matched': keyword_matched,
            'lat': lat,
            'lng': lng,
            'confidence': confidence,
        }
    return {
        'location_found': False,
        'city': None,
        'keyword_matched': None,
        'lat': None,
        'lng': None,
        'confidence': None,
    }


def extract_location(text: str) -> dict:
    """
    Extract location from a single text by matching against known Indian place names.
    Simple API — just pass the text.

    Args:
        text: The input text (tweet, post, grievance content)

    Returns:
        dict with keys: location_found, city, keyword_matched, lat, lng, confidence
    """
    city, keyword, confidence = _scan_text_for_location(text)
    return _build_result(city, keyword, confidence)


def extract_location_multi(
    text: str = '',
    user_location: str = '',
    user_bio: str = '',
    hashtags: str = '',
) -> dict:
    """
    Extract location using the same 3-step cascade as TweetPulse India:

    Step 1: Check the user's profile location field (most reliable — e.g. "Bengaluru, India")
    Step 2: Check the main post/tweet text for location keywords
    Step 3: Check hashtags and user bio as fallback
    (No random assignment — returns location_found=False if nothing matches)

    This mirrors _parse_tweet_universal() in fetch_tweets.py exactly.

    Args:
        text:          Main content text (tweet body / grievance text)
        user_location: User's profile location string (from Twitter/platform)
        user_bio:      User's bio/description text
        hashtags:      Space-separated hashtags or hashtag string

    Returns:
        dict with keys: location_found, city, keyword_matched, lat, lng, confidence, source
    """
    # Step 1: User profile location (highest confidence)
    if user_location:
        city, keyword, confidence = _scan_text_for_location(user_location)
        if city:
            result = _build_result(city, keyword, 'user_location')
            result['source'] = 'user_location'
            return result

    # Step 2: Main post text
    if text:
        city, keyword, confidence = _scan_text_for_location(text)
        if city:
            result = _build_result(city, keyword, confidence)
            result['source'] = 'text'
            return result

    # Step 3: Hashtags
    if hashtags:
        # Normalize: "#Mumbai #traffic" → "mumbai traffic"
        clean_hashtags = hashtags.replace('#', ' ')
        city, keyword, confidence = _scan_text_for_location(clean_hashtags)
        if city:
            result = _build_result(city, keyword, 'hashtag')
            result['source'] = 'hashtag'
            return result

    # Step 4: User bio (lowest priority)
    if user_bio:
        city, keyword, confidence = _scan_text_for_location(user_bio)
        if city:
            result = _build_result(city, keyword, 'user_bio')
            result['source'] = 'user_bio'
            return result

    result = _build_result(None, None, None)
    result['source'] = None
    return result
