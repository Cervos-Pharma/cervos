# Textify Africa Integration (`@cervos/textify`)

**Provider:** Textify Africa (`https://portal.textify.africa/api/v1`)  
**Package:** `packages/textify/src/index.ts` (`@cervos/textify`)

## Security & Architecture Rules

1. **Server-only credential boundary:** `TEXTIFY_API_KEY` lives exclusively in server environment variables (Next.js Server Actions / Route Handlers / background workers). Client web bundles, Electron/Tauri POS apps, and supplier desktop apps never hold or call Textify directly.
2. **Database gatekeeping:** Before sending any patient SMS (`buildPrescriptionClaimSms`), check `sms_opt_outs` and log only `maskMsisdn(phone)` + a hashed MSISDN + segment count (never raw clinical notes or diagnoses in SMS).
3. **Safe retries (`Idempotency-Key`):** Every operational send attaches a deterministic `Idempotency-Key` (`cervos-rx-<id>`, `cervos-recall-<id>`, `cervos-dispatch-<id>`), remembered by Textify for 48 hours so poor-network retries never double-bill.

## Endpoints Used

| Endpoint | Purpose in Cervos OS |
| --- | --- |
| `POST /messages` | Patient e-Rx `claim_token` alerts (EN/SW), TMDA batch recall quarantine alerts, B2B supplier dispatch notices (SMS or `channel: "whatsapp"`). |
| `GET /messages/{id}` | Poll / reconcile delivery status (`sending`, `processing`, `sent`, `delivered`, `failed`, `undelivered`, `expired`). |
| `POST /otps` | Single-use 30-minute phone verification codes for onboarding / high-risk approvals (`channel: "sms"`). |
| `POST /otps/verify` | Server-side verification forwarding JSON numeric `code` + normalized `255...` MSISDN. |

## Cost & Formatting Contracts

- **MSISDN normalization:** Converts `0712345678`, `+255712345678`, and 9-digit local numbers into canonical `255712345678`.
- **Segment estimation (`smsSegments`):**
  - ASCII messages: `<= 160` chars = `1` unit; longer = `ceil(len / 153)`.
  - Non-ASCII / UCS-2 messages: `<= 70` chars = `1` unit; longer = `1 + ceil((len - 70) / 63)`.

