import { URLBuilder } from "../../fastly/assembly/url-builder";
import { PathInfo } from "../../fastly/assembly/path-info";

describe("url-builder", () => {
  it("ad/dir/example.html", () => {
    let contentOpts = new Map<string, string>();
    contentOpts.set("owner", "adobe");
    contentOpts.set("repo", "theblog");
    contentOpts.set("ref", "main");
    contentOpts.set("root", "/");
    

    let staticOpts = new Map<string, string>();
    staticOpts.set("owner", "adobe");
    staticOpts.set("repo", "helix-pages");
    staticOpts.set("ref", "master");
    staticOpts.set("root", "/htdocs");

    const builder = new URLBuilder(contentOpts, staticOpts, "", "824a534d61824e92")
      .withNamespace("helix-pages");
    const pathinfos = PathInfo.buildPathInfos("/dir/example.html", "", ["index.html"]);

    let urls: string[] = builder.build404URLs(pathinfos);

    expect<i32>(urls.length).toBe(2);
    expect<string>(urls[0]).toBe("https://adobeioruntime.net/api/v1/web/helix-pages/helix-services/static@v1?path=%2f404.html&esi=false&plain=true&owner=adobe&repo=theblog&ref=main&root=%2f");
    expect<string>(urls[1]).toBe("https://adobeioruntime.net/api/v1/web/helix-pages/helix-services/static@v1?path=%2f404.html&esi=false&plain=true&owner=adobe&repo=helix-pages&ref=master&root=%2fhtdocs");
  });

  it("buildFallbackURLs", () => {
    let contentOpts = new Map<string, string>();
    contentOpts.set("owner", "adobe");
    contentOpts.set("repo", "theblog");
    contentOpts.set("ref", "main");
    contentOpts.set("root", "/");
    

    let staticOpts = new Map<string, string>();
    staticOpts.set("owner", "adobe");
    staticOpts.set("repo", "helix-pages");
    staticOpts.set("ref", "master");
    staticOpts.set("root", "/htdocs");

    const builder = new URLBuilder(contentOpts, staticOpts, "", "824a534d61824e92")
      .withNamespace("helix-pages");
    const pathinfos = PathInfo.buildPathInfos("/dir/example.html", "", ["index.html"]);

    const urls: string[] = builder.buildFallbackURLs(pathinfos);

    expect<i32>(urls.length).toBe(1);
    expect<string>(urls[0]).toBe("https://adobeioruntime.net/api/v1/web/helix-pages/helix-services/static@v1?path=%2fdir%2fexample.html&esi=false&plain=true&owner=adobe&repo=helix-pages&ref=master&root=%2fhtdocs");
  });

  it("buildRawURLs", () => {
    let contentOpts = new Map<string, string>();
    contentOpts.set("owner", "adobe");
    contentOpts.set("repo", "theblog");
    contentOpts.set("ref", "main");
    contentOpts.set("root", "/");
    

    let staticOpts = new Map<string, string>();
    staticOpts.set("owner", "adobe");
    staticOpts.set("repo", "helix-pages");
    staticOpts.set("ref", "master");
    staticOpts.set("root", "/htdocs");

    const builder = new URLBuilder(contentOpts, staticOpts, "", "824a534d61824e92")
      .withNamespace("helix-pages");
    const pathinfos = PathInfo.buildPathInfos("/dir/example.html", "", ["index.html"]);

    const urls: string[] = builder.buildRawURLs(pathinfos);

    expect<i32>(urls.length).toBe(1);
    expect<string>(urls[0]).toBe("https://adobeioruntime.net/api/v1/web/helix-pages/helix-services/static@v1?path=%2fdir%2fexample.html&esi=false&plain=true&root=&owner=adobe&repo=theblog&ref=main&root=%2f");
  });

  it("buildActionURLs", () => {
    let contentOpts = new Map<string, string>();
    contentOpts.set("owner", "adobe");
    contentOpts.set("repo", "theblog");
    contentOpts.set("ref", "main");
    contentOpts.set("root", "/");
    

    let staticOpts = new Map<string, string>();
    staticOpts.set("owner", "adobe");
    staticOpts.set("repo", "helix-pages");
    staticOpts.set("ref", "master");
    staticOpts.set("root", "/htdocs");

    const builder = new URLBuilder(contentOpts, staticOpts, "", "824a534d61824e92")
      .withNamespace("helix-pages");
    const pathinfos = PathInfo.buildPathInfos("/dir/example.html", "", ["index.html"]);

    const urls: string[] = builder.buildActionURLs(pathinfos);

    expect<i32>(urls.length).toBe(1);
    expect<string>(urls[0]).toBe("https://adobeioruntime.net/api/v1/web/helix-pages/824a534d61824e92/html?path=%2fdir%2fexample.md&rootPath=&owner=adobe&repo=theblog&ref=main&root=%2f");
  });

  it("buildRedirectURLs", () => {
    let contentOpts = new Map<string, string>();
    contentOpts.set("owner", "adobe");
    contentOpts.set("repo", "theblog");
    contentOpts.set("ref", "main");
    contentOpts.set("root", "/");
    

    let staticOpts = new Map<string, string>();
    staticOpts.set("owner", "adobe");
    staticOpts.set("repo", "helix-pages");
    staticOpts.set("ref", "master");
    staticOpts.set("root", "/htdocs");

    const builder = new URLBuilder(contentOpts, staticOpts, "", "824a534d61824e92")
      .withNamespace("helix-pages");

    const urls: string[] = builder.buildRedirectURLs("/dir/example.html");

    expect<i32>(urls.length).toBe(1);
    expect<string>(urls[0]).toBe("https://adobeioruntime.net/api/v1/web/helix-pages/helix-services/redirect@v1?path=%2fdir%2fexample.html&owner=adobe&repo=theblog&ref=main&root=%2f");
  });

});