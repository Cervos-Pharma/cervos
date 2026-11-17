export type EssayTopic = "field" | "craft" | "supply";

export interface DispatchEssay {
  slug: string;
  issue: string;
  topic: EssayTopic;
  topicLabelEn: string;
  topicLabelSw: string;
  readTimeEn: string;
  readTimeSw: string;
  dateEn: string;
  dateSw: string;
  author: string;
  authorRoleEn: string;
  authorRoleSw: string;
  titleEn: string;
  titleSw: string;
  deckEn: string;
  deckSw: string;
  image: string;
  quoteEn: string;
  quoteSw: string;
  paragraphsEn: string[];
  paragraphsSw: string[];
  baseUpvotes: number;
}

export const DISPATCH_ESSAYS: DispatchEssay[] = [
  {
    slug: "rainy-evening-kariakoo",
    issue: "ISSUE 04",
    topic: "field",
    topicLabelEn: "Field Notes",
    topicLabelSw: "Simulizi za Mtaa",
    readTimeEn: "4 min read",
    readTimeSw: "Dakika 4",
    dateEn: "Nov 2026",
    dateSw: "Novemba 2026",
    author: "Neema Mbeki",
    authorRoleEn: "Dispensary Operations, Kariakoo",
    authorRoleSw: "Msimamizi wa Kaunta, Kariakoo",
    titleEn: "Six o'clock rain, and why a pharmacy counter never waits on a signal tower.",
    titleSw: "Mvua ya saa kumi na mbili jioni, na kwa nini kaunta haipaswi kusubiri mtandao.",
    deckEn:
      "What evening queues in busy neighborhood shops teach us about keeping everyday healthcare sales fast, calm, and completely local when mobile data slows.",
    deckSw:
      "Tunachojifunza kutokana na msongamano wa jioni kwenye maduka ya mtaa kuhusu kuweka mauzo ya haraka ndani ya kifaa kwanza.",
    image: "/cervos-people-counter.jpg",
    quoteEn:
      "A parent standing across the counter with a child's prescription should never wait for a spinning wheel before getting medicine.",
    quoteSw:
      "Mzazi aliyesimama kauntani akiwa na cheti cha mtoto hapaswi kusubiri mtandao upatikane kabla hajapewa dawa.",
    paragraphsEn: [
      "Between five and eight every evening, neighborhood pharmacies come alive. Office workers step off buses, parents arrive straight from nearby clinics, and sudden coastal rain often slows cellular towers across town.",
      "Sitting behind ordinary wooden counters taught us early on that software designed for silent offices breaks in real street commerce. When a queue grows and every barcode lookup pauses for remote confirmation, stress spreads on both sides of the desk.",
      "That insight is why every sale inside Cervos writes straight to the counter workstation first. Receipts print instantaneously, shift totals reconcile against drawer cash in peace, and quiet synchronization happens automatically once connectivity clears.",
    ],
    paragraphsSw: [
      "Kati ya saa kumi na moja na saa mbili usiku, maduka mengi ya dawa mtaani yanajaa wateja wanaotoka kazini na vituo vya afya, mara nyingi wakati mvua ikipunguza kasi ya mtandao.",
      "Kukaa nyuma ya kaunta za kawaida kulitufundisha kuwa programu zinazotegemea mawimbi ya mbali husimamisha foleni na kuongeza msongo kwa mhudumu na mgonjwa.",
      "Ndiyo maana kaunta ya Cervos huhifadhi mauzo na kuchapisha risiti papo hapo ndani ya kompyuta ya duka kwanza, na kusawazisha kimya kimya mtandao ukirudi.",
    ],
    baseUpvotes: 64,
  },
  {
    slug: "quiet-shelf-capital",
    issue: "ESSAY 03",
    topic: "craft",
    topicLabelEn: "Craft & Practice",
    topicLabelSw: "Utunzaji wa Rafu",
    readTimeEn: "3 min read",
    readTimeSw: "Dakika 3",
    dateEn: "Oct 2026",
    dateSw: "Oktoba 2026",
    author: "Baraka John",
    authorRoleEn: "Product Craft, Dar es Salaam",
    authorRoleSw: "Ubunifu wa Bidhaa, Dar es Salaam",
    titleEn: "The working capital sleeping unseen at the back of the storeroom.",
    titleSw: "Mtaji uliolala kimya kwenye rafu ya nyuma.",
    deckEn:
      "Why silent expiry eats into independent pharmacy earnings faster than shrinkage, and how ordinary phone checks bring cash back before dates pass.",
    deckSw:
      "Kwa nini boksi chache zilizoisha muda hupunguza faida ya duka kimyakimya, na jinsi ukaguzi mwepesi wa simu unavyookoa mtaji.",
    image: "/cervos-people-stockroom.jpg",
    quoteEn:
      "Small shop profit rarely vanishes in dramatic ways; most of the time it sits unnoticed behind newer cartons on an upper shelf.",
    quoteSw:
      "Faida ya duka mara nyingi haipotei mezani kwa mhasibu; inalala kimya nyuma ya maboksi mapya kwenye rafu ya juu.",
    paragraphsEn: [
      "Most community pharmacists only spot outdated packs during annual stock counts, long after the window for wholesale exchange or promotional clearance has shut.",
      "Rather than forcing small dispensaries to invest in specialized industrial terminals, staff use the phones already sitting in their pockets. Clean batch dates lock at intake and gently guide the front counter to oldest safe stock first.",
      "Keeping the shelf organized with calm clarity saves real everyday capital so shopkeepers can expand essential stock rather than writing off expired cartons.",
    ],
    paragraphsSw: [
      "Wamiliki wengi hugundua pakiti zilizopitwa na muda mwishoni mwa mwaka wakati muda wa kuzibadilisha kwa msambazaji umeshapita.",
      "Badala ya kulazimisha vifaa vigumu vya gharama, wahudumu hutumia simu zao za kawaida kurekodi tarehe mzigo unapoingia na kutoa kundi salama la zamani kwanza.",
      "Mpangilio huu huokoa mtaji halisi wa duka na kuwapa wahudumu utulivu wanapomhudumia kila mteja.",
    ],
    baseUpvotes: 49,
  },
  {
    slug: "trust-along-corridor",
    issue: "ESSAY 02",
    topic: "supply",
    topicLabelEn: "Supply Notes",
    topicLabelSw: "Safari ya Ugavi",
    readTimeEn: "5 min read",
    readTimeSw: "Dakika 5",
    dateEn: "Sep 2026",
    dateSw: "Septemba 2026",
    author: "Rehema Kweka",
    authorRoleEn: "Regional Fulfillment, Arusha",
    authorRoleSw: "Ushirikiano wa Ugavi, Arusha",
    titleEn: "Clearer handoffs between regional warehouses and neighborhood shops.",
    titleSw: "Kujenga imani kati ya ghala la mkoa na duka la mtaa.",
    deckEn:
      "How everyday conversations with van drivers and storekeepers shaped Kasri\u2122 so both sides trade comfortably without chasing lost slips.",
    deckSw:
      "Jinsi mazungumzo na madereva na wamiliki wa maduka yalivyoongoza muundo wa Kasri\u2122 ili wote waaminiane njiani.",
    image: "/cervos-people-delivery.jpg",
    quoteEn:
      "Regional trade grows steadier when neither the driver dropping crates at the door nor the shop owner counting notes has to guess.",
    quoteSw:
      "Biashara ya mikoani hukua kwa uhakika pale ambapo dereva wa mzigo na mwenye duka wote wana amani kamili.",
    paragraphsEn: [
      "Across East African highways, medicine replenishment moves through long-standing trust between local depots, drivers, and shop proprietors. Even so, faded paper waybills and delayed transfer confirmations still consume whole afternoons every Friday.",
      "Working directly beside depot teams showed us neither side wanted complicated financial bureaucracy. Both simply needed one shared milestone at the curb: buyers confirm genuine packs are on site, and payment reaches the wholesaler right away via Kasri\u2122.",
      "When doorstep handoffs stay clear and verifiable, neighborhood pharmacies receive vital stock sooner and drivers move smoothly to the next town.",
    ],
    paragraphsSw: [
      "Katika barabara nyingi za mikoani, usambazaji wa dawa hutegemea uaminifu wa muda mrefu baina ya maghala, madereva, na maduka, lakini risiti za karatasi bado hupoteza muda mwingi.",
      "Kwa kushirikiana na timu za maghala, tuliona suluhisho rahisi zaidi ni hatua moja ya uhakika mlangoni: mnunuzi anakagua mzigo halali dukani, na Kasri\u2122 inakamilisha malipo kwa msambazaji papo hapo.",
      "Matokeo yake ni ugavi wa haraka na heshima kwa kila mtu anayebeba dawa njiani.",
    ],
    baseUpvotes: 41,
  },
];

export function getDispatchEssayBySlug(slug: string): DispatchEssay | undefined {
  return DISPATCH_ESSAYS.find((e) => e.slug === slug);
}
