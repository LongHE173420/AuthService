import { db } from "../db/db";
import { ok, fail, type ApiRes } from "../core/types";
import { isAccessExpired, usernameFromToken } from "../core/token";

export function me(accessToken: string): ApiRes<any> {
  if (!accessToken) return fail("MISSING_ACCESS_TOKEN");

  if (isAccessExpired(accessToken)) {
    // TH3: access hết hạn -> client nên gọi refresh
    return fail("ACCESS_TOKEN_EXPIRED");
  }

  const username = usernameFromToken(accessToken);
  if (!username) return fail("INVALID_ACCESS_TOKEN");

  const acc = db.accounts.get(username);
  if (!acc) return fail("Tài khoản không tồn tại");

  return ok({ username: acc.username, firstName: acc.firstName, lastName: acc.lastName }, "OK");
}
