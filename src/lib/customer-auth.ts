import "server-only"

// Ownership proof at signup. With this on, /register additionally demands an
// order code whose masked phone matches the phone being registered — the same
// gate /claim uses. With it off (the testing default) anyone who knows a phone
// number inherits the points already claimed against it, so it should be ON in
// production until Zalo OTP replaces it.
export const SIGNUP_REQUIRES_PROOF =
  process.env.CUSTOMER_SIGNUP_REQUIRE_PROOF === "true"
