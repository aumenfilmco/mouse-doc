export interface SubmissionInput {
  name: string;
  relation: string;
  email: string;
  phone: string;
  textStory: string;
  hasFile: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<"name" | "relation" | "email" | "form06", string>>;
}

export function validateSubmission(input: SubmissionInput): ValidationResult {
  const errors: Partial<Record<"name" | "relation" | "email" | "form06", string>> = {};

  if (input.name.trim() === "") {
    errors.name = "Your name is required.";
  }

  if (input.relation.trim() === "") {
    errors.relation = "Your connection to Coach McCollum is required.";
  }

  if (input.email !== "" && !input.email.includes("@")) {
    errors.email = "Please enter a valid email address.";
  }

  if (!input.hasFile && input.textStory.trim() === "") {
    errors.form06 = "Please add a file or type your story — we need at least one.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
