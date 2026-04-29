/**
 * Political Data — Andhra Pradesh NDA Government (TDP + Janasena + BJP)
 *
 * OUR SIDE  : TDP (dominant) + Janasena + BJP (AP unit) — NDA coalition
 * OPPOSITION: YSRCP/YCP (primary), Congress (minor)
 *
 * Used by:
 *   - personDetectionService  (entity resolution by name/handle)
 *   - llmService               (dynamic prompt context: OUR + OPPOSITION)
 *   - grievanceController      (handle-based filtering)
 */

const normalizeHandle = (h) =>
  String(h || '').trim().replace(/^@/, '').toLowerCase();

const tagLeaders = (leaders, party, side) =>
  leaders.map((l) => {
    const handles = l.handles || [];
    const primary_handle = handles[0] || '';
    return {
      ...l,
      party,
      side,
      primary_handle,
      primary_handle_normalized: normalizeHandle(primary_handle),
      handles_normalized: handles.map(normalizeHandle).filter(Boolean)
    };
  });

// ─────────────────────────────────────────────────────────
// OUR PARTY (Client) — TDP, ruling party in Andhra Pradesh (NDA)
// ─────────────────────────────────────────────────────────
const OUR_PARTY = {
  id: 'tdp',
  name: 'TDP',
  full_name: 'Telugu Desam Party',
  alliance: 'NDA',
  role: 'ruling',
  state: 'Andhra Pradesh',
  chief: 'N. Chandrababu Naidu'
};

// ─── TDP Cabinet Ministers ────────────────────────────────
const _TDP_CABINET_RAW = [
  {
    id: 'chandrababu-naidu',
    name: 'N. Chandrababu Naidu',
    shortName: 'Chandrababu Naidu',
    aliases: ['CBN', 'Chandrababu', 'Naidu'],
    role: 'Chief Minister',
    constituency: 'Kuppam',
    district: 'Chittoor',
    handles: ['@ncbn', '@chandrababunaidu']
  },
  {
    id: 'nara-lokesh',
    name: 'Nara Lokesh',
    shortName: 'Lokesh',
    aliases: ['Lokesh', 'Nara Lokesh'],
    role: 'Cabinet Minister (IT & Education)',
    constituency: 'Mangalagiri',
    district: 'Guntur',
    handles: ['@naralokesh']
  },
  {
    id: 'atchannaidu',
    name: 'Kinjarapu Atchannaidu',
    shortName: 'Atchannaidu',
    aliases: ['Atchannaidu', 'K. Atchannaidu'],
    role: 'Cabinet Minister (Human Resources)',
    constituency: 'Narasannapeta',
    district: 'Srikakulam',
    handles: ['@KAtchannaidu']
  },
  {
    id: 'nadendla-manohar',
    name: 'Nadendla Manohar',
    shortName: 'Nadendla Manohar',
    role: 'Cabinet Minister (Industries)',
    constituency: 'Tanuku',
    district: 'West Godavari',
    handles: ['@NadendlaManohar']
  },
  {
    id: 'gottipati-ravi',
    name: 'Gottipati Ravi Kumar',
    shortName: 'Gottipati Ravi',
    role: 'Cabinet Minister',
    constituency: 'Avanigadda',
    district: 'Krishna',
    handles: []
  },
  {
    id: 'p-narayana',
    name: 'P. Narayana',
    shortName: 'P. Narayana',
    aliases: ['Narayana Minister'],
    role: 'Cabinet Minister (Roads & Buildings)',
    constituency: 'Gudur',
    district: 'SPSR Nellore',
    handles: ['@pnarayanaTDP']
  },
  {
    id: 'kolusu-parthasarathy',
    name: 'Kolusu Parthasarathy',
    shortName: 'Kolusu Parthasarathy',
    role: 'Cabinet Minister (Endowments)',
    constituency: 'Payakaraopeta',
    district: 'Visakhapatnam',
    handles: []
  },
  {
    id: 'anagani-satya-prasad',
    name: 'Anagani Satya Prasad',
    shortName: 'Anagani',
    role: 'Cabinet Minister',
    constituency: 'Yalamanchali',
    district: 'Visakhapatnam',
    handles: []
  },
  {
    id: 'vasamsetti-subhash',
    name: 'Vasamsetti Subhash',
    shortName: 'Vasamsetti Subhash',
    role: 'Cabinet Minister',
    constituency: 'Bobbili',
    district: 'Vizianagaram',
    handles: []
  },
  {
    id: 'nimmala-ramanaidu',
    name: 'Nimmala Ramanaidu',
    shortName: 'Ramanaidu',
    role: 'Cabinet Minister',
    constituency: 'Hindupur',
    district: 'Sri Sathya Sai',
    handles: []
  },
  {
    id: 'vangalapudi-anitha',
    name: 'Vangalapudi Anitha',
    shortName: 'Vangalapudi Anitha',
    role: 'Cabinet Minister (Women & Child Welfare)',
    constituency: 'Bheemunipatnam',
    district: 'Visakhapatnam',
    handles: ['@VangalapudiAnit']
  },
  {
    id: 'mandipalli-ramprasad',
    name: 'Mandipalli Ramprasad Reddy',
    shortName: 'Mandipalli Ramprasad',
    role: 'Cabinet Minister (Finance)',
    constituency: 'Mylavaram',
    district: 'Krishna',
    handles: []
  },
  {
    id: 'savitha-mamidi',
    name: 'Savitha Mamidi',
    shortName: 'Savitha',
    role: 'Cabinet Minister',
    constituency: 'Rajam',
    district: 'Srikakulam',
    handles: []
  },
  {
    id: 'kollu-ravindra',
    name: 'Kollu Ravindra',
    shortName: 'Kollu Ravindra',
    role: 'Cabinet Minister',
    constituency: 'Rajahmundry Rural',
    district: 'East Godavari',
    handles: []
  }
];

