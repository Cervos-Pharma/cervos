import type { ProfileCapabilities } from "@/utils/permissions";
import type { AppLang, WorkspaceShiftLog } from "@/types/workspace";

export type MobileTourRoute =
  | "/(tabs)"
  | "/(tabs)/pos"
  | "/(tabs)/inventory"
  | "/settings?scope=hardware"
  | "/branch-chat"
  | "/wholesale";

export interface MobileTourStep {
  id: string;
  badge: string;
  title: string;
  body: string;
  tip: string;
  actionLabel?: string;
  route?: MobileTourRoute;
}

export interface StationChecklistItem {
  id: string;
  label: string;
  done: boolean;
  route: MobileTourRoute;
}

export function buildMobileTourSteps(params: {
  orgName: string;
  branchName: string;
  lang: AppLang;
  capabilities: ProfileCapabilities;
}): MobileTourStep[] {
  const { orgName, branchName, lang, capabilities } = params;
  const isSw = lang === "SW";

  if (isSw) {
    return [
      {
        id: "branch-isolation",
        badge: "1 / 5 · TAWI LAKO",
        title: `Karibu Kituo cha ${branchName}`,
        body: `Stoo, risiti za kaunta, na soga ya timu ya ${branchName} vimetenganishwa kikamilifu na matawi mengine ya ${orgName}. Gusa jina la tawi juu wakati wowote kuhama tawi.`,
        tip: "Hakuna mwingiliano wa makundi au fedha kati ya matawi.",
        route: "/(tabs)",
      },
      {
        id: "shift-check",
        badge: "2 / 5 · ZAMU YA KAZI",
        title: "Anza Zamu Moja kwa Moja Nyumbani",
        body: "Kadi ya zamu inaonekana juu kabisa ukifungua app. Thibitisha uko kazini hapo hapo. Ukiacha programu nje kwa zaidi ya saa 4, itakufungia zamu kiotomatiki.",
        tip: "Hii inalinda mahesabu yako ya droo mwisho wa siku.",
        route: "/(tabs)",
      },
      {
        id: "counter-pos",
        badge: "3 / 5 · KAUNTA YA POS",
        title: capabilities.canSellPos ? "Kaunta Safi, Mauzo Hata Bila Mtandao" : "Ufuatiliaji wa Stoo & Mauzo",
        body: "Kaunta inaonyesha mauzo na skana pekee bila fujo za mipangilio. Hata mtandao ukikatika, mauzo yanahifadhiwa salama kwenye kifaa na kutumwa ukirudi.",
        tip: "Makundi ya kuisha mapema hutangulia kuuzwa, na yaliyokwisha muda huzuiwa.",
        actionLabel: capabilities.canSellPos ? "Fungua Kaunta ya POS" : "Fungua Stoo",
        route: capabilities.canSellPos ? "/(tabs)/pos" : "/(tabs)/inventory",
      },
      {
        id: "hardware-settings",
        badge: "4 / 5 · VIFAA NA SAUTI",
        title: "Printa 58mm/80mm & Sauti Zinaishi Mipangilio",
        body: "Weka ukubwa wa karatasi ya risiti, jaribu sauti za skana, au tuma tiketi ya msaada kwa Cervos HQ kupitia ukurasa wa Mipangilio.",
        tip: "Unaweza kufungua Mipangilio ya POS kupitia alama ya gia juu ya kaunta.",
        actionLabel: "Fungua Mipangilio ya POS",
        route: "/settings?scope=hardware",
      },
      {
        id: "chat-wholesale",
        badge: "5 / 5 · TIMU & BOHARI",
        title: "Soga ya Tawi & Maagizo ya Kasri",
        body: "Wasiliana na wenzako wa tawi hili pekee au tuma ombi la kuongeza mzigo kutoka orodha ya bohari iliyothibitishwa.",
        tip: "Unaweza kurudia mwongozo huu wakati wowote kutoka tabo ya Zaidi.",
        actionLabel: "Fungua Soga ya Tawi",
        route: "/branch-chat",
      },
    ];
  }

  return [
    {
      id: "branch-isolation",
      badge: "1 / 5 · BRANCH ISOLATION",
      title: `Welcome to ${branchName}`,
      body: `Stock batches, counter sales, expenses, and staff chat for ${branchName} remain strictly separated from other branches of ${orgName}. Tap the branch title at the top of Home anytime to switch scope.`,
      tip: "Changes made here never spill over into another location.",
      route: "/(tabs)",
    },
    {
      id: "shift-check",
      badge: "2 / 5 · SHIFT CHECK-IN",
      title: "Confirm Your Shift on Launch",
      body: "The shift status bar sits right at the top of Home when you open the app. Clock in with one tap before billing patients. Leaving the app inactive for over 4 hours clocks you out automatically.",
      tip: "Shift punches keep attendance and drawer handoffs accurate.",
      route: "/(tabs)",
    },
    {
      id: "counter-pos",
      badge: "3 / 5 · COUNTER & OFFLINE",
      title: capabilities.canSellPos ? "Focused Counter POS & Offline Queue" : "Stock & Batch Controls",
      body: "Counter POS stays dedicated to scanning, prescriptions, and checkout with zero settings clutter. If mobile data drops, sales save safely in local storage and sync when signal returns.",
      tip: "Soon-to-expire stock sells first, and expired or quarantined packs are automatically blocked.",
      actionLabel: capabilities.canSellPos ? "Open Counter POS" : "Open Inventory",
      route: capabilities.canSellPos ? "/(tabs)/pos" : "/(tabs)/inventory",
    },
    {
      id: "hardware-settings",
      badge: "4 / 5 · HARDWARE & AUDIO",
      title: "Printers & Sound Live in Settings",
      body: "Choose 58mm or 80mm thermal paper, test audio cues, and reach HQ support from Settings instead of crowding the sales counter.",
      tip: "Use the gear icon on Counter POS to jump directly to POS Hardware anytime.",
      actionLabel: "Open POS Hardware",
      route: "/settings?scope=hardware",
    },
    {
      id: "chat-wholesale",
      badge: "5 / 5 · TEAM & WHOLESALE",
      title: "Branch Chat & Verified Wholesale",
      body: "Message colleagues inside this branch privately, or browse verified suppliers and escrow-protected Kasri orders under More.",
      tip: "Replay this walkthrough anytime from the More tab.",
      actionLabel: "Open Branch Chat",
      route: "/branch-chat",
    },
  ];
}

