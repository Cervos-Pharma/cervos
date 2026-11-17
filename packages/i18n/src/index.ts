export type CervosLocale = "en" | "sw";

export interface CervosDictionary {
  appTitle: string;
  commandHint: string;
  stakeholdersTitle: string;
  fefoBlockedExpired: string;
  rxRequiredPrompt: string;
  shiftCloseLabel: string;
  grnReceiveButton: string;
  pinLockButton: string;
  cloudSessionActive: string;
  stakeholderPatient: string;
  stakeholderOwner: string;
  stakeholderOperator: string;
  stakeholderRegulator: string;
  stakeholderResearcher: string;
  stakeholderHospital: string;
  stakeholderSupplier: string;
  stakeholderPrescriber: string;

  // Accounting & Financial Ledger
  accountingTitle: string;
  salesRevenue: string;
  grossMargin: string;
  netProfit: string;
  taxVat: string;
  invoicesReceivable: string;
  accountsPayable: string;
  cashOnHand: string;
  mpesaFloat: string;
  bankReconciliation: string;
  escrowSettlements: string;
  costOfGoodsSold: string;
  currencyTzs: string;
  debit: string;
  credit: string;
  balance: string;
}

export const CERVOS_DICTIONARIES: Record<CervosLocale, CervosDictionary> = {
  en: {
    appTitle: "Cervos Pharma OS",
    commandHint: "Jump across workspaces & 8 stakeholder lenses (Ctrl+K)",
    stakeholdersTitle: "8 Connected Ecosystem Stakeholders",
    fefoBlockedExpired: "Expired batch blocked by FEFO safety gate",
    rxRequiredPrompt: "Enter Prescription Ref or Claim Token",
    shiftCloseLabel: "Close Cash Shift (Blind Count)",
    grnReceiveButton: "Confirm Delivery into Stock (GRN)",
    pinLockButton: "Lock Operator PIN",
    cloudSessionActive: "Branch Cloud Sync Connected",
    stakeholderPatient: "Patient",
    stakeholderOwner: "Business Owner",
    stakeholderOperator: "Business Operator",
    stakeholderRegulator: "Regulator (TMDA)",
    stakeholderResearcher: "Researcher",
    stakeholderHospital: "Hospital",
    stakeholderSupplier: "Supplier",
    stakeholderPrescriber: "Prescriber",

    // Accounting & Financial Ledger
    accountingTitle: "Accounting & Financial Ledger",
    salesRevenue: "Sales Revenue",
    grossMargin: "Gross Margin",
    netProfit: "Net Profit",
    taxVat: "Value Added Tax (18% VAT)",
    invoicesReceivable: "Customer Invoices (Receivable)",
    accountsPayable: "Supplier Bills (Payable)",
    cashOnHand: "Cash on Hand",
    mpesaFloat: "M-Pesa Till Float",
    bankReconciliation: "Bank & Mobile Money Reconciliation",
    escrowSettlements: "PayMe Escrow Settlements",
    costOfGoodsSold: "Cost of Goods Sold (COGS)",
    currencyTzs: "Tanzanian Shilling (TZS)",
    debit: "Debit",
    credit: "Credit",
    balance: "Balance",
  },
  sw: {
    appTitle: "Cervos Pharma OS",
    commandHint: "Nenda haraka kati ya sehemu za kazi (Ctrl+K)",
    stakeholdersTitle: "Wadau 8 Waliounganishwa Kwenye Mfumo",
    fefoBlockedExpired: "Dawa iliyokwisha muda imezuiwa na usalama wa FEFO",
    rxRequiredPrompt: "Weka Namba ya Cheti cha Daktari au Claim Token",
    shiftCloseLabel: "Funga Zamu ya Fedha",
    grnReceiveButton: "Thibitisha Kupokea Dawa Stoo (GRN)",
    pinLockButton: "Funga PIN ya Mhudumu",
    cloudSessionActive: "Usawazishaji wa Wingu Umeunganishwa",
    stakeholderPatient: "Mgonjwa",
    stakeholderOwner: "Mmiliki wa Biashara",
    stakeholderOperator: "Mhudumu wa Duka",
    stakeholderRegulator: "Mdhibiti (TMDA)",
    stakeholderResearcher: "Mtafiti",
    stakeholderHospital: "Hospitali",
    stakeholderSupplier: "Msambazaji",
    stakeholderPrescriber: "Daktari Mwandishi",

    // Accounting & Financial Ledger
    accountingTitle: "Uhasibu na Daftari la Fedha",
    salesRevenue: "Mapato ya Mauzo",
    grossMargin: "Faida Ghafi",
    netProfit: "Faida Halisi",
    taxVat: "Kodi ya Ongezeko la Thamani (18% VAT)",
    invoicesReceivable: "Ankara za Wateja (Madeni)",
    accountsPayable: "Madeni ya Wauzaji (Kulipa)",
    cashOnHand: "Fedha Taslimu Mkononi",
    mpesaFloat: "Salio la M-Pesa",
    bankReconciliation: "Upatanisho wa Benki na Pesa za Simu",
    escrowSettlements: "Malipo ya Amana ya PayMe",
    costOfGoodsSold: "Gharama ya Bidhaa Zilizouzwa",
    currencyTzs: "Shilingi ya Tanzania (TZS)",
    debit: "Deni",
    credit: "Mikopo",
    balance: "Salio",
  },
};

export function getCervosText(
  locale: CervosLocale,
  key: keyof CervosDictionary
): string {
  return CERVOS_DICTIONARIES[locale]?.[key] ?? CERVOS_DICTIONARIES.en[key];
}
