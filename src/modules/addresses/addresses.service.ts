import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

export type AddressInput = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  email: string;
  phone: string;
  secondaryPhone?: string | null;
  isDefault?: boolean;
};

const MAX_ADDRESSES = 10;

export async function listMyAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });
}

export async function createAddress(userId: string, input: AddressInput) {
  const count = await prisma.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) throw new HttpError(400, `You can save up to ${MAX_ADDRESSES} addresses`);

  // First address always becomes the default.
  const isDefault = count === 0 ? true : Boolean(input.isDefault);

  return prisma.$transaction(async (tx) => {
    if (isDefault && count > 0) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        userId,
        name: input.name,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country ?? "IN",
        email: input.email,
        phone: input.phone,
        secondaryPhone: input.secondaryPhone ?? null,
        isDefault
      }
    });
  });
}

export async function updateAddress(userId: string, addressId: string, input: Partial<AddressInput>) {
  const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!existing) throw new HttpError(404, "Address not found");

  return prisma.$transaction(async (tx) => {
    if (input.isDefault === true && !existing.isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id: addressId },
      data: {
        name: input.name ?? undefined,
        line1: input.line1 ?? undefined,
        line2: input.line2 === undefined ? undefined : input.line2,
        city: input.city ?? undefined,
        state: input.state ?? undefined,
        pincode: input.pincode ?? undefined,
        country: input.country ?? undefined,
        email: input.email ?? undefined,
        phone: input.phone ?? undefined,
        secondaryPhone: input.secondaryPhone === undefined ? undefined : input.secondaryPhone,
        isDefault: input.isDefault === undefined ? undefined : input.isDefault
      }
    });
  });
}

export async function setDefaultAddress(userId: string, addressId: string) {
  const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!existing) throw new HttpError(404, "Address not found");

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } })
  ]);
  return prisma.address.findUnique({ where: { id: addressId } });
}

export async function deleteAddress(userId: string, addressId: string) {
  const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!existing) throw new HttpError(404, "Address not found");

  await prisma.address.delete({ where: { id: addressId } });

  // Keep exactly one default while any addresses remain.
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return { ok: true };
}
