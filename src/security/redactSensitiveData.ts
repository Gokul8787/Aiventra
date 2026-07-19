const REDACTED = "[REDACTED]";

const EXACT_SENSITIVE_KEYS = new Set([
  "access_token",
  "accesstoken",
  "address",
  "address1",
  "address2",
  "billing_address",
  "billingaddress",
  "customer",
  "default_address",
  "defaultaddress",
  "email",
  "first_name",
  "firstname",
  "last_name",
  "lastname",
  "phone",
  "refresh_token",
  "refreshtoken",
  "shipping_address",
  "shippingaddress",
]);

function normalizeKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key);
  return EXACT_SENSITIVE_KEYS.has(normalized);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => {
        if (isSensitiveKey(key)) {
          return [key, REDACTED];
        }

        return [key, redactValue(nestedValue)];
      }
    );

    return Object.fromEntries(entries);
  }

  return value;
}

export function redactSensitiveData<T>(value: T): T {
  return redactValue(value) as T;
}
