import { mysqlPool } from "../config/database";
import { type ApiRes, ok, fail } from "../core/response";
import { isAccessExpired, usernameFromToken } from "../core/token";
import logger from "../config/logger";
import httpAdapter from "./httpAdapter";
import { isClientMode } from "../config/mode";

export async function me(accessToken: string): Promise<ApiRes<any>> {
  if (!accessToken) return fail("MISSING_ACCESS_TOKEN");

  if (isAccessExpired(accessToken)) {
    // TH3: access hết hạn -> client nên gọi refresh
    return fail("ACCESS_TOKEN_EXPIRED");
  }

  const username = usernameFromToken(accessToken);
  if (!username) return fail("INVALID_ACCESS_TOKEN");

  if (isClientMode()) {
    const res = await httpAdapter.get('/me', { authorization: `Bearer ${accessToken}` });
    return res.data;
  }

  let connection: any;

  try {
    connection = await mysqlPool.getConnection();
    
    const [users] = await connection.query(
      "SELECT phone, firstName, lastName FROM users WHERE phone = ?",
      [username]
    ) as any;

    if (!Array.isArray(users) || users.length === 0) {
      return fail("Tài khoản không tồn tại");
    }

    const user = users[0] as any;
    return ok({ phone: user.phone, firstName: user.firstName, lastName: user.lastName }, "OK");
  } catch (error: any) {
    logger.error("me service error:", { error: error.message, username });
    return fail("Lỗi lấy thông tin user: " + error.message);
  } finally {
    if (connection) connection.release();
  }
}
