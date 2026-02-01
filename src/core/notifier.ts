import logger from "../config/logger";

export function notifyOtp(username: string, otp: string, context: string) {
  logger.info(`[OTP][${context}] Sent OTP to user`, { username, otp, context });
}
