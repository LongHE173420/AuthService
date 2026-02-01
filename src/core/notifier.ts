export function notifyOtp(username: string, otp: string, context: string) {
  console.log(`[OTP][${context}] user=${username} otp=${otp}`);
}
