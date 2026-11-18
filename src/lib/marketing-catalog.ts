export interface MarketingFeaturePage {
  slug: string;
  section: "products" | "markets";
  eyebrowEn: string;
  eyebrowSw: string;
  titleEn: string;
  titleSw: string;
  summaryEn: string;
  summarySw: string;
  image: string;
  roleQuery?: string;
  ctaEn: string;
  ctaSw: string;
  ctaHref: string;
  secondaryCtaEn: string;
  secondaryCtaSw: string;
  secondaryCtaHref: string;
  highlightsEn: Array<{ title: string; body: string }>;
  highlightsSw: Array<{ title: string; body: string }>;
}

export const PRODUCT_CATALOG: Record<string, MarketingFeaturePage> = {
  "counter-pos": {
    slug: "counter-pos",
    section: "products",
    eyebrowEn: "COUNTER POS",
    eyebrowSw: "KAUNTA YA MAUZO",
    titleEn: "A pharmacy register that keeps serving even offline.",
    titleSw: "Kaunta ya dawa inayoendelea kufanya kazi hata bila intaneti.",
    summaryEn:
      "Built for busy neighborhood dispensaries. Scan barcodes, issue thermal receipts in under a second, and reconcile daily shift cash whether fiber is up or down.",
    summarySw:
      "Imetengenezwa kwa maduka yenye shughuli nyingi mtaani. Skani dawa, chapisha risiti papo hapo, na funga hesabu za siku hata mtandao ukikatika.",
    image: "/cervos-counter-station.jpg",
    ctaEn: "Start Counter Setup",
    ctaSw: "Anza Kusanidi Kaunta",
    ctaHref: "/auth?mode=signup&role=pharmacy",
    secondaryCtaEn: "Download Desktop Builds",
    secondaryCtaSw: "Pakua Toleo la Kompyuta",
    secondaryCtaHref: "/downloads",
    highlightsEn: [
      {
        title: "Works Offline First",
        body: "Every sale saves straight to your counter device before syncing quietly when internet returns.",
      },
      {
        title: "Receipt & Scanner Ready",
        body: "Plug in your thermal receipt printer and handheld scanner to serve patients smoothly from minute one.",
      },
      {
        title: "Balanced Evening Tills",
        body: "Every cash, mobile money, and split payment ties cleanly to named operator shifts and printed receipts.",
      },
    ],
    highlightsSw: [
      {
        title: "Mauzo ya Ndani Kwanza",
        body: "Kila mauzo yanahifadhiwa kwanza kwenye kifaa chako kisha kusawazishwa kimya kimya mtandao ukirudi.",
      },
      {
        title: "Tayari Kwa Risiti & Skana",
        body: "Unganisha mashine yako ya risiti na skana za mkono bila usanidi mgumu kuanzia dakika ya kwanza.",
      },
      {
        title: "Hesabu Sahihi za Zamu",
        body: "Malipo ya taslimu na simu yanalingana wazi na zamu za wafanyakazi na risiti zilizotolewa.",
      },
    ],
  },
  "shelf-control": {
    slug: "shelf-control",
    section: "products",
    eyebrowEn: "SHELF & BATCH CONTROL",
    eyebrowSw: "USALAMA WA RAFU",
    titleEn: "Safe medicines first. Expired boxes never sold.",
    titleSw: "Dawa salama kwanza. Zilizopitwa na muda haziuzwi.",
    summaryEn:
      "Every carton enters your dispensary tracked by batch number and expiry date, guiding staff cleanly to earliest safe stock before value sits unsold.",
    summarySw:
      "Kila kasha linaingizwa rafuni na namba yake ya kundi na tarehe ya mwisho, likimwongoza mfanyakazi kutoa mzigo unaokaribia kuisha kwanza.",
    image: "/cervos-dispensary-desk.jpg",
    ctaEn: "Protect Your Shelves",
    ctaSw: "Linda Rafu Zako",
    ctaHref: "/auth?mode=signup&role=pharmacy",
    secondaryCtaEn: "Explore Counter POS",
    secondaryCtaSw: "Tazama Kaunta ya Mauzo",
    secondaryCtaHref: "/products/counter-pos",
    highlightsEn: [
      {
        title: "Earliest Expiry Picked First",
        body: "Checkout automatically selects the closest valid batch date so older stock moves out before going to waste.",
      },
      {
        title: "Hard Checkout Lockout",
        body: "Any medicine past its expiry date cannot pass the register, protecting patients and licensing records.",
      },
      {
        title: "Clear View Across Branches",
        body: "Owners review stock depth and approaching expiries across counters live without calling branch staff.",
      },
    ],
    highlightsSw: [
      {
        title: "Chaguo la Kwanza Kuisha",
        body: "Kaunta inachagua kundi lenye tarehe ya karibu zaidi kwanza ili mtaji usiharibike rafuni.",
      },
      {
        title: "Kizuizi cha Moja kwa Moja",
        body: "Dawa iliyopitwa na muda haipiti kwenye malipo, ikilinda wagonjwa na leseni yako.",
      },
      {
        title: "Muonekano wa Matawi Yote",
        body: "Wamiliki wanaona hali ya rafu na tahadhari za mapema katika matawi yote kwa wakati mmoja.",
      },
    ],
  },
  wholesale: {
    slug: "wholesale",
    section: "products",
    eyebrowEn: "WHOLESALE SUPPLY",
    eyebrowSw: "UGAVI WA JUMLA",
    titleEn: "Direct distributor restocking paid only on delivery.",
    titleSw: "Agiza mzigo moja kwa moja na lipa ukishapokea.",
    summaryEn:
      "Replace manual phone calls and invoice chasing. Pharmacies order straight from licensed Tanzanian distributors through Kasri\u2122 until shelf scan.",
    summarySw:
      "Ondoa simu zisizoisha na kufukuza ankara. Maduka yanaagiza moja kwa moja kwa wasambazaji halali huku malipo yakilindwa na Kasri\u2122 hadi mzigo ufike.",
    image: "/cervos-fleet-van.jpg",
    ctaEn: "Join Wholesale Network",
    ctaSw: "Jiunge na Mtandao wa Ugavi",
    ctaHref: "/auth?mode=signup&role=supplier",
    secondaryCtaEn: "View Live Network",
    secondaryCtaSw: "Tazama Mtandao Hai",
    secondaryCtaHref: "/#network",
    highlightsEn: [
      {
        title: "Settlement via Kasri\u2122",
        body: "Restock funds stay protected through Kasri\u2122 and release cleanly once quantities and expiry dates match on arrival.",
      },
      {
        title: "Route & Van Dispatch",
        body: "Coordinators track deliveries across Dar es Salaam, Arusha, Dodoma, Mwanza, and Zanzibar on one board.",
      },
      {
        title: "Standing Weekly Catalogs",
        body: "Verified wholesalers publish live batch pricing and pack sizes to repeat community buyers.",
      },
    ],
    highlightsSw: [
      {
        title: "Malipo Salama ya Kasri\u2122",
        body: "Pesa inahifadhiwa kupitia Kasri\u2122 na kulipwa mara baada ya kuhakiki idadi na tarehe ya dawa dukani.",
      },
      {
        title: "Ufuatiliaji wa Safari za Magari",
        body: "Wasambazaji wanafuatilia usafirishaji Dar es Salaam, Arusha, Dodoma, Mwanza na Zanzibar kwa pamoja.",
      },
      {
        title: "Orodha ya Bei za Kila Wiki",
        body: "Wasambazaji waliosajiliwa wanaonyesha bei na vifungashio vilivyopo moja kwa moja kwa wanunuzi.",
      },
    ],
  },
};

