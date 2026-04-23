/**
 * Political Data for Person Detection (Telangana)
 * This data is used by the personDetectionService to map grievances to leaders.
 */

const CABINET_MINISTERS = [
  { id: 'revanth-reddy', name: 'A. Revanth Reddy', shortName: 'Revanth Reddy', role: 'Chief Minister', constituency: 'Kodangal', district: 'Vikarabad', handles: ['@revanth_anumula', '@TelanganaCMO'] },
  { id: 'bhatti-vikramarka', name: 'Mallu Bhatti Vikramarka', shortName: 'Bhatti Vikramarka', role: 'Deputy Chief Minister', constituency: 'Madhira', district: 'Khammam', handles: ['@Bhatti_Vikramarka'] },
  { id: 'sridhar-babu', name: 'D. Sridhar Babu', shortName: 'Sridhar Babu', role: 'Cabinet Minister', constituency: 'Manthani', district: 'Peddapalli', handles: ['@dudilla_sridhar'] },
  { id: 'venkat-reddy', name: 'Komatireddy Venkat Reddy', shortName: 'Venkat Reddy', role: 'Cabinet Minister', constituency: 'Nalgonda', district: 'Nalgonda', handles: ['@v_komatireddy'] },
  { id: 'ponnam-prabhakar', name: 'Ponnam Prabhakar', shortName: 'Ponnam Prabhakar', role: 'Cabinet Minister', constituency: 'Husnabad', district: 'Peddapalli', handles: ['@PonnamLOKSABHA'] },
  { id: 'tummala', name: 'Tummala Nageshwara Rao', shortName: 'Tummala Nageshwara', role: 'Cabinet Minister', constituency: 'Khammam', district: 'Khammam', handles: ['@Tummala_N_Rao'] },
  { id: 'uttam-kumar', name: 'N. Uttam Kumar Reddy', shortName: 'Uttam Kumar Reddy', role: 'Cabinet Minister', constituency: 'Huzurnagar', district: 'Suryapet', handles: ['@UttamReddyINC'] },
  { id: 'jupally', name: 'Jupally Krishna Rao', shortName: 'Jupally Krishna Rao', role: 'Cabinet Minister', constituency: 'Kollapur', district: 'Nagarkurnool', handles: ['@JupallyK'] },
  { id: 'sirikonda', name: 'Sirikonda Madhu Yashpal Goud', shortName: 'Sirikonda Madhu', role: 'Cabinet Minister', constituency: 'Banswada', district: 'Kamareddy', handles: [] },
  { id: 'damodar', name: 'Damodar Raja Narasimha', shortName: 'Damodar Narasimha', role: 'Cabinet Minister', constituency: 'Andole', district: 'Sangareddy', handles: ['@DamodarRajaNars'] },
  { id: 'seethakka', name: 'Danasari Anasuya (Seethakka)', shortName: 'Seethakka', role: 'Cabinet Minister', constituency: 'Mulug', district: 'Mulugu', handles: ['@seethakkaMLA'] },
  { id: 'gangula', name: 'Gangula Kamalakar', shortName: 'Gangula Kamalakar', role: 'Cabinet Minister', constituency: 'Karimnagar', district: 'Karimnagar', handles: ['@GKamalakarTRS'] },
  { id: 'konda-surekha', name: 'Konda Surekha', shortName: 'Konda Surekha', role: 'Cabinet Minister', constituency: 'Warangal East', district: 'Hanamkonda', handles: ['@iamKondaSurekha'] },
  { id: 'naini-reddy', name: 'Naini Rajender Reddy', shortName: 'Naini Rajender', role: 'Cabinet Minister', constituency: 'Warangal West', district: 'Hanamkonda', handles: [] },
  { id: 'niranjan-reddy', name: 'Singireddy Niranjan Reddy', shortName: 'Niranjan Reddy', role: 'Cabinet Minister', constituency: 'Wanaparthy', district: 'Wanaparthy', handles: ['@NiranjanReddyOf'] },
  { id: 'puvvada', name: 'Puvvada Ajay Kumar', shortName: 'Puvvada Ajay', role: 'Cabinet Minister', constituency: 'Palair', district: 'Khammam', handles: ['@puvvada_ajay'] },
  { id: 'chamakura', name: 'Chamakura Malla Reddy', shortName: 'Malla Reddy', role: 'Cabinet Minister', constituency: 'Medchal', district: 'Medchal-Malkajgiri', handles: ['@MallaReddyBrs'] }
];

