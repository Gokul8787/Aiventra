export type OrganisationRole =
  | "owner"
  | "admin"
  | "manager"
  | "analyst"
  | "operator"
  | "viewer";

export type StoreRole = "admin" | "manager" | "analyst" | "operator" | "viewer";

export type Permission =
  | "dashboard.read"
  | "products.read"
  | "orders.read"
  | "orders.fulfilment.approve"
  | "product_scan.run"
  | "listing.generate"
  | "shopify.publish_draft"
  | "rules.read"
  | "rules.manage"
  | "members.read"
  | "members.manage"
  | "audit.read"
  | "jobs.read"
  | "jobs.manage";