// ─── Prominent TDP MLAs & MPs ─────────────────────────────
const _TDP_MLAS_RAW = [
  {
    id: 'rammohan-naidu',
    name: 'Kinjarapu Ram Mohan Naidu',
    shortName: 'Ram Mohan Naidu',
    aliases: ['Ram Mohan Naidu'],
    role: 'Union Minister (Civil Aviation)',
    constituency: 'Srikakulam',
    district: 'Srikakulam',
    handles: ['@RamMohanNaiduTW']
  },
  {
    id: 'pemmasani-cs',
    name: 'Pemmasani Chandra Sekhar',
    shortName: 'Pemmasani Chandra Sekhar',
    role: 'MP',
    constituency: 'Guntur',
    district: 'Guntur',
    handles: []
  },
  {
    id: 'srinivasa-varma',
    name: 'Srinivasa Varma',
    shortName: 'Srinivasa Varma',
    role: 'TDP Leader',
    constituency: null,
    district: null,
    handles: []
  },
  {
    id: 'devineni-umamaheswara',
    name: 'Devineni Umamaheswara Rao',
    shortName: 'Devineni Uma',
    aliases: ['Devineni Uma'],
    role: 'TDP Senior Leader',
    constituency: 'Vijayawada West',
    district: 'NTR',
    handles: ['@DevineniUma']
  },
  {
    id: 'chintakayala-vijaya',
    name: 'Chintakayala Vijaya',
    shortName: 'Chintakayala Vijaya',
    role: 'MLA',
    constituency: 'Kuppam',
    district: 'Chittoor',
    handles: []
  }
];

// ─── Janasena Leaders (NDA Ally) ──────────────────────────
const _JANASENA_LEADERS_RAW = [
  {
    id: 'pawan-kalyan',
    name: 'Pawan Kalyan',
    shortName: 'Pawan Kalyan',
    aliases: ['Pawan', 'Power Star', 'PK'],
    role: 'Deputy Chief Minister',
    constituency: 'Pithapuram',
    district: 'East Godavari',
    handles: ['@PawanKalyan', '@JanaSenaParty']
  },
  {
    id: 'tg-bharat',
    name: 'T.G. Bharat',
    shortName: 'TG Bharat',
    aliases: ['TG Bharat', 'Bharat'],
    role: 'Cabinet Minister (Tourism)',
    constituency: 'Tuni',
    district: 'East Godavari',
    handles: ['@TGBharat_JSP']
  },
  {
    id: 'dola-bala',
    name: 'Dola Sree Bala Veeranjaneya Swamy',
    shortName: 'Dola Bala',
    role: 'Cabinet Minister',
    constituency: 'Narsipatnam',
    district: 'Visakhapatnam',
    handles: []
  },
  {
    id: 'nadendla-manohar-jsn',
    name: 'Nadendla Manohar',
    shortName: 'Nadendla',
    role: 'Janasena Senior Leader',
    constituency: null,
    district: null,
    handles: []
  }
];

// ─── BJP AP Leaders (NDA Ally) ────────────────────────────
const _BJP_AP_LEADERS_RAW = [
  {
    id: 'purandeswari',
    name: 'D. Purandeswari',
    shortName: 'Purandeswari',
    aliases: ['Purandeswari', 'Daggubati Purandeswari'],
    role: 'AP BJP President / MP',
    constituency: 'Rajahmundry',
    district: 'East Godavari',
    handles: ['@D_Purandeswari']
  },
  {
    id: 'vishnuvardhan-reddy',
    name: 'S. Vishnuvardhan Reddy',
    shortName: 'Vishnuvardhan Reddy',
    role: 'BJP MLA',
    constituency: 'Kurnool',
    district: 'Kurnool',
    handles: []
  }
];

const TDP_CABINET    = tagLeaders(_TDP_CABINET_RAW,    'TDP',      'ours');
const TDP_MLAS       = tagLeaders(_TDP_MLAS_RAW,       'TDP',      'ours');
const JANASENA_LEADERS = tagLeaders(_JANASENA_LEADERS_RAW, 'Janasena', 'ours');
const BJP_AP_LEADERS = tagLeaders(_BJP_AP_LEADERS_RAW, 'BJP',      'ours');

