import { describe, it, expect } from "vitest";
import { validateLogin, validateSignup, firstInvalidField } from "../../app/features/auth/formValidation.js";

const persian = /[؀-ۿ]/;

describe("auth form validation", () => {
  it("accepts a valid login and Persian digits in the phone", () => {
    expect(validateLogin({ phone: "۰۹۱۲۳۴۵۶۷۸۹", password: "x" })).toEqual({});
  });

  it("reports every login problem in Persian", () => {
    const errors = validateLogin({ phone: "123", password: "" });
    expect(Object.keys(errors).sort()).toEqual(["password", "phone"]);
    for (const message of Object.values(errors)) expect(message).toMatch(persian);
  });

  it("requires the specialty for salons and artists, not clients", () => {
    const base = { name: "n", area: "a", phone: "09123456789", password: "12345678", agreeTerms: "on" };
    expect(validateSignup("client", base)).toEqual({});
    expect(validateSignup("salon", base).service).toMatch(persian);
    expect(validateSignup("artist", { ...base, service: "ناخن" })).toEqual({});
  });

  it("checks password length, optional email and the terms checkbox", () => {
    const errors = validateSignup("client", { name: "n", area: "a", phone: "09123456789", password: "123", email: "bad" });
    expect(errors.password).toMatch(persian);
    expect(errors.email).toMatch(persian);
    expect(errors.agreeTerms).toMatch(persian);
  });

  it("focuses the first invalid field in form order", () => {
    expect(firstInvalidField({ password: "x", name: "y" })).toBe("name");
  });
});
