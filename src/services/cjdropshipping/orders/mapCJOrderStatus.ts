import type {
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from "@/suppliers/types";

export function mapCJOrderStatus(
  remoteStatus?: string,
  remotePaymentStatus?: string
): {
  status: SupplierOrderStatus;
  paymentStatus: SupplierPaymentStatus;
} {
  const status = (remoteStatus || "").trim().toLowerCase();
  const payment = (remotePaymentStatus || "").trim().toLowerCase();

  let mappedStatus: SupplierOrderStatus = "UNKNOWN";

  if (status.includes("cancel")) {
    mappedStatus = "CANCELLED";
  } else if (status.includes("deliver")) {
    mappedStatus = "DELIVERED";
  } else if (status.includes("ship") || status.includes("dispatch")) {
    mappedStatus = "SHIPPED";
  } else if (status.includes("process") || status.includes("fulfil")) {
    mappedStatus = "PROCESSING";
  } else if (status.includes("paid")) {
    mappedStatus = "PAID";
  } else if (status.includes("unpaid") || status.includes("payment")) {
    mappedStatus = "AWAITING_PAYMENT";
  } else if (status.includes("created") || status.includes("pending")) {
    mappedStatus = "CREATED";
  } else if (status.includes("fail") || status.includes("error")) {
    mappedStatus = "FAILED";
  }

  let paymentStatus: SupplierPaymentStatus = "UNKNOWN";

  if (payment.includes("paid") && !payment.includes("unpaid")) {
    paymentStatus = "PAID";
  } else if (payment.includes("unpaid") || payment.includes("not paid")) {
    paymentStatus = "UNPAID";
  } else if (payment.includes("pending")) {
    paymentStatus = "PAYMENT_PENDING";
  } else if (payment.includes("fail")) {
    paymentStatus = "PAYMENT_FAILED";
  }

  if (mappedStatus === "AWAITING_PAYMENT" && paymentStatus === "UNKNOWN") {
    paymentStatus = "UNPAID";
  }

  if (
    ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(mappedStatus) &&
    paymentStatus === "UNKNOWN"
  ) {
    paymentStatus = "PAID";
  }

  return {
    status: mappedStatus,
    paymentStatus,
  };
}