export const MARKET_CATALOG: Record<string, MarketingFeaturePage> = {
  pharmacies: {
    slug: "pharmacies",
    section: "markets",
    eyebrowEn: "MARKETS · COMMUNITY PHARMACIES",
    eyebrowSw: "MASOKO · MADUKA YA DAWA",
    titleEn: "Built for single shops and multi branch networks.",
    titleSw: "Imetengenezwa kwa maduka binafsi na yenye matawi.",
    summaryEn:
      "Whether serving one busy street corner or ten regional outlets, Cervos keeps counters fast, shelves safe, and reorders effortless.",
    summarySw:
      "Iwe ni duka moja la mtaa au matawi kumi mikoani, Cervos inaweka kaunta kwa kasi, rafu salama, na maagizo rahisi.",
    image: "/cervos-counter-station.jpg",
    ctaEn: "Register Your Pharmacy",
    ctaSw: "Sajili Duka Lako",
    ctaHref: "/auth?mode=signup&role=pharmacy",
    secondaryCtaEn: "Download Counter OS",
    secondaryCtaSw: "Pakua Programu",
    secondaryCtaHref: "/downloads",
    highlightsEn: [
      {
        title: "Keep Serving Without Internet",
        body: "Even when mobile data cuts out at rush hour, every customer receives a clean printed receipt without waiting.",
      },
      {
        title: "Stop Expiring Stock Loss",
        body: "Earliest valid packs move off the shelf first while expired medicine is blocked cleanly at checkout.",
      },
      {
        title: "Clear Daily Profit & Shifts",
        body: "Daily cash, mobile money, and operator shift totals balance cleanly without paper tally headaches.",
      },
    ],
    highlightsSw: [
      {
        title: "Urahisi wa Duka Moja",
        body: "Sakinisha kwenye Windows, Linux, Mac au simu ndani ya dakika chache bila kuhitaji mtaalamu wa IT.",
      },
      {
        title: "Usimamizi wa Matawi Mengi",
        body: "Linganisha mauzo ya siku, faida, na hali ya rafu kwa kila tawi kwa uwazi mmoja.",
      },
      {
        title: "Manunuzi Kutoka Vyanzo Halali",
        body: "Agiza dawa zinazopungua moja kwa moja kutoka kwa wasambazaji waliosajiliwa ndani ya mfumo.",
      },
    ],
  },
  suppliers: {
    slug: "suppliers",
    section: "markets",
    eyebrowEn: "MARKETS · WHOLESALE SUPPLIERS",
    eyebrowSw: "MASOKO · WASAMBAZAJI",
    titleEn: "Reach verified dispensing pharmacies every week.",
    titleSw: "Fikia maduka halali yanayoagiza kila wiki.",
    summaryEn:
      "Turn fragmented phone quotes into dependable recurring wholesale fulfillment backed by Kasri\u2122.",
    summarySw:
      "Badilisha maagizo ya simu yasiyo na mpangilio kuwa mauzo thabiti ya kila wiki yanayolindwa na Kasri\u2122.",
    image: "/cervos-fleet-van.jpg",
    ctaEn: "Join as Supplier",
    ctaSw: "Jiunge kama Msambazaji",
    ctaHref: "/auth?mode=signup&role=supplier",
    secondaryCtaEn: "See Wholesale Capabilities",
    secondaryCtaSw: "Tazama Mfumo wa Ugavi",
    secondaryCtaHref: "/products/wholesale",
    highlightsEn: [
      {
        title: "Verified Pharmacy Buyers",
        body: "Every ordering counter is verified across active neighborhoods before trading begins.",
      },
      {
        title: "Zero Invoice Chasing",
        body: "Buyers fund orders through Kasri\u2122 ahead of dispatch, releasing payment cleanly when boxes are confirmed delivered.",
      },
      {
        title: "Batch Recall & Traceability",
        body: "Track which batch numbers went to which corridor in seconds whenever manufacturers issue updates.",
      },
    ],
    highlightsSw: [
      {
        title: "Wanunuzi Waliohakikiwa",
        body: "Kila duka linalotuma oda linathibitishwa kabla ya kujiunga na mtandao.",
      },
      {
        title: "Hakuna Kufukuza Ankara",
        body: "Mnunuzi anaweka malipo kwenye Kasri\u2122 mapema na yanatumwa kwako mara mzigo ukifika.",
      },
      {
        title: "Ufuatiliaji wa Makundi ya Dawa",
        body: "Jua haraka kundi lipi lilipelekwa wapi endapo kunahitajika ufuatiliaji wa dharura.",
      },
    ],
  },
  clinics: {
    slug: "clinics",
    section: "markets",
    eyebrowEn: "MARKETS · CLINICS & RESEARCH",
    eyebrowSw: "MASOKO · KLINIKI NA UTAFITI",
    titleEn: "Auditable dispensing and supply intelligence across regions.",
    titleSw: "Utoaji dawa wenye kumbukumbu na takwimu za kikanda.",
    summaryEn:
      "Support public health clinics, clinical programs, and health researchers with clean stock continuity and anonymized movement insights.",
    summarySw:
      "Saidia zahanati, programu za afya, na watafiti kwa mfululizo thabiti wa dawa na takwimu safi za soko.",
    image: "/cervos-dispensary-desk.jpg",
    ctaEn: "Partner with Us",
    ctaSw: "Shirikiana Nasi",
    ctaHref: "/auth?mode=signup&role=researcher",
    secondaryCtaEn: "See Partner Hubs",
    secondaryCtaSw: "Tazama Wadau Wetu",
    secondaryCtaHref: "/partners",
    highlightsEn: [
      {
        title: "Zero Paper Binders",
        body: "Follow medicines cleanly from depot delivery straight to patient dispensing in one quiet screen.",
      },
      {
        title: "Prevent Clinic Stockouts",
        body: "Notice essential items running low days ahead so patient treatments never get delayed.",
      },
      {
        title: "Built For Busy Staff Teams",
        body: "English and Kiswahili work side by side so clinical, store, and outreach staff stay aligned.",
      },
    ],
    highlightsSw: [
      {
        title: "Kumbukumbu Sahihi za Dawa",
        body: "Fuatilia safari ya dawa kutoka ghala mpaka mgonjwa bila madaftari mengi ya karatasi.",
      },
      {
        title: "Dalili za Upungufu Mapema",
        body: "Tambua upungufu wa dawa muhimu mapema katika mikoa mbalimbali.",
      },
      {
        title: "Lugha Mbili Kwa Timu Zote",
        body: "Kiingereza na Kiswahili vinafanya kazi pamoja kwa uelewa wa pamoja kazini.",
      },
    ],
  },
};
