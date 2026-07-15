import type { OrganisationRole, Permission } from "./types";

const ROLE_PERMISSIONS: Record<OrganisationRole, readonly Permission[]> = {
  owner: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "product_scan.run",
    "listing.generate",
    "shopify.publish_draft",
    "rules.read",
    "rules.manage",
    "members.read",
    "members.manage",
    "audit.read",
    "jobs.read",
    "jobs.manage",
  ],
  admin: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "product_scan.run",
    "listing.generate",
    "shopify.publish_draft",
    "rules.read",
    "rules.manage",
    "members.read",
    "members.manage",
    "audit.read",
    "jobs.read",
    "jobs.manage",
  ],
  manager: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "product_scan.run",
    "listing.generate",
    "shopify.publish_draft",
    "rules.read",
    "jobs.read",
  ],
  analyst: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "rules.read",
    "jobs.read",
  ],
  operator: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "product_scan.run",
    "listing.generate",
    "shopify.publish_draft",
    "jobs.read",
  ],
  viewer: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "rules.read",
    "jobs.read",
  ],
};

export function roleHasPermission(
  role: OrganisationRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
