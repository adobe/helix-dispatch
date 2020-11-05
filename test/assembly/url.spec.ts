import { URL } from "../../fastly/assembly/url";

const example1 = new URL('https://example.com/test.php?foo=bar&bar=nothing%20here');
const example2 = new URL('https://example.com/test.php');
const example3 = new URL('https://example.com');

describe("url", () => {
  it("querystring", () => {
    expect<string>(example1.querystring).toBe("foo=bar&bar=nothing%20here");
    expect<string>(example2.querystring).toBe("");
  });

  it("queryparam", () => {
    expect<string>(example1.queryparam("foo", "")).toBe("bar");
    expect<string>(example1.queryparam("bar", "")).toBe("nothing here");

    expect<string>(example2.queryparam("foo", "none")).toBe("none");
  });

  it("toString", () => {
    expect<string>(example1.toString()).toBe("https://example.com/test.php?foo=bar&bar=nothing%20here");
    expect<string>(example2.toString()).toBe("https://example.com/test.php");
    expect<string>(example3.toString()).toBe("https://example.com/");
  });

  it("append", () => {
    expect<string>(new URL("https://example.com").append("test.php").toString()).toBe("https://example.com/test.php");
    expect<string>(new URL("https://example.com/").append("/test.php").toString()).toBe("https://example.com/test.php");
    expect<string>(new URL("https://example.com/").append("/test/php").toString()).toBe("https://example.com/test/php");
    expect<string>(new URL("https://example.com/").append("/test/").append("/php").toString()).toBe("https://example.com/test/php");
  });

  it("encode", () => {
    expect<string>(URL.encode("Hello & Good-Bye.")).toBe("Hello%20%26%20Good-Bye.");
  });

  it("appendParam", () => {
    expect<string>(example1.appendParam("greeting", "Hello & Good-Bye.").toString()).toBe("https://example.com/test.php?foo=bar&bar=nothing%20here&greeting=Hello%20%26%20Good-Bye.");
    expect<string>(example1.appendParam("foo", "baz").toString()).toBe("https://example.com/test.php?foo=bar&bar=nothing%20here&greeting=Hello%20%26%20Good-Bye.");
  });

  it("appendParams", () => {
    let params = new Map<string, string>();
    params.set("foo", "bar");
    params.set("bar", "nothing here");
    params.set("greeting", "Hello & Good-Bye.");
    expect<string>(example2.appendParams(params).toString()).toBe("https://example.com/test.php?foo=bar&bar=nothing%20here&greeting=Hello%20%26%20Good-Bye.");
  });
});