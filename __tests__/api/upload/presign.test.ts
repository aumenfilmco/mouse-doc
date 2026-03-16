import { POST } from "@/app/api/upload/presign/route";

// Mock the AWS SDK — factory functions run before variable initialization,
// so we use jest.fn() inline here and access mocks via require() in tests.
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue(
    "https://fake-presigned-url.example.com/test"
  ),
}));

// Mock environment variables
const ENV_VARS = {
  CLOUDFLARE_ACCOUNT_ID: "test-account-id",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET_NAME: "test-bucket",
};

beforeAll(() => {
  Object.entries(ENV_VARS).forEach(([key, value]) => {
    process.env[key] = value;
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  // Re-establish default mock return value after clearAllMocks
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  (getSignedUrl as jest.Mock).mockResolvedValue(
    "https://fake-presigned-url.example.com/test"
  );
});

describe("/api/upload/presign", () => {
  // Test 1: Response shape
  it("returns 200 with uploadUrl and fileKey strings", async () => {
    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({ filename: "test.mp4", contentType: "video/mp4" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.uploadUrl).toBe("string");
    expect(typeof body.fileKey).toBe("string");
  });

  // Test 2: fileKey format
  it("returns fileKey matching submissions/YYYY-MM/{nanoid}-{safeName}", async () => {
    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({ filename: "test.mp4", contentType: "video/mp4" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    // Pattern: submissions/YYYY-MM/{nanoid 21 chars}-{sanitized name}
    expect(body.fileKey).toMatch(
      /^submissions\/\d{4}-\d{2}\/[A-Za-z0-9_-]{21}-[a-zA-Z0-9._-]+$/
    );
  });

  // Test 3: Filename sanitization
  it("sanitizes spaces and special chars in filename to underscores", async () => {
    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({
        filename: "my video (1).mov",
        contentType: "video/quicktime",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    // The name portion after the 21-char nanoid prefix and hyphen separator
    // fileKey format: submissions/YYYY-MM/{21-char-nanoid}-{safeName}
    const thirdSegment = body.fileKey.split("/")[2]; // "{nanoid}-{safeName}"
    const namePart = thirdSegment.slice(22); // skip 21-char nanoid + 1 hyphen
    expect(namePart).toBe("my_video__1_.mov");
  });

  // Test 4: SDK call — correct PutObjectCommand args
  it("calls getSignedUrl with PutObjectCommand containing Bucket, Key, and ContentType", async () => {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({ filename: "test.mp4", contentType: "video/mp4" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "test-bucket",
        ContentType: "video/mp4",
      })
    );
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.stringMatching(/^submissions\/\d{4}-\d{2}\//),
      })
    );
    expect(getSignedUrl).toHaveBeenCalled();
  });

  // Test 5: Expiry
  it("calls getSignedUrl with expiresIn: 900", async () => {
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({ filename: "test.mp4", contentType: "video/mp4" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: 900 })
    );
  });

  // Test 6: Missing body returns 400
  it("returns 400 when filename is missing", async () => {
    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({ contentType: "video/mp4" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when contentType is missing", async () => {
    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({ filename: "test.mp4" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const request = new Request("http://localhost/api/upload/presign", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  // Test 7: Credential isolation — lib/storage/r2.ts must not contain NEXT_PUBLIC_
  it("lib/storage/r2.ts does not contain NEXT_PUBLIC_ references", () => {
    const fs = require("fs");
    const path = require("path");
    const r2Path = path.resolve(__dirname, "../../../lib/storage/r2.ts");
    const source = fs.readFileSync(r2Path, "utf-8");
    expect(source).not.toContain("NEXT_PUBLIC_");
  });
});
