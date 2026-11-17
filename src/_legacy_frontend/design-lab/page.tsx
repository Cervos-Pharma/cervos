import type { Metadata } from "next";
import DesignLabClient from "./DesignLabClient";

export const metadata: Metadata = {
  title: "Cervos Design Lab — Premier Simplicity Taste Switcher",
  description:
    "Live interactive taste switcher for Cervos Pharma: explore Counter POS, Owner Pulse, Wholesale Supplier, and @cervos/ui v2 flows across 4 product design directions.",
};

export default function DesignLabPage() {
  return <DesignLabClient />;
}
