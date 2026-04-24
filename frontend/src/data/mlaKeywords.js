/**
 * Custom keyword overrides for prominent MLAs.
 * Auto-defaults (name + shortName + constituency) are always applied.
 * Entries here ADD aliases for better coverage. Missing entries use defaults only.
 *
 * Structure per entry:
 *   aliases: additional search terms (roles, common references, name variants)
 */

const MLA_KEYWORD_OVERRIDES = {
  'revanth-reddy': {
    aliases: ['CM Revanth', 'Chief Minister Revanth', 'TPCC Revanth', 'CM Telangana', 'A Revanth Reddy', 'Revanth CM'],
  },
  'bhatti-vikramarka': {
    aliases: ['Dy CM Bhatti', 'Deputy CM Bhatti', 'Vikramarka', 'Bhatti Mallu', 'Finance Minister Telangana', 'Mallu Bhatti'],
  },
  'sridhar-babu': {
    aliases: ['D Sridhar Babu', 'IT Minister Telangana', 'Sridhar Industries Minister'],
  },
  'venkat-reddy': {
    aliases: ['Komatireddy Venkat', 'Roads Minister Telangana', 'Komatireddy', 'Venkat Roads'],
  },
  'uttam-kumar': {
    aliases: ['Uttam Kumar', 'TPCC President Uttam', 'Irrigation Minister', 'N Uttam Kumar'],
  },
  'ponnam-prabhakar': {
    aliases: ['Ponnam', 'Ponnam GHMC', 'Municipal Minister Telangana'],
  },
  'tummala': {
    aliases: ['Tummala Nageshwara', 'Tummala Nageswara Rao', 'Agriculture Minister Telangana'],
  },
  'seethakka': {
    aliases: ['Anasuya Seethakka', 'Danasari Anasuya', 'Tribal Minister Telangana', 'Seethakka Tribal'],
  },
  'gangula': {
    aliases: ['Gangula Kamalakar', 'BC Welfare Minister', 'Gangula Minister'],
  },
  'konda-surekha': {
    aliases: ['Surekha Minister', 'Women Minister Telangana', 'Konda Surekha Minister'],
  },
  'sirikonda': {
    aliases: ['Sirikonda Madhu', 'Labour Minister Telangana', 'Madhu Yashpal'],
  },
  'jupally': {
    aliases: ['Jupally', 'Tourism Minister Telangana', 'Jupally Krishna'],
  },
  'naini-reddy': {
    aliases: ['Naini Rajender', 'Health Minister Telangana', 'Naini Reddy Health'],
  },
  'chamakura': {
    aliases: ['Chamakura Malla Reddy', 'Malla Reddy Minister', 'Urban Dev Minister'],
  },
  'puvvada': {
    aliases: ['Puvvada Ajay Kumar', 'Puvvada Ajay', 'Civil Supplies Minister'],
  },
  'damodar': {
    aliases: ['Damodar Raja', 'Damodar Narasimha', 'Industries Minister Telangana'],
  },
  'niranjan-reddy': {
    aliases: ['Singireddy Niranjan', 'Niranjan Panchayat', 'Panchayat Raj Minister'],
  },
};

export default MLA_KEYWORD_OVERRIDES;
