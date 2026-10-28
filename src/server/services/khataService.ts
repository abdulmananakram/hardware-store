import { db } from "@/lib/db";
import { computeBalance } from "@/lib/business";
import type { PartyType, KhataTxnType } from "@/lib/types";
import type { DbClient } from "./shared";

export const listKhata = (partyType?: PartyType, partyId?: number) =>
  db.khataTransaction.findMany({
    where: {
      ...(partyType ? { partyType } : {}),
      ...(partyId !== undefined ? { partyId } : {}),
    },
    orderBy: { transactionDate: "desc" },
  });

export const getBalance = async (
  partyType: PartyType,
  partyId: number,
  tx: DbClient | typeof db = db
) => {
  const transactions = await tx.khataTransaction.findMany({
    where: { partyType, partyId },
  });
  return computeBalance(
    transactions.map((transaction) => ({
      ...transaction,
      transactionDate: transaction.transactionDate.toISOString(),
      createdAt: transaction.createdAt.toISOString(),
      partyType: transaction.partyType as PartyType,
      transactionType: transaction.transactionType as KhataTxnType,
      relatedSaleBillId: transaction.relatedSaleBillId ?? undefined,
      relatedPurchaseBillId: transaction.relatedPurchaseBillId ?? undefined,
      relatedReturnId: transaction.relatedReturnId ?? undefined,
      note: transaction.note ?? undefined,
    })),
    partyType,
    partyId
  );
};

export const recordTransaction = (
  tx: DbClient,
  input: {
    partyType: PartyType;
    partyId: number;
    transactionType: KhataTxnType;
    amount: number;
    relatedSaleBillId?: number;
    relatedPurchaseBillId?: number;
    relatedReturnId?: number;
    note?: string;
  }
) => tx.khataTransaction.create({ data: input });
