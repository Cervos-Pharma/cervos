// Tanzanian calendar awareness for owner messages: public holidays, the evening before them,
// Ramadan, salary week, the rainy seasons and the weekend. Islamic dates follow the moon, so
// the table below holds the expected dates and the wording says "moon permitting".

export interface CalendarDay {
  key: string;
  en: string;
  sw: string;
  /** Festive days get a warm greeting; memorial days a calm one. */
  festive: boolean;
  lunar?: boolean;
}

const FIXED: Record<string, CalendarDay> = {
  "01-01": { key: "new-year", en: "New Year's Day", sw: "Mwaka Mpya", festive: true },
  "01-12": { key: "zanzibar-revolution", en: "Zanzibar Revolution Day", sw: "Siku ya Mapinduzi ya Zanzibar", festive: false },
  "04-07": { key: "karume", en: "Karume Day", sw: "Siku ya Karume", festive: false },
  "04-26": { key: "union", en: "Union Day", sw: "Siku ya Muungano", festive: true },
  "05-01": { key: "labour", en: "Labour Day", sw: "Sikukuu ya Wafanyakazi", festive: true },
  "07-07": { key: "saba-saba", en: "Saba Saba", sw: "Saba Saba", festive: true },
  "08-08": { key: "nane-nane", en: "Nane Nane", sw: "Nane Nane", festive: true },
  "10-14": { key: "nyerere", en: "Nyerere Day", sw: "Siku ya Nyerere", festive: false },
  "12-09": { key: "independence", en: "Independence Day", sw: "Siku ya Uhuru", festive: true },
  "12-25": { key: "christmas", en: "Christmas", sw: "Krismasi", festive: true },
  "12-26": { key: "boxing", en: "Boxing Day", sw: "Siku ya Kufungua Zawadi", festive: true },
};

// Expected dates (East Africa sighting can shift these by a day).
const LUNAR: Record<string, CalendarDay> = {
  "2026-03-20": { key: "eid-fitr", en: "Eid al-Fitr", sw: "Idd el Fitr", festive: true, lunar: true },
  "2026-05-27": { key: "eid-adha", en: "Eid al-Adha", sw: "Idd el Hajj", festive: true, lunar: true },
  "2026-08-26": { key: "maulid", en: "Maulid", sw: "Maulidi", festive: true, lunar: true },
  "2027-03-10": { key: "eid-fitr", en: "Eid al-Fitr", sw: "Idd el Fitr", festive: true, lunar: true },
  "2027-05-17": { key: "eid-adha", en: "Eid al-Adha", sw: "Idd el Hajj", festive: true, lunar: true },
  "2027-08-15": { key: "maulid", en: "Maulid", sw: "Maulidi", festive: true, lunar: true },
  "2028-02-27": { key: "eid-fitr", en: "Eid al-Fitr", sw: "Idd el Fitr", festive: true, lunar: true },
  "2028-05-05": { key: "eid-adha", en: "Eid al-Adha", sw: "Idd el Hajj", festive: true, lunar: true },
  "2028-08-04": { key: "maulid", en: "Maulid", sw: "Maulidi", festive: true, lunar: true },
};

const RAMADAN_START: Record<string, true> = {
  "2026-02-18": true,
  "2027-02-08": true,
  "2028-01-28": true,
};

/** Western Easter Sunday (anonymous Gregorian algorithm), as YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function shiftDate(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T12:00:00.000Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** The public holiday on a date (YYYY-MM-DD), if any. */
export function holidayOn(isoDate: string): CalendarDay | null {
  const lunar = LUNAR[isoDate];
  if (lunar) return lunar;
  const fixed = FIXED[isoDate.slice(5)];
  if (fixed) return fixed;
  const easter = easterSunday(Number(isoDate.slice(0, 4)));
  if (isoDate === shiftDate(easter, -2)) return { key: "good-friday", en: "Good Friday", sw: "Ijumaa Kuu", festive: false };
  if (isoDate === shiftDate(easter, 1)) return { key: "easter-monday", en: "Easter Monday", sw: "Jumatatu ya Pasaka", festive: true };
  return null;
}

/**
 * One short calendar line for the evening message, or null on an ordinary day.
 * Priority: tomorrow's holiday, today's holiday, Ramadan, rains, salary week, weekend.
 */
export function calendarNudge(eatDate: string, lang: "EN" | "SW", ctx: { lowStockCount: number }): string | null {
  const tomorrow = shiftDate(eatDate, 1);
  const next = holidayOn(tomorrow);
  if (next) {
    const moon = next.lunar ? (lang === "SW" ? " (kwa kuandama mwezi)" : " (moon permitting)") : "";
    return lang === "SW"
      ? `Kesho ni ${next.sw}${moon}. Panga zamu za wafanyakazi na ongeza bidhaa zinazotoka haraka leo.`
      : `Tomorrow is ${next.en}${moon}. Worth sorting staff hours and topping up your fast movers tonight.`;
  }

  const today = holidayOn(eatDate);
  if (today) {
    if (today.festive) {
      return lang === "SW" ? `Heri ya ${today.sw} kwako na timu yako!` : `Happy ${today.en} to you and the team!`;
    }
    return lang === "SW" ? `Tunakutakia ${today.sw} yenye amani.` : `Wishing you a peaceful ${today.en}.`;
  }

  if (RAMADAN_START[tomorrow]) {
    return lang === "SW"
      ? "Ramadhani inaanza kesho (kwa kuandama mwezi). Mchana huwa tulivu na jioni huchangamka, fikiria kufunga baadaye kidogo."
      : "Ramadan starts tomorrow (moon permitting). Days tend to be quieter and evenings busier, so a later close can pay off.";
  }

  const md = eatDate.slice(5);
  if (md === "03-01" || md === "11-01") {
    return lang === "SW"
      ? "Msimu wa mvua unaanza. Wagonjwa wa malaria na kuhara huongezeka, hakikisha dawa za malaria, ORS na zinki zipo za kutosha."
      : "Rainy season is starting. Malaria and diarrhoea cases usually rise, so keep antimalarials, ORS and zinc well stocked.";
  }

  const dayOfMonth = Number(eatDate.slice(8, 10));
  if (dayOfMonth === 25) {
    return lang === "SW"
      ? "Ni wiki ya mishahara. Wateja huongezeka, angalia bidhaa zako zinazotoka zaidi."
      : "It's salary week. Footfall usually picks up, so check your best sellers are on the shelf.";
  }

  const weekday = new Date(`${eatDate}T12:00:00.000Z`).getUTCDay();
  if (weekday === 5 && ctx.lowStockCount > 0) {
    return lang === "SW"
      ? "Wikendi inakaribia, ni wakati mzuri wa kuagiza bidhaa zilizopungua."
      : "Weekend's coming up, a good moment to reorder what's running low.";
  }
  return null;
}
