import { providerHealth } from "@/server/providers/engine";
import { json } from "@/server/providers/http";
export async function GET() {
  return json(
    (await providerHealth()).map(
      ({ provider, status, latency, capabilities, lastTest }) => ({
        provider,
        status,
        latency,
        capabilities,
        lastTest,
      }),
    ),
  );
}
