import { Injectable } from '@nestjs/common';
import { Endpoint } from "./interfaces/endpoint";
import jsdom = require("jsdom");
import https = require('https');

const {JSDOM} = jsdom;


@Injectable()
export class AppService {

  dom: any;
  private site: string;
  private prefix: string;

  async parseSite(site: string): Promise<Endpoint[]> {
    this.site = site;
    const endpoints: Endpoint[] = [];

    // find inside main
    const main = await this.getScript(/main.*\.js/);
    if (main.startsWith('http')) {
      this.prefix = main.split('/main')[0];
    }
    const mainUrl = this.getFullUrl(main);
    const mainCode = await this.getData(mainUrl);
    const allEndpoints = mainCode.matchAll(/this\.http(Client)?\.(.+?)\((.*?)\)[;.}]/g);
    for (const endpoint of allEndpoints) {
      endpoints.push({method: endpoint[2], parameters: endpoint[3]});
    }

    // get lazy loaded modules
    const runtime = await this.getScript(/runtime.*\.js/);
    const runtimeUrl = this.getFullUrl(runtime);
    const runtimeCode = await this.getData(runtimeUrl);
    const modulesCode = runtimeCode.match(/\[e]\|\|e\)\+"(.+?)"\+({.+?})/);
    if (modulesCode) {
      const prefix = modulesCode[1];
      let hashes = `hashes=${modulesCode[2]}`;
      hashes += `;`;
      eval(hashes);

      let modulesNames = runtimeCode.match(/{0:"common".*?}/)[0];
      modulesNames = `modulesNames=${modulesNames};`
      eval(modulesNames);

      const modules = [];
      for (const key of Object.keys(hashes)) {
        const hash = hashes[key];
        const name = modulesNames[key] ?? key;
        modules.push(`${name}${prefix}${hash}.js`);
      }

      // find inside lazy loaded modules
      for (const module of modules) {
        const moduleUrl = this.getFullUrl(module);
        const moduleCode = await this.getData(moduleUrl);
        const allEndpoints = moduleCode.matchAll(/this\.http(Client)?\.(.+?)\((.*?)\)[;.}]/g);
        for (const endpoint of allEndpoints) {
          endpoints.push({method: endpoint[2], parameters: endpoint[3]});
        }
      }
    }

    return endpoints;
  }

  async getScript(name: RegExp): Promise<string> {
    if (!this.dom) {
      const data = await this.getData(this.site);
      this.dom = new JSDOM(data);
    }
    const scripts = this.dom.window.document.querySelectorAll("script");
    for (const script of scripts) {
      if (script.src.search(name) !== -1) {
        return script.src;
      }
    }
  }

  getData(url): Promise<string> {
    return new Promise(resolve => {
      https.get(url, res => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve(data);
        });

      });
    });
  }

  private getFullUrl(url: string) {
    if (url.startsWith('http')) {
      console.log(url);
      return url;
    } else {
      console.log(`${this.prefix ?? this.site}/${url}`);
      return `${this.prefix ?? this.site}/${url}`;
    }
  }
}
