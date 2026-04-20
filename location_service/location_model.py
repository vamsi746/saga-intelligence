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

    # ── Punjab Districts & Major Towns ──
    'Sangrur':             (30.245, 75.841),
    'Patiala':             (30.340, 76.386),
    'Bathinda':            (30.210, 74.945),
    'Jalandhar':           (31.326, 75.576),
    'Mohali':              (30.704, 76.717),
    'Pathankot':           (32.274, 75.652),
    'Hoshiarpur':          (31.532, 75.911),
    'Kapurthala':          (31.380, 75.382),
    'Moga':                (30.816, 75.174),
    'Barnala':             (30.381, 75.547),
    'Faridkot':            (30.676, 74.758),
    'Muktsar':             (30.474, 74.516),
    'Mansa':               (29.999, 75.394),
    'Ferozepur':           (30.933, 74.613),
    'Fazilka':             (30.404, 74.028),
    'Rupnagar':            (30.966, 76.533),
    'Nawanshahr':          (31.124, 76.116),
    'Gurdaspur':           (32.041, 75.402),
    'Tarn Taran':          (31.451, 74.927),
    'Malerkotla':          (30.528, 75.882),
    'Fatehgarh Sahib':     (30.645, 76.392),
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
    'charminar': 'Hyderabad',
    'golconda': 'Hyderabad',
    'hussain sagar': 'Hyderabad',
    'tankbund': 'Hyderabad',
    'tank bund': 'Hyderabad',
    'hitech city': 'Hyderabad',
    'hitec city': 'Hyderabad',
    'gachibowli': 'Hyderabad',
    'madhapur': 'Hyderabad',
    'secunderabad': 'Hyderabad',
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
    'warangal': 'Hyderabad',
    'karimnagar': 'Hyderabad',
    'nizamabad': 'Hyderabad',
    'khammam': 'Hyderabad',
    'nalgonda': 'Hyderabad',
    'sangareddy': 'Hyderabad',
    'telangana': 'Hyderabad',
    'osmania': 'Hyderabad',
    'salar jung': 'Hyderabad',

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

    # --- Chandigarh / Punjab / Haryana ---
    'punjab': 'Chandigarh',
    'haryana': 'Chandigarh',
    'mohali': 'Mohali',
    'panchkula': 'Chandigarh',
    'rock garden chandigarh': 'Chandigarh',
    'sukhna lake': 'Chandigarh',
    'elante mall': 'Chandigarh',
    'sector 17 chandigarh': 'Chandigarh',
    'chandigarh airport': 'Chandigarh',
    'isbt chandigarh': 'Chandigarh',
    'pgimer': 'Chandigarh',
    'pgi chandigarh': 'Chandigarh',

    # ═══════════════════════════════════════════════════════════
    #          PUNJAB — COMPREHENSIVE LOCATION DATABASE
    # ═══════════════════════════════════════════════════════════

    # ── Amritsar District ──
    'amritsar': 'Amritsar',
    'golden temple': 'Amritsar',
    'harmandir sahib': 'Amritsar',
    'darbar sahib': 'Amritsar',
    'jallianwala bagh': 'Amritsar',
    'jallianwala': 'Amritsar',
    'wagah border': 'Amritsar',
    'wagah': 'Amritsar',
    'attari': 'Amritsar',
    'attari border': 'Amritsar',
    'ajnala': 'Amritsar',
    'majitha': 'Amritsar',
    'jandiala guru': 'Amritsar',
    'verka': 'Amritsar',
    'chheharta': 'Amritsar',
    'rajasansi': 'Amritsar',
    'amritsar airport': 'Amritsar',
    'sri guru ram das jee international airport': 'Amritsar',
    'baba bakala': 'Amritsar',
    'rayya': 'Amritsar',
    'lopoke': 'Amritsar',
    'chogawan': 'Amritsar',
    'amritsar rural': 'Amritsar',
    'amritsar commissionerate': 'Amritsar',
    'akal takht': 'Amritsar',
    'partition museum': 'Amritsar',
    'gobindgarh fort': 'Amritsar',
    'ram bagh garden': 'Amritsar',
    'hall gate': 'Amritsar',
    'town hall amritsar': 'Amritsar',
    'lawrence road amritsar': 'Amritsar',
    'ranjit avenue': 'Amritsar',

    # ── Ludhiana District ──
    'ludhiana': 'Ludhiana',
    'ludhiana rural': 'Ludhiana',
    'ludhiana commissionerate': 'Ludhiana',
    'khanna': 'Ludhiana',
    'samrala': 'Ludhiana',
    'jagraon': 'Ludhiana',
    'raikot': 'Ludhiana',
    'payal': 'Ludhiana',
    'sahnewal': 'Ludhiana',
    'doraha': 'Ludhiana',
    'machhiwara': 'Ludhiana',
    'mullanpur dakha': 'Ludhiana',
    'sudhar': 'Ludhiana',
    'sidhwan bet': 'Ludhiana',
    'dehlon': 'Ludhiana',
    'issewal': 'Ludhiana',
    'gill road': 'Ludhiana',
    'ferozepur road ludhiana': 'Ludhiana',
    'ludhiana junction': 'Ludhiana',
    'clock tower ludhiana': 'Ludhiana',
    'guru nanak stadium': 'Ludhiana',
    'punjab agricultural university': 'Ludhiana',
    'pau ludhiana': 'Ludhiana',
    'christian medical college ludhiana': 'Ludhiana',
    'cmc ludhiana': 'Ludhiana',
    'dmch ludhiana': 'Ludhiana',
    'ldh': 'Ludhiana',

    # ── Jalandhar District ──
    'jalandhar': 'Jalandhar',
    'jalandhar rural': 'Jalandhar',
    'jalandhar west': 'Jalandhar',
    'jalandhar east': 'Jalandhar',
    'jalandhar cantonment': 'Jalandhar',
    'jalandhar cantt': 'Jalandhar',
    'nakodar': 'Jalandhar',
    'phillaur': 'Jalandhar',
    'goraya': 'Jalandhar',
    'adampur': 'Jalandhar',
    'kartarpur': 'Jalandhar',
    'kartarpur corridor': 'Jalandhar',
    'kartarpur sahib': 'Jalandhar',
    'shahkot': 'Jalandhar',
    'nurmahal': 'Jalandhar',
    'lohian khas': 'Jalandhar',
    'bhogpur': 'Jalandhar',
    'mehatpur': 'Jalandhar',
    'apra': 'Jalandhar',
    'jamsher': 'Jalandhar',
    'bootan mandi': 'Jalandhar',
    'basti sheikh': 'Jalandhar',
    'model town jalandhar': 'Jalandhar',
    'nit jalandhar': 'Jalandhar',
    'dav university jalandhar': 'Jalandhar',

    # ── Patiala District ──
    'patiala': 'Patiala',
    'patiala rural': 'Patiala',
    'rajpura': 'Patiala',
    'nabha': 'Patiala',
    'samana': 'Patiala',
    'patran': 'Patiala',
    'ghanaur': 'Patiala',
    'sanaur': 'Patiala',
    'shutrana': 'Patiala',
    'bhunerheri': 'Patiala',
    'tripuri': 'Patiala',
    'banur': 'Patiala',
    'ghaggar': 'Patiala',
    'shekhupura': 'Patiala',
    'rajpura town': 'Patiala',
    'qila mubarak': 'Patiala',
    'bahadurgarh fort patiala': 'Patiala',
    'sheesh mahal patiala': 'Patiala',
    'moti bagh palace': 'Patiala',
    'thapar university': 'Patiala',
    'thapar institute': 'Patiala',
    'punjabi university': 'Patiala',
    'rajindra hospital': 'Patiala',
    'government medical college patiala': 'Patiala',
    'yadavindra public school': 'Patiala',

    # ── Bathinda District ──
    'bathinda': 'Bathinda',
    'bhatinda': 'Bathinda',
    'bti': 'Bathinda',
    'rampura phul': 'Bathinda',
    'rampura': 'Bathinda',
    'talwandi sabo': 'Bathinda',
    'takht damdama sahib': 'Bathinda',
    'damdama sahib': 'Bathinda',
    'maur': 'Bathinda',
    'maur mandi': 'Bathinda',
    'goniana': 'Bathinda',
    'goniana mandi': 'Bathinda',
    'sangat': 'Bathinda',
    'nathana': 'Bathinda',
    'bhagta bhai ka': 'Bathinda',
    'phul': 'Bathinda',
    'kot shamir': 'Bathinda',
    'bathinda fort': 'Bathinda',
    'qila mubarak bathinda': 'Bathinda',
    'bathinda refinery': 'Bathinda',
    'thermal plant bathinda': 'Bathinda',
    'aiims bathinda': 'Bathinda',
    'bathinda cantt': 'Bathinda',
    'bathinda cantonment': 'Bathinda',

    # ── Sangrur District ──
    'sangrur': 'Sangrur',
    'sangrur city': 'Sangrur',
    'dhuri': 'Sangrur',
    'ahmedgarh': 'Sangrur',
    'sunam': 'Sangrur',
    'moonak': 'Sangrur',
    'dirba': 'Sangrur',
    'lehragaga': 'Sangrur',
    'lehra gaga': 'Sangrur',
    'sherpur': 'Sangrur',
    'longowal': 'Sangrur',
    'chhajli': 'Sangrur',
    'khanauri': 'Sangrur',
    'andana': 'Sangrur',
    'sangrur police': 'Sangrur',
    'ssp sangrur': 'Sangrur',
    'bhawanigarh': 'Sangrur',
    'ratia': 'Sangrur',

    # ── Mohali (SAS Nagar) District ──
    'mohali': 'Mohali',
    'sas nagar': 'Mohali',
    'sahibzada ajit singh nagar': 'Mohali',
    'zirakpur': 'Mohali',
    'kharar': 'Mohali',
    'derabassi': 'Mohali',
    'dera bassi': 'Mohali',
    'lalru': 'Mohali',
    'kurali': 'Mohali',
    'mohali phase': 'Mohali',
    'sector 68 mohali': 'Mohali',
    'mohali stadium': 'Mohali',
    'is bindra stadium': 'Mohali',
    'pca stadium': 'Mohali',
    'mohali airport': 'Mohali',
    'chandigarh university': 'Mohali',
    'iiser mohali': 'Mohali',
    'niper mohali': 'Mohali',
    'it city mohali': 'Mohali',
    'quark city': 'Mohali',

    # ── Pathankot District ──
    'pathankot': 'Pathankot',
    'pathankot cantt': 'Pathankot',
    'pathankot cantonment': 'Pathankot',
    'dalhousie': 'Pathankot',
    'sujanpur': 'Pathankot',
    'narot jaimal singh': 'Pathankot',
    'shahpur kandi': 'Pathankot',
    'mamun': 'Pathankot',
    'dharkalan': 'Pathankot',
    'pathankot air force station': 'Pathankot',

    # ── Hoshiarpur District ──
    'hoshiarpur': 'Hoshiarpur',
    'dasuya': 'Hoshiarpur',
    'mukerian': 'Hoshiarpur',
    'garhshankar': 'Hoshiarpur',
    'tanda': 'Hoshiarpur',
    'tanda urmar': 'Hoshiarpur',
    'hajipur': 'Hoshiarpur',
    'chuharpur': 'Hoshiarpur',
    'mahilpur': 'Hoshiarpur',
    'hariana': 'Hoshiarpur',
    'bullowal': 'Hoshiarpur',
    'talwara': 'Hoshiarpur',
    'sham chaurasi': 'Hoshiarpur',
    'bhunga': 'Hoshiarpur',

    # ── Kapurthala District ──
    'kapurthala': 'Kapurthala',
    'phagwara': 'Kapurthala',
    'sultanpur lodhi': 'Kapurthala',
    'dhilwan': 'Kapurthala',
    'bhulath': 'Kapurthala',
    'begowal': 'Kapurthala',
    'nadala': 'Kapurthala',
    'jalandhar bypass kapurthala': 'Kapurthala',
    'moorish mosque kapurthala': 'Kapurthala',
    'panch mandir kapurthala': 'Kapurthala',
    'pushpa gujral science city': 'Kapurthala',
    'lovely professional university': 'Kapurthala',
    'lpu': 'Kapurthala',

    # ── Moga District ──
    'moga': 'Moga',
    'nihal singh wala': 'Moga',
    'baghapurana': 'Moga',
    'dharamkot': 'Moga',
    'badni kalan': 'Moga',
    'kokri kalan': 'Moga',
    'ajitwal': 'Moga',
    'bughipura': 'Moga',
    'lande ke': 'Moga',
    'mehna': 'Moga',

    # ── Barnala District ──
    'barnala': 'Barnala',
    'tapa': 'Barnala',
    'bhadaur': 'Barnala',
    'sehna': 'Barnala',
    'dhanaula': 'Barnala',
    'mehal kalan': 'Barnala',
    'handiaya': 'Barnala',
    'barnala mandi': 'Barnala',

    # ── Faridkot District ──
    'faridkot': 'Faridkot',
    'kotkapura': 'Faridkot',
    'kot kapura': 'Faridkot',
    'jaitu': 'Faridkot',
    'sadiq': 'Faridkot',
    'baja khana': 'Faridkot',
    'guru gobind singh medical college': 'Faridkot',
    'ggs medical college faridkot': 'Faridkot',
    'faridkot fort': 'Faridkot',

    # ── Muktsar District ──
    'muktsar': 'Muktsar',
    'sri muktsar sahib': 'Muktsar',
    'muktsar sahib': 'Muktsar',
    'giddarbaha': 'Muktsar',
    'malout': 'Muktsar',
    'bariwala': 'Muktsar',
    'lambi': 'Muktsar',
    'lakhewali': 'Muktsar',
    'muktsar battle': 'Muktsar',
    'gurudwara shaheed ganj muktsar': 'Muktsar',

    # ── Mansa District ──
    'mansa': 'Mansa',
    'budhlada': 'Mansa',
    'sardulgarh': 'Mansa',
    'bareta': 'Mansa',
    'joga': 'Mansa',
    'bhikhi': 'Mansa',
    'boha': 'Mansa',
    'jhunir': 'Mansa',

    # ── Ferozepur District ──
    'ferozepur': 'Ferozepur',
    'firozpur': 'Ferozepur',
    'ferozepur cantt': 'Ferozepur',
    'ferozepur cantonment': 'Ferozepur',
    'zira': 'Ferozepur',
    'guru har sahai': 'Ferozepur',
    'mamdot': 'Ferozepur',
    'makhu': 'Ferozepur',
    'ferozepur city': 'Ferozepur',
    'hussainiwala': 'Ferozepur',
    'hussainiwala border': 'Ferozepur',
    'national martyrs memorial hussainiwala': 'Ferozepur',
    'ferozepur military station': 'Ferozepur',

    # ── Fazilka District ──
    'fazilka': 'Fazilka',
    'abohar': 'Fazilka',
    'jalalabad': 'Fazilka',
    'jalalabad west': 'Fazilka',
    'arniwala sheikh subhan': 'Fazilka',
    'khuian sarwar': 'Fazilka',
    'balluana': 'Fazilka',

    # ── Rupnagar (Ropar) District ──
    'rupnagar': 'Rupnagar',
    'ropar': 'Rupnagar',
    'roopnagar': 'Rupnagar',
    'anandpur sahib': 'Rupnagar',
    'sri anandpur sahib': 'Rupnagar',
    'nangal': 'Rupnagar',
    'morinda': 'Rupnagar',
    'chamkaur sahib': 'Rupnagar',
    'kiratpur sahib': 'Rupnagar',
    'nurpur bedi': 'Rupnagar',
    'bhakra dam': 'Rupnagar',
    'bhakra nangal': 'Rupnagar',
    'gobind sagar lake': 'Rupnagar',
    'virasat e khalsa': 'Rupnagar',
    'khalsa heritage complex': 'Rupnagar',

    # ── Nawanshahr (SBS Nagar) District ──
    'nawanshahr': 'Nawanshahr',
    'shaheed bhagat singh nagar': 'Nawanshahr',
    'sbs nagar': 'Nawanshahr',
    'banga': 'Nawanshahr',
    'balachaur': 'Nawanshahr',
    'aur': 'Nawanshahr',
    'rahon': 'Nawanshahr',
    'saroya': 'Nawanshahr',

    # ── Gurdaspur District ──
    'gurdaspur': 'Gurdaspur',
    'batala': 'Gurdaspur',
    'dera baba nanak': 'Gurdaspur',
    'dinanagar': 'Gurdaspur',
    'dina nagar': 'Gurdaspur',
    'qadian': 'Gurdaspur',
    'kahnuwan': 'Gurdaspur',
    'dhariwal': 'Gurdaspur',
    'fatehgarh churian': 'Gurdaspur',
    'kalanaur': 'Gurdaspur',
    'sri hargobindpur': 'Gurdaspur',
    'gurdaspur jail': 'Gurdaspur',

    # ── Tarn Taran District ──
    'tarn taran': 'Tarn Taran',
    'tarntaran': 'Tarn Taran',
    'tarn taran sahib': 'Tarn Taran',
    'khadoor sahib': 'Tarn Taran',
    'khadur sahib': 'Tarn Taran',
    'patti': 'Tarn Taran',
    'bhikhiwind': 'Tarn Taran',
    'harike': 'Tarn Taran',
    'harike pattan': 'Tarn Taran',
    'harike wetland': 'Tarn Taran',
    'goindwal sahib': 'Tarn Taran',
    'goindwal': 'Tarn Taran',
    'naushera pannuan': 'Tarn Taran',
    'valtoha': 'Tarn Taran',
    'chohla sahib': 'Tarn Taran',

    # ── Malerkotla District ──
    'malerkotla': 'Malerkotla',
    'amargarh': 'Malerkotla',

    # ── Fatehgarh Sahib District ──
    'fatehgarh sahib': 'Fatehgarh Sahib',
    'sirhind': 'Fatehgarh Sahib',
    'sirhind fatehgarh sahib': 'Fatehgarh Sahib',
    'bassi pathana': 'Fatehgarh Sahib',
    'amloh': 'Fatehgarh Sahib',
    'mandi gobindgarh': 'Fatehgarh Sahib',
    'khera': 'Fatehgarh Sahib',
    'fatehgarh sahib gurudwara': 'Fatehgarh Sahib',
    'aam khas bagh': 'Fatehgarh Sahib',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — POLICE RANGES / COMMISSIONERATES
    # ═══════════════════════════════════════════════════════════
    'ludhiana police': 'Ludhiana',
    'amritsar police': 'Amritsar',
    'jalandhar police': 'Jalandhar',
    'patiala police': 'Patiala',
    'bathinda police': 'Bathinda',
    'ferozepur police': 'Ferozepur',
    'mohali police': 'Mohali',
    'sangrur police': 'Sangrur',
    'moga police': 'Moga',
    'barnala police': 'Barnala',
    'muktsar police': 'Muktsar',
    'mansa police': 'Mansa',
    'fazilka police': 'Fazilka',
    'faridkot police': 'Faridkot',
    'hoshiarpur police': 'Hoshiarpur',
    'kapurthala police': 'Kapurthala',
    'pathankot police': 'Pathankot',
    'gurdaspur police': 'Gurdaspur',
    'tarn taran police': 'Tarn Taran',
    'rupnagar police': 'Rupnagar',
    'ropar police': 'Rupnagar',
    'nawanshahr police': 'Nawanshahr',
    'fatehgarh sahib police': 'Fatehgarh Sahib',
    'malerkotla police': 'Malerkotla',
    'punjab police': 'Chandigarh',
    'ssp ludhiana': 'Ludhiana',
    'ssp amritsar': 'Amritsar',
    'ssp jalandhar': 'Jalandhar',
    'ssp patiala': 'Patiala',
    'ssp bathinda': 'Bathinda',
    'ssp sangrur': 'Sangrur',
    'ssp mohali': 'Mohali',
    'ssp ferozepur': 'Ferozepur',
    'ssp moga': 'Moga',
    'ssp muktsar': 'Muktsar',
    'ssp mansa': 'Mansa',
    'ssp fazilka': 'Fazilka',
    'ssp faridkot': 'Faridkot',
    'ssp barnala': 'Barnala',
    'ssp hoshiarpur': 'Hoshiarpur',
    'ssp kapurthala': 'Kapurthala',
    'ssp pathankot': 'Pathankot',
    'ssp gurdaspur': 'Gurdaspur',
    'ssp tarn taran': 'Tarn Taran',
    'ssp rupnagar': 'Rupnagar',
    'ssp ropar': 'Rupnagar',
    'ssp nawanshahr': 'Nawanshahr',
    'ssp fatehgarh sahib': 'Fatehgarh Sahib',
    'cp ludhiana': 'Ludhiana',
    'cp amritsar': 'Amritsar',
    'cp jalandhar': 'Jalandhar',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — RELIGIOUS / HISTORICAL PLACES
    # ═══════════════════════════════════════════════════════════
    'takht sri keshgarh sahib': 'Rupnagar',
    'keshgarh sahib': 'Rupnagar',
    'takht damdama sahib': 'Bathinda',
    'akal takht': 'Amritsar',
    'takht sri harmandir sahib patna': 'Patna',
    'gurdwara bangla sahib': 'Delhi',
    'gurdwara fatehgarh sahib': 'Fatehgarh Sahib',
    'gurdwara amb sahib': 'Mohali',
    'dera beas': 'Amritsar',
    'radha soami satsang beas': 'Amritsar',
    'beas': 'Amritsar',
    'durgiana temple': 'Amritsar',
    'ram tirath': 'Amritsar',
    'gurudwara ber sahib': 'Kapurthala',
    'gurudwara manji sahib': 'Ludhiana',
    'shaheed bhagat singh museum': 'Nawanshahr',
    'bhagat singh memorial': 'Nawanshahr',
    'khatkar kalan': 'Nawanshahr',
    'jang e azadi memorial': 'Jalandhar',
    'wonderland jalandhar': 'Jalandhar',
    'devi talab mandir': 'Jalandhar',
    'imam nasir mosque': 'Jalandhar',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — RIVERS / CANALS / GEOGRAPHY
    # ═══════════════════════════════════════════════════════════
    'river sutlej': 'Ludhiana',
    'sutlej': 'Ludhiana',
    'river beas': 'Amritsar',
    'river ravi': 'Pathankot',
    'ravi river': 'Pathankot',
    'river ghaggar': 'Patiala',
    'ghaggar river': 'Patiala',
    'harike barrage': 'Tarn Taran',
    'bhakra dam': 'Rupnagar',
    'indira gandhi canal': 'Ferozepur',
    'sirhind canal': 'Fatehgarh Sahib',
    'ropar headworks': 'Rupnagar',
    'shivalik hills punjab': 'Rupnagar',
    'shivalik foothills': 'Hoshiarpur',
    'kandi area': 'Hoshiarpur',
    'malwa region': 'Bathinda',
    'majha region': 'Amritsar',
    'doaba region': 'Jalandhar',
    'doaba': 'Jalandhar',
    'majha': 'Amritsar',
    'malwa': 'Bathinda',
    'powadh': 'Fatehgarh Sahib',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — UNIVERSITIES / COLLEGES / INSTITUTIONS
    # ═══════════════════════════════════════════════════════════
    'punjab university': 'Chandigarh',
    'panjab university': 'Chandigarh',
    'chandigarh university': 'Mohali',
    'thapar university': 'Patiala',
    'lovely professional university': 'Kapurthala',
    'lpu': 'Kapurthala',
    'guru nanak dev university': 'Amritsar',
    'gndu': 'Amritsar',
    'punjabi university': 'Patiala',
    'punjab agricultural university': 'Ludhiana',
    'pau ludhiana': 'Ludhiana',
    'iit ropar': 'Rupnagar',
    'iit rupnagar': 'Rupnagar',
    'nit jalandhar': 'Jalandhar',
    'iiser mohali': 'Mohali',
    'niper mohali': 'Mohali',
    'pgimer': 'Chandigarh',
    'cmc ludhiana': 'Ludhiana',
    'dmch ludhiana': 'Ludhiana',
    'government medical college patiala': 'Patiala',
    'government medical college amritsar': 'Amritsar',
    'guru gobind singh medical college faridkot': 'Faridkot',
    'ggs medical college': 'Faridkot',
    'aiims bathinda': 'Bathinda',
    'sliet longowal': 'Sangrur',
    'yadavindra public school': 'Patiala',
    'dav college jalandhar': 'Jalandhar',
    'dav university': 'Jalandhar',
    'khalsa college amritsar': 'Amritsar',
    'ct university': 'Ludhiana',
    'chitkara university': 'Mohali',
    'rayat bahra university': 'Mohali',
    'chandigarh group of colleges': 'Mohali',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — HIGHWAYS / TRANSPORT HUBS
    # ═══════════════════════════════════════════════════════════
    'nh 44 punjab': 'Jalandhar',
    'nh 1 punjab': 'Ludhiana',
    'gt road punjab': 'Jalandhar',
    'grand trunk road punjab': 'Jalandhar',
    'chandigarh delhi highway': 'Mohali',
    'ferozepur road': 'Ludhiana',
    'amritsar jalandhar highway': 'Jalandhar',
    'ludhiana chandigarh highway': 'Ludhiana',
    'isbt jalandhar': 'Jalandhar',
    'isbt amritsar': 'Amritsar',
    'isbt ludhiana': 'Ludhiana',
    'isbt patiala': 'Patiala',
    'amritsar railway station': 'Amritsar',
    'jalandhar city railway station': 'Jalandhar',
    'ludhiana railway station': 'Ludhiana',
    'bathinda junction': 'Bathinda',
    'patiala railway station': 'Patiala',
    'ferozepur cantt railway station': 'Ferozepur',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — INDUSTRIAL AREAS / SPECIAL ZONES
    # ═══════════════════════════════════════════════════════════
    'industrial area ludhiana': 'Ludhiana',
    'focal point ludhiana': 'Ludhiana',
    'focal point jalandhar': 'Jalandhar',
    'industrial area mohali': 'Mohali',
    'it city mohali': 'Mohali',
    'quark city mohali': 'Mohali',
    'steel town mandi gobindgarh': 'Fatehgarh Sahib',
    'mandi gobindgarh': 'Fatehgarh Sahib',
    'gobindgarh steel market': 'Fatehgarh Sahib',
    'textile market ludhiana': 'Ludhiana',
    'hosiery complex ludhiana': 'Ludhiana',
    'cycle industry ludhiana': 'Ludhiana',
    'sports industry jalandhar': 'Jalandhar',

    # ═══════════════════════════════════════════════════════════
    #     PUNJAB — ALTERNATE SPELLINGS & COMMON VARIATIONS
    # ═══════════════════════════════════════════════════════════
    'ldh': 'Ludhiana',
    'asr': 'Amritsar',
    'juc': 'Jalandhar',
    'ptl': 'Patiala',
    'bti': 'Bathinda',
    'sgr': 'Sangrur',
    'fzr': 'Ferozepur',
    'gsp': 'Gurdaspur',
    'hsp': 'Hoshiarpur',
    'mksr': 'Muktsar',
    'mnsa': 'Mansa',
    'fdk': 'Faridkot',
    'kpt': 'Kapurthala',
    'roopnagar': 'Rupnagar',
    'sahib zada ajit singh nagar': 'Mohali',
    'nawan shahr': 'Nawanshahr',
    'mukhtsar': 'Muktsar',
    'ferozpur': 'Ferozepur',
    'phirozepur': 'Ferozepur',
    'tarantaran': 'Tarn Taran',
    'barnala city': 'Barnala',
    'ludhiana city': 'Ludhiana',
    'amritsar city': 'Amritsar',
    'jalandhar city': 'Jalandhar',
    'patiala city': 'Patiala',
    'bathinda city': 'Bathinda',
    'moga city': 'Moga',

    # --- Mysuru ---
    'chamundi hills': 'Mysuru',
    'mysore palace': 'Mysuru',
    'brindavan gardens': 'Mysuru',
    'hampi': 'Mysuru',
    'karnataka': 'Bangalore',

    # --- General / state-level ---
    'maharashtra': 'Mumbai',
    'west bengal': 'Kolkata',
    'andhra': 'Vijayawada',
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
