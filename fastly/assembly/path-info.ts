export class PathInfo {
  public path: string;
  public name: string;
  public selector: string;
  public extension: string;
  public relativePath: string;

  constructor(path: string, name: string, selector: string, extension: string, relativePath: string) {
    this.path = path;
    this.name = name;
    this.selector = selector;
    this.extension = extension;
    this.relativePath = relativePath;
  }

  static cleanup(path: string):string {
    if (path.includes("//")) {
      return PathInfo.cleanup(path.replace("//", "/"));
    }
    return path;
  }

  static buildPathInfos(path: string, mount: string, indices: string[]): PathInfo[] {
    
    let pathinfos = new Array<PathInfo>();
    let urls = new Set<string>();
    let urlPath = PathInfo.cleanup(path);
    
    log("building path infos: " + urlPath);

    if (urlPath.lastIndexOf('.') <= urlPath.lastIndexOf('/')) {
      // ends with '/', get the directory index
      if (urlPath == "" || urlPath.endsWith('/')) {
        for (let i = 0; i < indices.length; i++) {
          urls.add(PathInfo.cleanup(urlPath + "/" + indices[i]));
        }
      } else {
        // allow extension-less requests, i.e. /foo becomes /foo.html
        urls.add(urlPath + ".html");
      }
    } else {
      urls.add(urlPath);
    }

    const uniqueURLs = urls.values();
    for (let i = 0; i < uniqueURLs.length; i++) {
      const url = uniqueURLs[i];
      log("unique URL: " + url);
      const lastSlash = url.lastIndexOf('/');
      const lastDot = url.lastIndexOf('.');

      if (lastDot > lastSlash) {

        const ext = url.substring(lastDot + 1);
        let name = url.substring(lastSlash + 1, lastDot);
        let relPath = url.substring(0, lastDot);

        // check for selector
        let selector = '';
        const selDot = relPath.lastIndexOf('.');
        if (selDot > lastSlash) {
          name = url.substring(lastSlash + 1, selDot);
          selector = relPath.substring(selDot + 1);
          relPath = relPath.substring(0, selDot);
        }

        // remove mount root if needed
        let pth = url;
        if (mount && mount !== '/') {
          // strain selection should only select strains that match the url. but better check again
          if (PathInfo.cleanup(relPath + "/").startsWith(PathInfo.cleanup(mount + "/"))) {
            relPath = relPath.substring(mount.length);
            pth = url.substring(mount.length);
          }
        }
        pathinfos.push(new PathInfo(pth, name, selector, ext, relPath));
      }
    }

    return pathinfos;
  }
}