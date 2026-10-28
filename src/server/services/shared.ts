import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/business";

export type DbClient = Prisma.TransactionClient;

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const paymentStatus = (total: number, paid: number) => {
  if (paid === 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
};

export const normalizePayment = (
  total: number,
  paymentType: string,
  amountPaid?: number
) => {
  const paid = round2(amountPaid ?? (paymentType === "cash" ? total : 0));
  if (!Number.isFinite(paid) || paid < 0 || paid > total) {
    throw new ServiceError("Amount paid must be between zero and the bill total");
  }
  return {
    amountPaid: paid,
    outstandingAmount: round2(total - paid),
    paymentStatus: paymentStatus(total, paid),
  };
};

export const assertPositive = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ServiceError(`${label} must be greater than zero`);
  }
};
