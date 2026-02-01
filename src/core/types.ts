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
