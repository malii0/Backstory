export function isUserNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code =
    "code" in err && (err as { code?: unknown }).code
      ? String((err as { code?: unknown }).code).toLowerCase()
      : "";
  const msg =
    "message" in err && (err as { message?: unknown }).message
      ? String((err as { message?: unknown }).message).toLowerCase()
      : "";
  return (
    code === "user_not_found" ||
    msg.includes("user not found") ||
    msg.includes("no user found")
  );
}

const EXPIRED_OR_INVALID_LINK_CODES = new Set([
  "otp_expired",
  "session_expired",
  "session_not_found",
  "bad_jwt",
  "invalid_jwt",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "flow_state_not_found",
  "flow_state_expired",
  "bad_code_verifier",
  "pkce_code_verifier_not_found",
]);

const EXPIRED_OR_INVALID_LINK_NAMES = new Set([
  "authsessionmissingerror",
  "authinvalidjwterror",
  "authinvalidtokenresponseerror",
  "authpkcecodeverifiermissingerror",
  "authpkcegrantcodeexchangeerror",
]);

export function mapAuthErrorToTurkish(err: unknown): string {
  const status =
    err &&
    typeof err === "object" &&
    "status" in err &&
    (err as { status?: unknown }).status !== undefined
      ? Number((err as { status?: unknown }).status)
      : undefined;
  const code =
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code
      ? String((err as { code?: unknown }).code).toLowerCase()
      : "";
  const name =
    err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: unknown }).name
      ? String((err as { name?: unknown }).name).toLowerCase()
      : "";
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : err &&
          typeof err === "object" &&
          "message" in err &&
          (err as { message?: unknown }).message
        ? String((err as { message?: unknown }).message).toLowerCase()
        : "";

  if (
    code === "invalid_credentials" ||
    name === "authinvalidcredentialserror" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    msg.includes("email not confirmed") ||
    isUserNotFoundError(err)
  ) {
    return "Giriş başarısız. Bilgilerinizi kontrol edin.";
  }

  if (code === "same_password" || msg.includes("should be different")) {
    return "Yeni şifre mevcut şifrenizle aynı olamaz.";
  }

  if (
    code === "weak_password" ||
    name === "authweakpassworderror" ||
    msg.includes("password should")
  ) {
    return "Şifre yeterince güçlü değil. Daha uzun ve karmaşık bir şifre deneyin.";
  }

  if (
    EXPIRED_OR_INVALID_LINK_CODES.has(code) ||
    EXPIRED_OR_INVALID_LINK_NAMES.has(name) ||
    msg.includes("expired") ||
    msg.includes("auth session missing") ||
    msg.includes("invalid token") ||
    msg.includes("invalid jwt")
  ) {
    return "Bağlantının süresi dolmuş veya geçersiz. Lütfen yeni bir bağlantı isteyin.";
  }

  if (
    status === 429 ||
    code.includes("rate_limit") ||
    code.includes("over_request_rate_limit") ||
    code.includes("over_email_send_rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("for security purposes, you can only request this")
  ) {
    return "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.";
  }

  if (
    status === 0 ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed")
  ) {
    return "Bağlantı hatası oluştu. İnternet bağlantınızı kontrol edin.";
  }

  return "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
}
