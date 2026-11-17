import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  HQ_COOKIE_NAME,
  HQ_OP_COOKIE,
  isHqMockMode,
  isHqSecretConfigured,
  isValidHQToken,
  verifyHqPortalGateSlug,
} from "@/lib/hq-auth";
import HQConsoleClient from "@/components/hq/HQConsoleClient";
import HQLoginGate from "@/components/hq/HQLoginGate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "CV-Ops Node v9",
  robots: { index: false, follow: false },
};

export default async function ObfuscatedOpsPortalPage({
  params,
}: {
  params: Promise<{ gate: string }>;
}) {
  const { gate } = await params;
  if (!verifyHqPortalGateSlug(gate)) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_COOKIE_NAME)?.value;
  const mockMode = isHqMockMode();
  const isAuthed = isValidHQToken(token);

  if (!isAuthed) {
    return (
      <HQLoginGate
        gateSlug={gate}
        mockMode={mockMode}
        secretConfigured={isHqSecretConfigured()}
        challengeRequired={Boolean((process.env.HQ_OPERATOR_PIN ?? "").trim())}
      />
    );
  }

  const operator =
    cookieStore.get(HQ_OP_COOKIE)?.value ||
    (mockMode ? "Ops Sandbox Desk" : "Ops Clearance Unit");

  return <HQConsoleClient gateSlug={gate} initialOperator={operator} mockMode={mockMode} />;
}
