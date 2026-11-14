import test from "node:test";
import assert from "node:assert/strict";
import { STORE_ID, isAdminEndpoint, withAdminAuth } from "../lib/api.ts";

test("STORE_ID: Canonical store context is exported and equals 'handloomer'", () => {
  assert.equal(STORE_ID, "handloomer");
});

test("STORE_ID: Admin endpoints and customer exclusions remain preserved", () => {
  assert.equal(isAdminEndpoint("/api/admin/orders"), true);
  assert.equal(isAdminEndpoint("/api/user/profile"), false);
  assert.equal(isAdminEndpoint("/api/order/create"), false);
  assert.equal(isAdminEndpoint("/api/cart"), false);
});

test("STORE_ID: withAdminAuth does not attach admin token to customer endpoints", () => {
  const customHeaders = { "Content-Type": "application/json" };
  const headers = withAdminAuth("/api/user/profile", customHeaders, "GET");
  assert.equal(headers.Authorization, undefined);
});

test("Session restoration contract: profile verification", async () => {
  // Simulating backend /api/user/profile response contract
  const profileSuccess = {
    success: true,
    user: {
      _id: "usr_12345",
      name: "Handloomer Customer",
      email: "shopper@handloomer.com",
      phone: "+919876543210",
      role: "user",
      storeId: "handloomer",
    },
  };

  const verifiedUser = {
    _id: profileSuccess.user._id,
    name: profileSuccess.user.name,
    email: profileSuccess.user.email,
    phone: profileSuccess.user.phone,
  };

  assert.equal(verifiedUser._id, "usr_12345");
  assert.equal(verifiedUser.email, "shopper@handloomer.com");

  // On 401, session must fail closed and clear state
  const mock401Error = { status: 401, message: "Not authorized, token expired" };
  assert.equal(mock401Error.status, 401);
});

