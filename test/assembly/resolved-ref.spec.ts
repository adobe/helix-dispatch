import { ResolvedRef } from "../../fastly/assembly/resolved-ref";
const example = new ResolvedRef(`{
  "fqRef": "refs/heads/main",
  "sha": "003d914ae1c4a2e3db527d89432ec6d9fbd6fc08c383"
}`);

describe("resolved-ref", () => {
  it("fqRef", () => {  
    expect<string>(example.fqRef).toBe("refs/heads/main");
  });

  it("ref", () => {  
    expect<string>(example.ref).toBe("main");
  });

  it("sha", () => {  
    expect<string>(example.sha).toBe("003d914ae1c4a2e3db527d89432ec6d9fbd6fc08c383");
  });
});