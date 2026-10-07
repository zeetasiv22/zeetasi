import { createHash, timingSafeEqual } from "node:crypto";
export function validMidtransSignature(
  order: string,
  status: string,
  amount: string,
  signature: string,
  key: string,
) {
  const expected = createHash("sha512")
    .update(order + status + amount + key)
    .digest("hex");
  return (
    /^[a-f0-9]{128}$/i.test(signature) &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()))
  );
}
