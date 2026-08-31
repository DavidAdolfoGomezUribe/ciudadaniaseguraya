import { ObjectId } from "mongodb";
import { z } from "zod";

export const objectIdStringSchema = z
  .string()
  .refine((value) => ObjectId.isValid(value), "ObjectId invalido");

export function toObjectId(value) {
  return value instanceof ObjectId ? value : new ObjectId(value);
}
