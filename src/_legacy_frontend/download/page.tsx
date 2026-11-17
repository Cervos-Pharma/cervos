/**
 * @route    /download
 * @access   Public — no sign-in required.
 * @description Product/marketing page for the Cervos desktop endpoint app.
 *   Anyone can visit, read about the app, and download the installer for their platform.
 *   After installing, the app itself guides the user to link to an admin account.
 *   Real download links are managed by HQ via the download management console;
 *   until files are uploaded, the download buttons show a "coming soon" toast.
 */
import DownloadClient from "./DownloadClient";
import { getCurrentReleases } from "@/lib/actions/hq";

export default async function DownloadPage() {
  // Fetch current releases for each platform (service-role, bypasses RLS).
  // Page is public — no auth required.
  const { data: releases } = await getCurrentReleases();
  return <DownloadClient releases={releases ?? {}} />;
}
