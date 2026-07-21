import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalBoolean, optionalString, requireObject, requireString } from "../../shared/validation/validators.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
import { createAddress, deleteAddress, listMyAddresses, setDefaultAddress, updateAddress, type AddressInput } from "./addresses.service.js";

function readAddressBody(body: Record<string, any>, partial: boolean): Partial<AddressInput> {
  const read = (key: string, max: number) => {
    if (!partial) return requireString(body, key, { trim: true, min: 1, max });
    const v = optionalString(body, key, { trim: true, max });
    return v === "" ? undefined : v;
  };

  const input: Partial<AddressInput> = {
    name: read("name", 120),
    line1: read("line1", 200),
    city: read("city", 100),
    state: read("state", 100),
    pincode: read("pincode", 20),
    country: optionalString(body, "country", { trim: true, max: 60 }),
    isDefault: optionalBoolean(body, "isDefault")
  };

  // Nullable optionals: explicit null clears the field.
  if (body.line2 === null) input.line2 = null;
  else input.line2 = optionalString(body, "line2", { trim: true, max: 200 });

  // Email and primary phone are required on create; on a partial edit they're
  // only validated if the caller actually sent a value (omitting a field
  // leaves the saved one untouched — same pattern as name/line1/etc.).
  if (partial && body.email === undefined) {
    input.email = undefined;
  } else {
    const email = requireString(body, "email", { trim: true, min: 3, max: 320 }, "Invalid email").toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "Invalid email");
    input.email = email;
  }

  if (partial && body.phone === undefined) {
    input.phone = undefined;
  } else {
    const phone = requireString(body, "phone", { trim: true, min: 7, max: 20 }, "Phone number is required");
    if (!PHONE_RE.test(phone)) throw new HttpError(400, "Invalid phone");
    input.phone = phone;
  }

  if (body.secondaryPhone === null) input.secondaryPhone = null;
  else {
    const secondaryPhone = optionalString(body, "secondaryPhone", { trim: true, max: 20 });
    if (secondaryPhone && !PHONE_RE.test(secondaryPhone)) throw new HttpError(400, "Invalid secondary phone");
    input.secondaryPhone = secondaryPhone;
  }

  if (!partial) {
    const required = input as AddressInput;
    if (!required.name || !required.line1 || !required.city || !required.state || !required.pincode) {
      throw new HttpError(400, "Missing required address fields");
    }
  }
  return input;
}

export async function getAddresses(req: AuthedRequest, res: Response) {
  return jsonOk(res, await listMyAddresses(req.userId!));
}

export async function postAddress(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const input = readAddressBody(body, false) as AddressInput;
  return jsonOk(res, await createAddress(req.userId!, input), 201);
}

export async function patchAddress(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const input = readAddressBody(body, true);
  return jsonOk(res, await updateAddress(req.userId!, req.params.id, input));
}

export async function postSetDefaultAddress(req: AuthedRequest, res: Response) {
  return jsonOk(res, await setDefaultAddress(req.userId!, req.params.id));
}

export async function removeAddress(req: AuthedRequest, res: Response) {
  return jsonOk(res, await deleteAddress(req.userId!, req.params.id));
}
