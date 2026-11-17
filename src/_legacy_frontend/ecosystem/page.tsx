import EcosystemClient from "./EcosystemClient";

export const metadata = {
  title: "Ecosystem Hub — Cervos Pharma OS",
  description:
    "Unified 8-stakeholder workspace connecting Patients, Owners, Operators, TMDA Regulators, Researchers, Hospitals, Suppliers, and Prescribers.",
};

export default function EcosystemPage() {
  return <EcosystemClient />;
}