export function computeStationChecklist(params: {
  lang: AppLang;
  capabilities: ProfileCapabilities;
  activeShift: WorkspaceShiftLog | null;
  batchCount: number;
  saleCount: number;
}): StationChecklistItem[] {
  const { lang, capabilities, activeShift, batchCount, saleCount } = params;
  const isSw = lang === "SW";

  const items: StationChecklistItem[] = [
    {
      id: "clock_in",
      label: isSw ? "Thibitisha au anza zamu yako ya leo" : "Clock into your shift on Home",
      done: Boolean(activeShift),
      route: "/(tabs)",
    },
  ];

  if (capabilities.canEditInventory || batchCount === 0) {
    items.push({
      id: "stock_ready",
      label: isSw ? "Hakiki au pokea kundi la kwanza stooni" : "Verify or add first stock batch",
      done: batchCount > 0,
      route: "/(tabs)/inventory",
    });
  }

  if (capabilities.canSellPos) {
    items.push({
      id: "first_sale",
      label: isSw ? "Jaribu kutoa risiti au kukagua Kaunta POS" : "Complete a sale or test Counter POS",
      done: saleCount > 0,
      route: "/(tabs)/pos",
    });
  }

  items.push({
    id: "hardware_check",
    label: isSw ? "Kagua ukubwa wa risiti (58mm/80mm) & sauti" : "Check 58mm/80mm receipt & audio setup",
    done: false,
    route: "/settings?scope=hardware",
  });

  return items;
}
