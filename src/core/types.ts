export type ApiRes<T = unknown> = {
  isSucceed: boolean;
  message?: string;
  data?: T;
};

export function ok<T>(data: T, message?: string): ApiRes<T> {
  return { isSucceed: true, message, data };
}

export function fail<T = unknown>(message: string, data?: T): ApiRes<T> {
  return { isSucceed: false, message, data };
}

export function ensureOk<T>(res: ApiRes<T>, fallback: string): ApiRes<T> {
  if (!res || res.isSucceed === false) {
    throw new Error(res?.message ?? fallback);
  }
  return res;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessExp: number;  // ms
  refreshExp: number; // ms
  trust: boolean;
};

export type DeviceId = string;

export type Account = {
  username: string; // email
  password: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string; // YYYY-MM-DD
  trustRequired: boolean;
  trustedDevices: Set<DeviceId>;
  revoked: boolean; // simulate "login device khác" => refresh fail
};
