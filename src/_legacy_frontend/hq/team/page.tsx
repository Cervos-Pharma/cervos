/**
 * @route /hq/team
 * @access HQ operators only — validated via hq_sess cookie.
 * @description Server component that lists HQ team members and passes them to
 *   the interactive client component for add / disable / remove actions.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";
import HQSidebarServer from "@/components/HQSidebarServer";
import { listHQAdmins } from "@/lib/actions/hq";
import HQTeamClient from "./HQTeamClient";
import { getT } from "@/lib/i18n/server";

export default async function HQTeamPage() {
  const t = await getT();
  const cookieStore = await cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) redirect("/hq");

  const result = await listHQAdmins();

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 min-w-0 lg:ml-64 p-8 pt-12">
        <div className="max-w-5xl">
          <div className="mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
              {t("hqnet.console")}
            </p>
            <h1 className="font-headline-lg text-headline-lg text-ink-deep">{t("hq.team")}</h1>
          </div>

          <HQTeamClient
            admins={result.data}
            error={result.error}
          />
        </div>
      </main>
    </div>
  );
}
