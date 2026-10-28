import { db } from "@/lib/db";
import { ServiceError } from "./shared";
import { getBalance } from "./khataService";

export const listCustomers = () => db.customer.findMany({ orderBy: { name: "asc" } });

export const createCustomer = async (name: string, phone?: string) => {
  if (!name.trim()) throw new ServiceError("Customer name is required");
  return db.customer.create({ data: { name: name.trim(), phone: phone?.trim() || null } });
};

export const getCustomer = (id: number) => db.customer.findUnique({ where: { id } });

export const refreshCustomerBalance = async (id: number) => {
  const balance = await getBalance("customer", id);
  return db.customer.update({ where: { id }, data: { khataBalance: balance } });
};