const CONGRESS_MLAS = [
  { id: 'vamshi-krishna-achampet', name: 'Chikkudu Vamshi Krishna', shortName: 'Vamshi Krishna', role: 'MLA', constituency: 'Achampet', district: 'Nagarkurnool', handles: [] },
  { id: 'ilaiah-beerla', name: 'Ilaiah Beerla', shortName: 'Ilaiah Beerla', role: 'MLA', constituency: 'Alair', district: 'Yadadri', handles: [] },
  { id: 'adinarayana-jare', name: 'Adinarayana Jare', shortName: 'Adinarayana Jare', role: 'MLA', constituency: 'Aswaraopeta', district: 'Bhadradri Kothagudem', handles: [] },
  { id: 'gaddam-vinod', name: 'Gaddam Vinod', shortName: 'Gaddam Vinod', role: 'MLA', constituency: 'Bellampalli', district: 'Mancherial', handles: [] },
  { id: 'anil-kumar-bhongir', name: 'Kumbam Anil Kumar Reddy', shortName: 'Anil Kumar Reddy', role: 'MLA', constituency: 'Bhongir', district: 'Yadadri', handles: [] },
  { id: 'satyanarayana-bhupalpalle', name: 'Gandra Satyanarayana Rao', shortName: 'Gandra Satyanarayana', role: 'MLA', constituency: 'Bhupalpalle', district: 'Jayashankar Bhupalpally', handles: [] },
  { id: 'sudarshan-bodhan', name: 'P. Sudarshan Reddy', shortName: 'Sudarshan Reddy', role: 'MLA', constituency: 'Bodhan', district: 'Nizamabad', handles: [] },
  { id: 'gaddam-vivekanand', name: 'Gaddam Vivekanand', shortName: 'Gaddam Vivekanand', role: 'MLA', constituency: 'Chennur', district: 'Mancherial', handles: [] },
  { id: 'medipally-sathyam', name: 'Medipally Sathyam', shortName: 'Medipally Sathyam', role: 'MLA', constituency: 'Choppadandi', district: 'Karimnagar', handles: [] },
  { id: 'balu-naik-devarakonda', name: 'Balu Naik Nenavath', shortName: 'Balu Naik', role: 'MLA', constituency: 'Devarakonda', district: 'Nalgonda', handles: [] },
  { id: 'gmr-devarkadra', name: 'Gavinolla Madhusudan Reddy', shortName: 'GMR Devarkadra', role: 'MLA', constituency: 'Devarkadra', district: 'Mahabubnagar', handles: [] },
  { id: 'adluri-laxman', name: 'Adluri Laxman Kumar', shortName: 'Adluri Laxman', role: 'MLA', constituency: 'Dharmapuri', district: 'Jagtial', handles: [] },
  { id: 'jatoth-dornakal', name: 'Jatoth Ram Chander Naik', shortName: 'Jatoth Ram Naik', role: 'MLA', constituency: 'Dornakal', district: 'Mahabubabad', handles: [] },
  { id: 'malreddy-ibrahimpatnam', name: 'Malreddy Ranga Reddy', shortName: 'Malreddy Ranga', role: 'MLA', constituency: 'Ibrahimpatnam', district: 'Rangareddy', handles: [] },
  { id: 'anirudh-jadcherla', name: 'Anirudh Reddy Janampalli', shortName: 'Anirudh Reddy', role: 'MLA', constituency: 'Jadcherla', district: 'Mahabubnagar', handles: [] },
  { id: 'laxmikantha-jukkal', name: 'Laxmi Kantha Rao Thota', shortName: 'Laxmikantha Rao', role: 'MLA', constituency: 'Jukkal', district: 'Kamareddy', handles: [] },
  { id: 'narayan-kalwakurthy', name: 'Narayan Reddy Kasireddy', shortName: 'Narayan Reddy', role: 'MLA', constituency: 'Kalwakurthy', district: 'Nagarkurnool', handles: [] },
  { id: 'vedma-khanapur', name: 'Vedma Bhojju', shortName: 'Vedma Bhojju', role: 'MLA', constituency: 'Khanapur', district: 'Nirmal', handles: [] },
  { id: 'padmavathi-kodad', name: 'Nalamada Padmavathi Reddy', shortName: 'Padmavathi Reddy', role: 'MLA', constituency: 'Kodad', district: 'Suryapet', handles: [] },
  { id: 'murali-naik-mahabubabad', name: 'Dr. Murali Naik Bhukya', shortName: 'Murali Naik', role: 'MLA', constituency: 'Mahabubabad', district: 'Mahabubabad', handles: [] },
  { id: 'srinivas-mahbubnagar', name: 'Yennam Srinivas Reddy', shortName: 'Yennam Srinivas', role: 'MLA', constituency: 'Mahbubnagar', district: 'Mahabubnagar', handles: [] },
  { id: 'vakiti-makthal', name: 'Vakiti Srihari', shortName: 'Vakiti Srihari', role: 'MLA', constituency: 'Makthal', district: 'Narayanpet', handles: [] },
  { id: 'kavvampally-manakondur', name: 'Dr. Kavvampally Satyanarayana', shortName: 'Kavvampally', role: 'MLA', constituency: 'Manakondur', district: 'Rajanna Sircilla', handles: [] },
  { id: 'premsagar-mancherial', name: 'Kokkirala Premsagar Rao', shortName: 'Premsagar Rao', role: 'MLA', constituency: 'Mancherial', district: 'Mancherial', handles: [] },
  { id: 'mynampally-medak', name: 'Mynampally Rohith', shortName: 'Mynampally Rohith', role: 'MLA', constituency: 'Medak', district: 'Medak', handles: [] },
  { id: 'bathula-miryalaguda', name: 'Bathula Laxma Reddy', shortName: 'Bathula Laxma', role: 'MLA', constituency: 'Miryalaguda', district: 'Nalgonda', handles: [] },
  { id: 'raj-gopal-munugode', name: 'Komatireddy Raj Gopal Reddy', shortName: 'Raj Gopal Reddy', role: 'MLA', constituency: 'Munugode', district: 'Nalgonda', handles: [] },
  { id: 'jayaveer-nagarjunasagar', name: 'Kunduru Jayaveer', shortName: 'Kunduru Jayaveer', role: 'MLA', constituency: 'Nagarjuna Sagar', district: 'Nalgonda', handles: [] },
  { id: 'rajesh-nagarkurnool', name: 'Dr. Kuchkulla Rajesh Reddy', shortName: 'Rajesh Reddy', role: 'MLA', constituency: 'Nagarkurnool', district: 'Nagarkurnool', handles: [] },
  { id: 'veeresham-nakrekal', name: 'Vemula Veeresham', shortName: 'Vemula Veeresham', role: 'MLA', constituency: 'Nakrekal', district: 'Nalgonda', handles: [] },
  { id: 'sanjeeva-narayankhed', name: 'Patlolla Sanjeeva Reddy', shortName: 'Sanjeeva Reddy', role: 'MLA', constituency: 'Narayankhed', district: 'Sangareddy', handles: [] },
  { id: 'parnika-narayanpet', name: 'Chittem Parnika Reddy', shortName: 'Parnika Reddy', role: 'MLA', constituency: 'Narayanpet', district: 'Narayanpet', handles: [] },
  { id: 'madhava-narsampet', name: 'Donthi Madhava Reddy', shortName: 'Madhava Reddy', role: 'MLA', constituency: 'Narsampet', district: 'Warangal', handles: [] },
  { id: 'bhoopathi-nizamabad', name: 'Bhoopathi Reddy Rekulapally', shortName: 'Bhoopathi Reddy', role: 'MLA', constituency: 'Nizamabad Rural', district: 'Nizamabad', handles: [] },
  { id: 'ponguleti-palair', name: 'Ponguleti Srinivasa Reddy', shortName: 'Ponguleti Srinivasa', role: 'MLA', constituency: 'Palair', district: 'Khammam', handles: [] },
  { id: 'yashaswini-palakurthi', name: 'Yashaswini Mamidala', shortName: 'Yashaswini', role: 'MLA', constituency: 'Palakurthi', district: 'Suryapet', handles: [] },
  { id: 'rammohan-pargi', name: 'Tammannagari Ram Mohan Reddy', shortName: 'Ram Mohan Reddy', role: 'MLA', constituency: 'Pargi', district: 'Vikarabad', handles: [] },
  { id: 'prakash-parkal', name: 'Revuri Prakash Reddy', shortName: 'Prakash Reddy', role: 'MLA', constituency: 'Parkal', district: 'Hanamkonda', handles: [] },
  { id: 'vijayaramana-peddapalle', name: 'Chinthakunta Vijaya Ramana Rao', shortName: 'Vijaya Ramana Rao', role: 'MLA', constituency: 'Peddapalle', district: 'Peddapalli', handles: [] },
  { id: 'payam-pinapaka', name: 'Payam Venkateswarlu', shortName: 'Payam Venkateswarlu', role: 'MLA', constituency: 'Pinapaka', district: 'Bhadradri Kothagudem', handles: [] },
  { id: 'makkan-ramagundam', name: 'Makkan Singh Raj Thakur', shortName: 'Makkan Singh', role: 'MLA', constituency: 'Ramagundam', district: 'Peddapalli', handles: [] },
  { id: 'ragamayee-sathupalle', name: 'Matta Ragamayee', shortName: 'Matta Ragamayee', role: 'MLA', constituency: 'Sathupalle', district: 'Khammam', handles: [] },
  { id: 'shankaraiah-shadnagar', name: 'K. Shankaraiah', shortName: 'K. Shankaraiah', role: 'MLA', constituency: 'Shadnagar', district: 'Rangareddy', handles: [] },
  { id: 'manohar-tandur', name: 'B. Manohar Reddy', shortName: 'Manohar Reddy', role: 'MLA', constituency: 'Tandur', district: 'Vikarabad', handles: [] },
  { id: 'samel-thungathurthi', name: 'Mandula Samel', shortName: 'Mandula Samel', role: 'MLA', constituency: 'Thungathurthi', district: 'Suryapet', handles: [] },
  { id: 'aadi-vemulawada', name: 'Aadi Srinivas', shortName: 'Aadi Srinivas', role: 'MLA', constituency: 'Vemulawada', district: 'Rajanna Sircilla', handles: [] },
  { id: 'prasad-vikarabad', name: 'Gaddam Prasad Kumar', shortName: 'Gaddam Prasad', role: 'MLA', constituency: 'Vikarabad', district: 'Vikarabad', handles: [] },
  { id: 'megha-wanaparthy', name: 'Megha Reddy Tudi', shortName: 'Megha Reddy', role: 'MLA', constituency: 'Wanaparthy', district: 'Wanaparthy', handles: [] },
  { id: 'nagaraj-waradhanapet', name: 'K.R. Nagaraj', shortName: 'K.R. Nagaraj', role: 'MLA', constituency: 'Waradhanapet', district: 'Hanamkonda', handles: [] },
  { id: 'ramdas-wyra', name: 'Ramdas Maloth', shortName: 'Ramdas Maloth', role: 'MLA', constituency: 'Wyra', district: 'Khammam', handles: [] },
  { id: 'kanakaiah-yellandu', name: 'Koram Kanakaiah', shortName: 'Koram Kanakaiah', role: 'MLA', constituency: 'Yellandu', district: 'Bhadradri Kothagudem', handles: [] }
];

const ALL_LEADERS = [...CABINET_MINISTERS, ...CONGRESS_MLAS];

module.exports = {
  CABINET_MINISTERS,
  CONGRESS_MLAS,
  ALL_LEADERS
};
