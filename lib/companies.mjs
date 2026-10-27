// Company classification. Product companies first, services/staffing last.
// Tier 1 = global product/engineering-led. Tier 2 = strong product or GCC.
// Tier 3 = IT services / consulting. Tier 4 = staffing & recruitment agencies.

const TIER1 = [
  "google","microsoft","amazon","aws","apple","meta","facebook","netflix","nvidia","qualcomm",
  "adobe","salesforce","atlassian","stripe","uber","airbnb","linkedin","oracle","sap","vmware",
  "intel","amd","cisco","arista","juniper","akamai","cloudflare","databricks","snowflake",
  "confluent","elastic","grafana","datadog","dynatrace","new relic","splunk","mongodb","redis",
  "hashicorp","github","gitlab","jetbrains","zoom","slack","shopify","spotify","booking",
  "expedia","paypal","visa","mastercard","goldman sachs","morgan stanley","jpmorgan","j.p. morgan",
  "walmart","target","ebay","flipkart","swiggy","zomato","razorpay","zerodha","phonepe","paytm",
  "freshworks","zoho","postman","browserstack","nutanix","netapp","pure storage","rubrik",
  "servicenow","workday","intuit","twilio","okta","crowdstrike","palo alto","fortinet","zscaler",
  "autodesk","ansys","siemens","philips","bosch","ericsson","nokia","samsung","sony",
  "texas instruments","micron","western digital","seagate","dell","hpe","hewlett packard","ibm",
  "red hat","vmware","citrix","f5","commvault","cohesity","veritas","azul","arm","broadcom",
  "uber","lyft","doordash","instacart","block","square","coinbase","robinhood","roblox","unity",
  "ea ","electronic arts","ubisoft","rockstar","epic games","riot games","king","zynga",
  "bloomberg","thomson reuters","relx","lexisnexis","elsevier","wolters kluwer","s&p global",
  "nasdaq","london stock exchange","lseg","ice ","cme group","jump trading","citadel","optiver",
  "jane street","two sigma","de shaw","millennium","point72","hudson river","imc trading",
  "maersk","ikea","h&m","inditex","zara","nike","adidas","unilever","nestl","nespresso",
  "procter","pepsico","coca-cola","mars","mondelez","danone","loreal","l'oreal",
];

const TIER2 = [
  "montycloud","sarvam","celebal","postman","chargebee","druva","icertis","innovaccer",
  "hasura","clevertap","moengage","whatfix","mindtickle","gupshup","exotel","kaleyra",
  "meesho","udaan","cred","groww","upstox","navi","slice","jupiter","khatabook","dunzo",
  "sharechat","dailyhunt","inmobi","glance","pristyn","practo","pharmeasy","lenskart",
  "nykaa","firstcry","bigbasket","blinkit","zepto","rapido","ola","oyo","makemytrip",
  "ixigo","yatra","policybazaar","acko","digit","turtlemint","perfios","signzy",
  "thoughtworks","equal experts","tarento","sahaj","deuglo","sixt","delivery hero",
  "trivago","hellofresh","klarna","spotify","truecaller","sinch","king",
  "optum","unitedhealth","cigna","anthem","cvs","McKesson","athenahealth","veeva",
  "state street","bny mellon","northern trust","blackrock","fidelity","schwab","vanguard",
  "wells fargo","citi","barclays","hsbc","deutsche bank","ubs","credit suisse","standard chartered",
  "bank of america","american express","discover","capital one","synchrony",
  "nationsbenefits","blackbaud","relx",
  "nxp","pubmatic","experity","infineon","stmicroelectronics","analog devices",
  "marvell","synopsys","cadence","renesas","mediatek","skyworks","qorvo","xilinx",
  "arm ","ampere computing","sandisk","kioxia","solidigm","astera labs",
];

const TIER3 = [
  "tcs","tata consultancy","infosys","wipro","cognizant","accenture","capgemini","hcl",
  "tech mahindra","ltimindtree","lti ","mindtree","mphasis","hexaware","birlasoft","zensar",
  "persistent","ust ","virtusa","ntt data","dxc","atos","syntel","sonata","happiest minds",
  "xoriant","globallogic","luxoft","epam","nagarro","incedo","altimetrik","infogain",
  "mastek","cybage","quest global","l&t technology","larsen","kpit","tata elxsi","tata technologies",
  "deloitte","kpmg","pwc","ernst","ey ","mckinsey","bain","bcg","genpact","wns","firstsource",
  "concentrix","teleperformance","conduent","iqvia","qualitykiosk","qualitest","qualatest",
  "aqm technologies","vista info","reflections","maveric","nous","trigent","harman",
  "coforge","niit","3i infotech","intelliswift","apexon","gspann","grid dynamics",
];

const TIER4 = [
  "staffing","recruit","consultancy","consultants","manpower","talent","hiring","hr services",
  "placement","resourcing","workforce","career","jobs","solutions inc","technologies pvt",
  "randstad","adecco","hays","michael page","robert half","korn ferry","team lease","quess",
  "innova solutions","collabera","artech","aptask","mastech","diverse lynx","vdart","sibitalent",
  "intellectt","photon","cielo","allegis","aerotek","insight global","kforce","modis","akkodis",
];

export function classifyCompany(name) {
  if (!name) return { tier: 3, label: "Unknown" };
  const n = name.toLowerCase();
  const hit = list => list.some(k => n.includes(k));
  if (hit(TIER1)) return { tier: 1, label: "Product" };
  if (hit(TIER2)) return { tier: 2, label: "Product" };
  if (hit(TIER4)) return { tier: 4, label: "Staffing" };
  if (hit(TIER3)) return { tier: 3, label: "Services" };
  return { tier: 2.5, label: "Unclassified" };
}

// Reputation nudges the ordering but never rewrites the honest match score.
export function rankValue(scored, company) {
  const { tier } = classifyCompany(company);
  const tierWeight = { 1: 300, 2: 200, 2.5: 120, 3: 40, 4: 0 }[tier] ?? 100;
  const blocked = scored.verdict === "SKIP" ? -500 : 0;
  return tierWeight + scored.score + blocked;
}
