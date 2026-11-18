export type TourTabTarget =
  | "overview"
  | "inventory"
  | "operations"
  | "receipts"
  | "billing"
  | "team";

export interface GuidedTourStep {
  id: string;
  target: string | null;
  tab: TourTabTarget;
  badge: string;
  title: string;
  body: string;
  tip: string;
  actionLabel?: string;
}

export function buildWorkspaceTourSteps(params: {
  orgName: string;
  branchName: string;
  isSw: boolean;
}): GuidedTourStep[] {
  const { orgName, branchName, isSw } = params;

  if (isSw) {
    return [
      {
        id: "branch-isolation",
        target: '[data-tour="branch-header"]',
        tab: "overview",
        badge: "1 / 5 · TAWI LAKO",
        title: `Karibu kwenye Kituo cha ${branchName}`,
        body: `Stoo, mauzo ya kaunta, risiti, matumizi na soga za timu ya ${branchName} zimetenganishwa na matawi mengine ya ${orgName}. Badili tawi juu wakati wowote unapotaka kukagua kituo kingine.`,
        tip: "Kila tawi lina hesabu zake binafsi bila kuchanganyika.",
      },
      {
        id: "shift-check",
        target: '[data-tour="shift-launch-card"]',
        tab: "overview",
        badge: "2 / 5 · ZAMU YA KAZI",
        title: "Anza Zamu Hapa Nyumbani",
        body: "Unapofungua app, thibitisha kuwa uko zamu moja kwa moja hapa kabla ya kuuza. Ukiacha programu nje kwa saa nyingi bila shughuli, zamu itafungwa kiotomatiki kulinda fedha zako.",
        tip: "Hakikisha umefunga droo ya fedha mwisho wa zamu.",
      },
      {
        id: "counter-pos",
        target: '[data-tour="open-pos-cta"]',
        tab: "overview",
        badge: "3 / 5 · KAUNTA YA POS",
        title: "Kaunta ya Mauzo & Ulinzi wa Muda",
        body: "Changanua msimbopau au gonga dawa kuweka kikapuni. Dawa za kuisha mapema hutoka kwanza, na zilizopitwa na muda au kuwekwa karantini huzuiliwa kiotomatiki.",
        tip: "Kwenye Stoo, andika jina la dawa iliyokuwepo ili kujaza taarifa za awali haraka.",
        actionLabel: "Fungua Kaunta ya POS",
      },
      {
        id: "hardware-settings",
        target: '[data-tour="hardware-settings-link"]',
        tab: "overview",
        badge: "4 / 5 · VIFAA NA SAUTI",
        title: "Printa Halisi, Skana & Sauti",
        body: "Unganisha printa ya risiti ya USB, Serial, au Bluetooth, pima skana yako, na rekebisha sauti katika ukurasa wa Mipangilio ya POS ili kaunta ibaki safi kwa mauzo pekee.",
        tip: "Unaweza kufungua Mipangilio ya POS moja kwa moja kutoka ndani ya Kaunta.",
      },
      {
        id: "branch-chat-hq",
        target: '[data-tour="branch-chat-cta"]',
        tab: "overview",
        badge: "5 / 5 · TIMU & MSAADA",
        title: "Soga ya Tawi na Msaada wa HQ",
        body: "Soga ya timu huonekana kwa wafanyakazi wa tawi hili pekee. Ukihitaji msaada wa kiufundi au malipo kutoka Cervos HQ, tuma tiketi kupitia Mipangilio au kikasha cha HQ.",
        tip: "Rudia mwongozo huu wakati wowote kutoka kitufe cha Mwongozo juu.",
      },
    ];
  }

  return [
    {
      id: "branch-isolation",
      target: '[data-tour="branch-header"]',
      tab: "overview",
      badge: "1 / 5 · BRANCH ISOLATION",
      title: `Welcome to ${branchName}`,
      body: `Inventory batches, counter receipts, cash drawer totals, and staff chat for ${branchName} stay strictly separated from other branches in ${orgName}. Use the header scope pill whenever checking another branch.`,
      tip: "Selling or editing batches here never touches another location's stock.",
    },
    {
      id: "shift-check",
      target: '[data-tour="shift-launch-card"]',
      tab: "overview",
      badge: "2 / 5 · SHIFT CHECK-IN",
      title: "Clock In Right on Launch",
      body: "Confirm you are on shift directly at the top of Home before ringing up patients. Staying away from the app for over 4 hours automatically clocks out your shift to keep cash and attendance accurate.",
      tip: "Managers can still review every shift punch in Operations.",
    },
    {
      id: "counter-pos",
      target: '[data-tour="open-pos-cta"]',
      tab: "overview",
      badge: "3 / 5 · COUNTER POS",
      title: "Fast Counter Sales & Batch Protection",
      body: "Scan barcodes or tap medicines to build a basket. Earliest valid expiry batches sell first, while expired or quarantined boxes are automatically blocked. When restocking in Inventory, typing an existing brand fills in common fields for you.",
      tip: "Pick from category presets or add your own custom medicine categories.",
      actionLabel: "Open Counter POS",
    },
    {
      id: "hardware-settings",
      target: '[data-tour="hardware-settings-link"]',
      tab: "overview",
      badge: "4 / 5 · HARDWARE & AUDIO",
      title: "Dedicated POS Settings & Diagnostics",
      body: "Thermal receipt printer pairing (USB, Serial, Bluetooth, or system print), barcode scanner testing, sound controls, and troubleshooting live cleanly under Settings so Counter POS stays focused strictly on selling.",
      tip: "There is also a direct POS Settings shortcut inside the Counter POS header.",
    },
    {
      id: "branch-chat-hq",
      target: '[data-tour="branch-chat-cta"]',
      tab: "overview",
      badge: "5 / 5 · TEAM & SUPPORT",
      title: "Branch-Only Chat & HQ Help Desk",
      body: "Messages and @mentions stay private to colleagues inside this branch. Whenever you need help with billing, hardware, or accounts, submit a support ticket straight from Settings or your HQ inbox.",
      tip: "Replay this walkthrough anytime from the Quick Tour button.",
    },
  ];
}
