import { notFound } from "next/navigation";

/**
 * Plain `/hq` endpoint is intentionally disabled so scanners cannot probe a predictable admin route.
 * Access the Operations Terminal exclusively through the obfuscated portal gate path.
 */
export default function DisabledLegacyHqPage() {
  notFound();
}
