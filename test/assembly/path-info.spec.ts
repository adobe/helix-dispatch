import { PathInfo } from "../../fastly/assembly/path-info";

describe("PathInfo", () => {
  it("constructor", () => {
    const example = new PathInfo("/hello.test.html", "hello", "test", "html", "/");
    expect<string>(example.name).toBe("hello");
    expect<string>(example.extension).toBe("html");
    expect<string>(example.selector).toBe("test");
  });

  it("/dir/example.html", () => {
    const pathinfos = PathInfo.buildPathInfos("/dir/example.html", "", ["index.html"]);
    expect(pathinfos.length).toBe(1);

    expect<string>(pathinfos[0].name).toBe("example");
    expect<string>(pathinfos[0].selector).toBe("");
    expect<string>(pathinfos[0].extension).toBe("html");
  });

  it("/dir/example.test.html", () => {
    const pathinfos = PathInfo.buildPathInfos("/dir/example.test.html", "", ["index.html"]);
    expect(pathinfos.length).toBe(1);

    expect<string>(pathinfos[0].name).toBe("example");
    expect<string>(pathinfos[0].selector).toBe("test");
    expect<string>(pathinfos[0].extension).toBe("html");
  });

  it("/dir/example", () => {
    const pathinfos = PathInfo.buildPathInfos("/dir/example", "", ["index.html"]);
    expect(pathinfos.length).toBe(1);

    expect<string>(pathinfos[0].name).toBe("example");
    expect<string>(pathinfos[0].selector).toBe("");
    expect<string>(pathinfos[0].extension).toBe("html");
  });

  it("/dir/example/", () => {
    const pathinfos = PathInfo.buildPathInfos("/dir/example/", "", ["index.html"]);
    expect(pathinfos.length).toBe(1);

    expect<string>(pathinfos[0].name).toBe("index");
    expect<string>(pathinfos[0].selector).toBe("");
    expect<string>(pathinfos[0].extension).toBe("html");
  });


  it("/dir/example/ (multi-index)", () => {
    const pathinfos = PathInfo.buildPathInfos("/dir/example/", "", ["index.html", "README.html"]);
    expect(pathinfos.length).toBe(2);

    expect<string>(pathinfos[0].name).toBe("index");
    expect<string>(pathinfos[0].selector).toBe("");
    expect<string>(pathinfos[0].extension).toBe("html");

    expect<string>(pathinfos[1].name).toBe("README");
    expect<string>(pathinfos[1].selector).toBe("");
    expect<string>(pathinfos[1].extension).toBe("html");
  });

  it("/foo/hello.test.info.html (mount /foo)", () => {
    const pathinfos = PathInfo.buildPathInfos("/foo/hello.test.info.html", "/foo", ["index.html"]);
    expect(pathinfos.length).toBe(1);

    
    expect<string>(pathinfos[0].name).toBe("hello.test");
    expect<string>(pathinfos[0].selector).toBe("info");
    expect<string>(pathinfos[0].extension).toBe("html");
    expect<string>(pathinfos[0].path).toBe("/hello.test.info.html");
    expect<string>(pathinfos[0].relativePath).toBe("/hello.test");
  });

});