import { URL } from "../../fastly/assembly/url";

const example1 = new URL('https://example.com/test.php?foo=bar&bar=nothing%20here');
const example2 = new URL('https://example.com/test.php');

describe("url", () => {
  it("querystring", () => {
    expect<string>(example1.querystring()).toBe("foo=bar&bar=nothing%20here");
    expect<string>(example2.querystring()).toBe("");
  });

  it("queryparam", () => {
    expect<string>(example1.queryparam("foo", "")).toBe("bar");
    expect<string>(example1.queryparam("bar", "")).toBe("nothing here");

    expect<string>(example2.queryparam("foo", "none")).toBe("none");
  });
});