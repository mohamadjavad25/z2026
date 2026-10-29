import { describe, it, expect } from "vitest";
import { signV4 } from "../../app/lib/s3.js";

describe("S3 request signing", () => {
  it("matches AWS's published Signature V4 example (GET Object with a Range header)", () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html, "Example: GET Object".
    const config = { accessKey: "AKIAIOSFODNN7EXAMPLE", secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" };
    const headers = signV4(config, "GET", new URL("https://examplebucket.s3.amazonaws.com/test.txt"), { Range: "bytes=0-9" }, Buffer.alloc(0), new Date("2013-05-24T00:00:00Z"));
    expect(headers.Authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, "
      + "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, "
      + "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
    );
  });
});
