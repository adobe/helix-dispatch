import { Fastly } from "@fastly/as-compute";

export interface Pool {
  get(url: string | i32): Fastly.FufilledRequest | null;

  size: i32;
}