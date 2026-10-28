import { db } from "@/lib/db";
import { round2 } from "@/lib/business";
import { ServiceError } from "./shared";

export const listItems = () =>
  db.item.findMany({ include: { units: true }, orderBy: { name: "asc" } });

export const getItem = (id: number) =>
  db.item.findUnique({ where: { id }, include: { units: true } });

export const createItem = async (input: {
  name: string;
  urduName?: string;
  skuCode?: string;
  brand?: string;
  specification?: string;
  notes?: string;
  categoryId: number;
  baseUnitName: string;
  pricePerBaseUnit: number;
  costPerBaseUnit?: number;
  lowStockThreshold: number;
  saleMode?: "QTY" | "PACK" | "WEIGHT" | "AMOUNT_EST";
  fractionalPackAllowed?: boolean;
  icon?: string;
  initialQtyInBaseUnit?: number;
  photoUrl?: string;
  extraUnits?: { unitName: string; conversionToBase: number }[];
}) =>
  db.$transaction(async (tx) => {
    if (!input.name.trim() || !input.baseUnitName.trim()) {
      throw new ServiceError("Item name and base unit are required");
    }
    if (input.pricePerBaseUnit < 0 || input.lowStockThreshold < 0) {
      throw new ServiceError("Price and stock threshold cannot be negative");
    }
    const opening = round2(input.initialQtyInBaseUnit ?? 0);
    if (opening < 0) throw new ServiceError("Opening stock cannot be negative");
    const item = await tx.item.create({
      data: {
        name: input.name.trim(),
        urduName: input.urduName?.trim() || null,
        skuCode: input.skuCode?.trim() || null,
        brand: input.brand?.trim() || null,
        specification: input.specification?.trim() || null,
        notes: input.notes?.trim() || null,
        categoryId: input.categoryId,
        baseUnitName: input.baseUnitName.trim(),
        pricePerBaseUnit: input.pricePerBaseUnit,
        costPerBaseUnit: input.costPerBaseUnit,
        lowStockThreshold: input.lowStockThreshold,
        saleMode: input.saleMode ?? "QTY",
        fractionalPackAllowed: input.fractionalPackAllowed ?? false,
        icon: input.icon ?? "📦",
        initialQtyInBaseUnit: opening,
        qtyInBaseUnit: opening,
        photoUrl: input.photoUrl,
        units: {
          create: [
            { unitName: input.baseUnitName.trim(), conversionToBase: 1, isBaseUnit: true },
            ...(input.extraUnits ?? []).map((unit) => ({
              unitName: unit.unitName.trim(),
              conversionToBase: unit.conversionToBase,
              isBaseUnit: false,
            })),
          ],
        },
      },
      include: { units: true },
    });
    if (opening > 0) {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          itemId: item.id,
          type: "initial",
          deltaInBaseUnit: opening,
          newQtyInBaseUnit: opening,
          reason: "Opening stock at item creation",
        },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          type: "OPENING",
          deltaInBaseUnit: opening,
          newQtyInBaseUnit: opening,
          referenceType: "adjustment",
          referenceId: adjustment.id,
          reason: "Opening stock at item creation",
          costSnapshot: item.costPerBaseUnit,
        },
      });
    }
    return item;
  });

export const updateItem = (id: number, data: Record<string, unknown>) =>
  db.item.update({ where: { id }, data });

export const deactivateItem = (id: number) =>
  db.item.update({ where: { id }, data: { isActive: false } });
