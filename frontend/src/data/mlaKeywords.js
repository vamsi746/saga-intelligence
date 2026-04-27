/**
 * MLA keyword registry for tracked politicians.
 *
 * Each entry extends the auto-defaults (name + shortName + constituency).
 * Fields:
 *   aliases  - name variants, role titles, common references used in social media
 *   handles  - official X/Twitter handles WITHOUT the @ prefix
 *              used both as posted_by_handle filter AND as @mention search terms
 *   party    - party abbreviations / names used in social media context
 *
 * Weights in keywordService.js:
 *   handle (5) > primary name (3) > alias (2) > party (1) > constituency (1)
 */

const MLA_KEYWORD_OVERRIDES = {
  // ─── Chief Minister ────────────────────────────────────────────────────────
  'revanth-reddy': {
    aliases: [
      'CM Revanth', 'Chief Minister Revanth', 'CM of Telangana',
      'A Revanth Reddy', 'Revanth CM', 'TPCC Revanth',
      'Anumula Revanth Reddy', 'Anumula Revanth', 'CM Revanth Reddy',
      'Revanth Reddy CM', 'Telangana CM Revanth',
    ],
    handles: ['revanth_anumula', 'RevanthTRS', 'CMO_Telangana'],
    party: ['Congress', 'INC', 'TPCC', 'Telangana Congress', 'Indian National Congress'],
  },

  // ─── Deputy Chief Minister ─────────────────────────────────────────────────
  'bhatti-vikramarka': {
    aliases: [
      'Dy CM Bhatti', 'Deputy CM Bhatti', 'Vikramarka',
      'Bhatti Mallu', 'Mallu Bhatti', 'Finance Minister Telangana',
      'Deputy CM Vikramarka', 'Bhatti Vikramarka Finance',
      'Mallu Bhatti Vikramarka',
    ],
    handles: ['bhattivik', 'BhattiVikramarka'],
    party: ['Congress', 'INC', 'TPCC', 'Telangana Congress'],
  },

  // ─── IT & Industries Minister ──────────────────────────────────────────────
  'sridhar-babu': {
    aliases: [
      'D Sridhar Babu', 'IT Minister Telangana', 'Sridhar Industries Minister',
      'Manthani MLA Sridhar', 'D Sridhar Babu IT', 'Industries Minister Telangana',
    ],
    handles: ['dsridharbabu', 'SridharBabuMLA'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Roads & Buildings Minister ────────────────────────────────────────────
  'venkat-reddy': {
    aliases: [
      'Komatireddy Venkat', 'Roads Minister Telangana', 'Komatireddy',
      'Venkat Roads', 'Komatireddy Venkat Reddy', 'Roads and Buildings Minister',
    ],
    handles: ['KVReddyINC', 'komatireddyvr'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Municipal Administration Minister ────────────────────────────────────
  'ponnam-prabhakar': {
    aliases: [
      'Ponnam', 'Ponnam GHMC', 'Municipal Minister Telangana',
      'Ponnam Husnabad', 'MA&UD Minister', 'Municipal Administration Minister',
    ],
    handles: ['ponnamprabhakar', 'PonnamPrabhakarT'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Irrigation Minister ──────────────────────────────────────────────────
  'uttam-kumar': {
    aliases: [
      'Uttam Kumar', 'TPCC President Uttam', 'Irrigation Minister Telangana',
      'N Uttam Kumar', 'Uttam Huzurnagar', 'N Uttam Kumar Reddy',
      'TPCC President', 'Telangana PCC President Uttam',
    ],
    handles: ['UttamKumarReddyN', 'UttamKumarTelangana'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Agriculture Minister ──────────────────────────────────────────────────
  'tummala': {
    aliases: [
      'Tummala Nageshwara', 'Tummala Nageswara Rao', 'Agriculture Minister Telangana',
      'Tummala Khammam', 'Khammam MLA Tummala',
    ],
    handles: ['tummala_nageswara', 'TummalaNageswara'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Tribal Welfare Minister ──────────────────────────────────────────────
  'seethakka': {
    aliases: [
      'Anasuya Seethakka', 'Danasari Anasuya', 'Tribal Minister Telangana',
      'Seethakka Tribal', 'Danasari Seethakka', 'Mulug MLA Seethakka',
      'Tribal Welfare Minister',
    ],
    handles: ['seethakka_mla', 'DanasariAnasuya'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── BC Welfare Minister ──────────────────────────────────────────────────
  'gangula': {
    aliases: [
      'Gangula Kamalakar', 'BC Welfare Minister', 'Gangula Minister',
      'Karimnagar MLA Gangula', 'BC Welfare Minister Telangana',
    ],
    handles: ['GangulaKamalakar', 'gangula_kamalakar'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Women & Child Welfare Minister ───────────────────────────────────────
  'konda-surekha': {
    aliases: [
      'Surekha Minister', 'Women Minister Telangana', 'Konda Surekha Minister',
      'Warangal East MLA Surekha', 'Women Child Welfare Minister',
    ],
    handles: ['KondaSurekha', 'kondaSurekhaINC'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Labour Minister ──────────────────────────────────────────────────────
  'sirikonda': {
    aliases: [
      'Sirikonda Madhu', 'Labour Minister Telangana', 'Madhu Yashpal',
      'Sirikonda Madhu Yashpal', 'Banswada MLA',
    ],
    handles: ['SirikondaMadhu', 'sirikonda_madhu'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Tourism & Culture Minister ───────────────────────────────────────────
  'jupally': {
    aliases: [
      'Jupally Krishna', 'Jupally Krishna Rao', 'Tourism Minister Telangana',
      'Kollapur MLA Jupally', 'Tourism Culture Minister',
    ],
    handles: ['JupallyKrishnaRao', 'jupally_krishna'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Health Minister ──────────────────────────────────────────────────────
  'naini-reddy': {
    aliases: [
      'Naini Rajender', 'Health Minister Telangana', 'Naini Reddy Health',
      'Naini Rajender Reddy',
    ],
    handles: ['NainiRajender', 'naini_rajender'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Housing & Urban Dev Minister ─────────────────────────────────────────
  'chamakura': {
    aliases: [
      'Chamakura Malla Reddy', 'Malla Reddy Minister', 'Urban Dev Minister',
      'Housing Minister Telangana',
    ],
    handles: ['ChamakuraMR', 'chamakura_mla'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Civil Supplies Minister ──────────────────────────────────────────────
  'puvvada': {
    aliases: [
      'Puvvada Ajay Kumar', 'Puvvada Ajay', 'Civil Supplies Minister',
      'Civil Supplies Telangana', 'Khammam MLA Puvvada',
    ],
    handles: ['PuvvadaAjayKumar', 'puvvada_ajay'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Industries Minister ──────────────────────────────────────────────────
  'damodar': {
    aliases: [
      'Damodar Raja', 'Damodar Narasimha', 'Industries Minister Telangana',
      'Damodar Raja Narasimha', 'Andole MLA Damodar',
    ],
    handles: ['DamodarRajaN', 'damodar_industries'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── Panchayat Raj Minister ───────────────────────────────────────────────
  'niranjan-reddy': {
    aliases: [
      'Singireddy Niranjan', 'Niranjan Panchayat', 'Panchayat Raj Minister',
      'Singireddy Niranjan Reddy', 'PR Minister Telangana',
    ],
    handles: ['NiranjanReddyS', 'singireddy_niranjan'],
    party: ['Congress', 'INC', 'TPCC'],
  },

  // ─── AP Chief Minister — N. Chandrababu Naidu (TDP) ─────────────────────
  'chandra-babu-naidu': {
    aliases: [
      'CBN', 'Chandrababu', 'N Chandrababu Naidu', 'AP Chief Minister',
      'CM AP', 'CM Chandrababu', 'AP CM CBN', 'CM Naidu', 'AP CM Naidu',
      'Chandrababu Naidu AP CM', 'Kuppam MLA Chandrababu', 'Naidu AP CM',
      'TDP Chief', 'Chandrababu TDP', 'AP CM Chandrababu Naidu',
    ],
    handles: ['ncbn', 'ChandrababuTDP', 'APCMOfficer'],
    party: ['TDP', 'Telugu Desam', 'Telugu Desam Party', 'NDA AP'],
  },

  // ─── AP Cabinet Minister — Nara Lokesh (TDP) ─────────────────────────────
  // Tracks ALL Twitter mentions & tags of Nara Lokesh across AP political discourse
  'nara-lokesh': {
    aliases: [
      'Lokesh', 'Nara Lokesh Minister', 'AP Education Minister', 'AP HRD Minister',
      'HRD Minister Andhra', 'IT Minister AP', 'Lokesh TDP', 'TDP Lokesh',
      'Nara Lokesh TDP', 'Lokesh AP Minister', 'Minister Nara Lokesh',
      'AP IT Minister Lokesh', 'Lokesh Mangalagiri', 'Mangalagiri MLA Lokesh',
      'Education Minister AP', 'Lokesh Human Resources', 'AP Electronics Minister',
      'N Lokesh', 'Naralokesh', 'Chandrababu son', 'CBN son Lokesh',
    ],
    handles: ['naralokesh', 'NaraLokeshTDP'],
    party: ['TDP', 'Telugu Desam', 'Telugu Desam Party', 'NDA AP'],
  },
};

export default MLA_KEYWORD_OVERRIDES;
