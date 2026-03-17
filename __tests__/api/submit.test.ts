import { POST } from "@/app/api/submit/metadata/route";

// Mock global fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AIRTABLE_PAT = "pat_test";
  process.env.AIRTABLE_BASE_ID = "appTEST";
  process.env.AIRTABLE_TABLE_ID = "tblTEST";
  // Default: Airtable returns 200
  mockFetch.mockResolvedValue({ ok: true });
});

describe("/api/submit/metadata", () => {
  // Test 1: valid body — calls Airtable with correct URL and headers
  it("returns 200 and posts to Airtable on valid input", async () => {
    const request = new Request("http://localhost/api/submit/metadata", {
      method: "POST",
      body: JSON.stringify({
        name: "Jane",
        relation: "friend",
        email: "",
        phone: "",
        textStory: "",
        fileKey: "submissions/2026-03/abc-story.mp4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);

    // Verify fetch was called with correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/appTEST/tblTEST",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer pat_test",
          "Content-Type": "application/json",
        }),
      })
    );

    // Verify the request body fields
    const callArgs = mockFetch.mock.calls[0];
    const fetchOptions = callArgs[1];
    const parsedBody = JSON.parse(fetchOptions.body);
    const fields = parsedBody.records[0].fields;

    expect(fields).toHaveProperty("Name", "Jane");
    expect(fields).toHaveProperty("Connection", "friend");
    expect(fields).toHaveProperty("Email", "");
    expect(fields).toHaveProperty("Phone", "");
    expect(fields).toHaveProperty("StoryText", "");
    expect(fields).toHaveProperty(
      "FileKey",
      "submissions/2026-03/abc-story.mp4"
    );
    expect(fields).toHaveProperty("SubmittedAt");
    // SubmittedAt is a valid ISO date string
    expect(new Date(fields.SubmittedAt).toISOString()).toBe(fields.SubmittedAt);
  });

  // Test 2: missing name returns 400
  it("returns 400 when name is missing", async () => {
    const request = new Request("http://localhost/api/submit/metadata", {
      method: "POST",
      body: JSON.stringify({
        name: "",
        relation: "friend",
        email: "",
        phone: "",
        textStory: "",
        fileKey: "submissions/2026-03/abc-story.mp4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Your name is required.");
  });

  // Test 3: missing relation returns 400
  it("returns 400 when relation is missing", async () => {
    const request = new Request("http://localhost/api/submit/metadata", {
      method: "POST",
      body: JSON.stringify({
        name: "Jane",
        relation: "",
        email: "",
        phone: "",
        textStory: "",
        fileKey: "submissions/2026-03/abc-story.mp4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Your connection to Coach McCollum is required.");
  });

  // Test 4: no fileKey and no textStory returns 400
  it("returns 400 when no fileKey and no textStory", async () => {
    const request = new Request("http://localhost/api/submit/metadata", {
      method: "POST",
      body: JSON.stringify({
        name: "Jane",
        relation: "friend",
        email: "",
        phone: "",
        textStory: "",
        fileKey: "",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe(
      "Please add a file or type your story — we need at least one."
    );
  });

  // Test 5: Airtable returns non-2xx → route returns 502
  it("returns 502 when Airtable responds with non-2xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422 });

    const request = new Request("http://localhost/api/submit/metadata", {
      method: "POST",
      body: JSON.stringify({
        name: "Jane",
        relation: "friend",
        email: "",
        phone: "",
        textStory: "",
        fileKey: "submissions/2026-03/abc-story.mp4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body.error).toBe("Airtable write failed");
  });

  // Test 6: invalid JSON body returns 400
  it("returns 400 when body is invalid JSON", async () => {
    const request = new Request("http://localhost/api/submit/metadata", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid JSON body");
  });
});
