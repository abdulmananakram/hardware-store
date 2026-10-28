import { db } from "@/lib/db";
import { round2 } from "@/lib/business";
import { ServiceError } from "./shared";

export type ReceivePaymentInput = {
  partyType: "customer" | "supplier";
  partyId: number;
  amount: number;
  method?: string;
  note?: string;
  allocations?: { billId: number; amount: number }[];
};

export const receivePayment = async (input: ReceivePaymentInput) =>
  db.$transaction(async (tx) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ServiceError("Payment amount must be greater than zero");
    }
    const party = input.partyType === "customer"
      ? await tx.customer.findUnique({ where: { id: input.partyId } })
      : await tx.supplier.findUnique({ where: { id: input.partyId } });
    if (!party) throw new ServiceError("Party not found", 404);

    const bills = input.partyType === "customer"
      ? await tx.saleBill.findMany({ where: { customerId: input.partyId, cancelled: false }, orderBy: { billDate: "asc" } })
      : await tx.purchaseBill.findMany({ where: { supplierId: input.partyId, cancelled: false }, orderBy: { billDate: "asc" } });
    const outstanding = bills.reduce((sum, bill) => sum + bill.outstandingAmount, 0);
    if (round2(input.amount) > round2(outstanding)) {
      throw new ServiceError("Payment cannot exceed outstanding balance; advances are not allowed");
    }

    const payment = await tx.payment.create({
      data: {
        partyType: input.partyType,
        customerId: input.partyType === "customer" ? input.partyId : null,
        supplierId: input.partyType === "supplier" ? input.partyId : null,
        amount: round2(input.amount),
        method: input.method ?? "cash",
        note: input.note,
      },
    });
    let remaining = round2(input.amount);
    const selected = input.allocations?.length
      ? bills.filter((bill) => input.allocations!.some((a) => a.billId === bill.id))
      : bills;
    for (const bill of selected) {
      if (remaining <= 0) break;
      const requested = input.allocations?.find((a) => a.billId === bill.id)?.amount;
      const amount = round2(Math.min(remaining, requested ?? bill.outstandingAmount));
      if (amount <= 0 || amount > bill.outstandingAmount) {
        throw new ServiceError("Invalid payment allocation");
      }
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          amount,
          ...(input.partyType === "customer" ? { saleBillId: bill.id } : { purchaseBillId: bill.id }),
        },
      });
      if (input.partyType === "customer") {
        await tx.saleBill.update({
          where: { id: bill.id },
          data: { amountPaid: { increment: amount }, outstandingAmount: { decrement: amount }, paymentStatus: round2(bill.outstandingAmount - amount) === 0 ? "paid" : "partial" },
        });
      } else {
        await tx.purchaseBill.update({
          where: { id: bill.id },
          data: { amountPaid: { increment: amount }, outstandingAmount: { decrement: amount }, paymentStatus: round2(bill.outstandingAmount - amount) === 0 ? "paid" : "partial" },
        });
      }
      remaining = round2(remaining - amount);
    }
    if (remaining !== 0) throw new ServiceError("Payment could not be fully allocated");
    await tx.khataTransaction.create({
      data: {
        partyType: input.partyType,
        partyId: input.partyId,
        transactionType: input.partyType === "customer" ? "payment_received" : "payment_made",
        amount: round2(input.amount),
        note: input.note ?? "Payment received",
      },
    });
    return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { allocations: true } });
  });
