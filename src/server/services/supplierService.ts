import { db } from "@/lib/db";
import { ServiceError } from "./shared";
import { getBalance } from "./khataService";

export const listSuppliers = () => db.supplier.findMany({ orderBy: { name: "asc" } });

export const createSupplier = async (name: string, phone?: string) => {
  if (!name.trim()) throw new ServiceError("Supplier name is required");
  return db.supplier.create({ data: { name: name.trim(), phone: phone?.trim() || null } });
};

export const getSupplier = (id: number) => db.supplier.findUnique({ where: { id } });

export const refreshSupplierBalance = async (id: number) => {
  const balance = await getBalance("supplier", id);
  return db.supplier.update({ where: { id }, data: { payableBalance: balance } });
};