const CABINET_MINISTERS = [...TDP_CABINET, ...JANASENA_LEADERS.slice(0, 3), ...BJP_AP_LEADERS];
const OUR_LEADERS = [...TDP_CABINET, ...TDP_MLAS, ...JANASENA_LEADERS, ...BJP_AP_LEADERS];

// ─────────────────────────────────────────────────────────
// OPPOSITION PARTIES — YSRCP (primary) + Congress (minor)
// ─────────────────────────────────────────────────────────
const _YSRCP_LEADERS_RAW = [
  {
    id: 'jagan-mohan-reddy',
    name: 'Y.S. Jagan Mohan Reddy',
    shortName: 'Jagan',
    aliases: ['Jagan Reddy', 'Jagan Mohan', 'YSRCP Chief', 'YCP Chief'],
    role: 'Former CM / YSRCP President',
    constituency: 'Pulivendula',
    district: 'YSR Kadapa',
    handles: ['@ysjagan']
  },
  {
    id: 'vijayasai-reddy',
    name: 'V. Vijayasai Reddy',
    shortName: 'Vijayasai Reddy',
    aliases: ['Vijayasai Reddy'],
    role: 'YSRCP MP (Rajya Sabha)',
    constituency: null,
    district: null,
    handles: ['@vvrsec']
  },
  {
    id: 'ambati-rambabu',
    name: 'Ambati Rambabu',
    shortName: 'Ambati Rambabu',
    aliases: ['Ambati'],
    role: 'YSRCP MLA',
    constituency: 'Sattenapalle',
    district: 'Palnadu',
    handles: ['@ambatirambabu']
  },
  {
    id: 'botsa-satyanarayana',
    name: 'Botsa Satyanarayana',
    shortName: 'Botsa',
    aliases: ['Botsa Satyanarayana', 'Botsa'],
    role: 'YSRCP Senior Leader',
    constituency: 'Bhimili',
    district: 'Visakhapatnam',
    handles: ['@BotsaSatyam']
  },
  {
    id: 'roja-selvamani',
    name: 'Meri Roja Selvamani',
    shortName: 'Roja',
    aliases: ['Roja', 'Meri Roja'],
    role: 'YSRCP MLA',
    constituency: 'Nagari',
    district: 'Tirupati',
    handles: ['@merisroja']
  },
  {
    id: 'kakani-govardhan',
    name: 'Kakani Govardhan Reddy',
    shortName: 'Kakani',
    aliases: ['Kakani Govardhan', 'Kakani'],
    role: 'YSRCP MLA',
    constituency: 'Nellore Rural',
    district: 'SPSR Nellore',
    handles: []
  },
  {
    id: 'peddireddy-ramachandra',
    name: 'Peddireddy Ramachandra Reddy',
    shortName: 'Peddireddy',
    aliases: ['Peddireddy'],
    role: 'YSRCP Senior Leader',
    constituency: 'Punganur',
    district: 'Chittoor',
    handles: []
  },
  {
    id: 'butta-renuka',
    name: 'Butta Renuka',
    shortName: 'Butta Renuka',
    role: 'YSRCP MP',
    constituency: null,
    district: 'Nellore',
    handles: []
  },
  {
    id: 'sridhar-reddy-jafari',
    name: 'Sridhar Reddy',
    shortName: 'Sridhar Reddy',
    role: 'YSRCP Leader',
    constituency: null,
    district: null,
    handles: []
  }
];

const _INC_AP_LEADERS_RAW = [
  {
    id: 'ys-sharmila',
    name: 'Y.S. Sharmila',
    shortName: 'Y.S. Sharmila',
    aliases: ['Sharmila', 'YS Sharmila'],
    role: 'APCC President / MP',
    constituency: null,
    district: null,
    handles: ['@realyssharmila']
  }
];

const OPPOSITION_PARTIES = [
  {
    id: 'ysrcp',
    name: 'YSRCP',
    full_name: 'YSR Congress Party',
    alliance: 'YSRCP',
    leaders: tagLeaders(_YSRCP_LEADERS_RAW, 'YSRCP', 'opposition')
  },
  {
    id: 'inc_ap',
    name: 'INC',
    full_name: 'Indian National Congress (AP)',
    alliance: 'INDIA',
    leaders: tagLeaders(_INC_AP_LEADERS_RAW, 'INC', 'opposition')
  }
];

const OPPOSITION_LEADERS = OPPOSITION_PARTIES.flatMap((p) => p.leaders);
const ALL_LEADERS = [...OUR_LEADERS, ...OPPOSITION_LEADERS];

module.exports = {
  OUR_PARTY,
  OPPOSITION_PARTIES,
  CABINET_MINISTERS,
  OUR_LEADERS,
  OPPOSITION_LEADERS,
  ALL_LEADERS,
  normalizeHandle
};