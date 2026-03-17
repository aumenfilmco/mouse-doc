import { validateSubmission } from "@/app/utils/validateSubmission";

describe("validateSubmission", () => {
  // Test 1: empty name returns name error
  it("returns error for empty name", () => {
    const result = validateSubmission({
      name: "",
      relation: "friend",
      hasFile: true,
      textStory: "",
      email: "",
      phone: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe("Your name is required.");
  });

  // Test 2: empty relation returns relation error
  it("returns error for empty relation", () => {
    const result = validateSubmission({
      name: "Jane",
      relation: "",
      hasFile: true,
      textStory: "",
      email: "",
      phone: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.relation).toBe(
      "Your connection to Coach McCollum is required."
    );
  });

  // Test 3: no file and no textStory returns form06 error
  it("returns FORM-06 error when no files and no textStory", () => {
    const result = validateSubmission({
      name: "Jane",
      relation: "friend",
      hasFile: false,
      textStory: "",
      email: "",
      phone: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.form06).toBe(
      "Please add a file or type your story — we need at least one."
    );
  });

  // Test 4: email present but missing @ returns email error
  it("returns email format error when email present but missing @", () => {
    const result = validateSubmission({
      name: "Jane",
      relation: "friend",
      hasFile: true,
      textStory: "",
      email: "bad",
      phone: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBe("Please enter a valid email address.");
  });

  // Test 5: valid file-upload submission (no email)
  it("returns no errors for valid file-upload submission", () => {
    const result = validateSubmission({
      name: "Jane",
      relation: "friend",
      hasFile: true,
      textStory: "",
      email: "",
      phone: "",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  // Test 6: valid text-only submission
  it("returns no errors for valid text-only submission", () => {
    const result = validateSubmission({
      name: "Jane",
      relation: "friend",
      hasFile: false,
      textStory: "My story",
      email: "",
      phone: "",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  // Test 7: valid full submission with email and phone
  it("returns no errors for valid submission with email and phone", () => {
    const result = validateSubmission({
      name: "Jane",
      relation: "friend",
      hasFile: true,
      textStory: "",
      email: "jane@example.com",
      phone: "555-1234",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
