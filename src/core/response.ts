// src/core/response.ts
import type { Response } from "express";

export type ApiRes<T = unknown> =
  | { isSucceed: true; message?: string; data: T }
  | { isSucceed: false; message: string; data?: never };

export function ok<T>(data: T, message?: string): ApiRes<T> {
  return { isSucceed: true, message, data };
}

export function fail(message: string): ApiRes<never> {
  return { isSucceed: false, message };
}

/**
 * call API -> validate -> pass mới xử lý
 * resApi: trả về ApiRes, nếu fail thì throw để catch
 */
export function ensureOk<T>(resApi: ApiRes<T>, fallbackMsg = "Request failed"): ApiRes<T> {
  if (!resApi || resApi.isSucceed === false) {
    throw new Error(resApi?.message ?? fallbackMsg);
  }
  return resApi;
}

/**
 * helper cho routes: luôn trả chuẩn format
 */
export function sendRes<T>(res: Response, apiRes: ApiRes<T>, httpFailCode = 400) {
  if (apiRes.isSucceed) return res.status(200).json(apiRes);
  return res.status(httpFailCode).json(apiRes);
}
