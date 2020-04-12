import { Injectable } from '@nestjs/common';
import { Endpoint } from "./interfaces/endpoint";
import jsdom = require("jsdom");
import https = require('https');

const {JSDOM} = jsdom;


@Injectable()
export class AppService {

  dom: any;
  private site: string;

  async parseSite(site: string): Promise<Endpoint[]> {
    this.site = site;
    const endpoints: Endpoint[] = [];
    const main = await this.getScript(/main.*\.js/);
    const mainUrl = this.getFullUrl(main);
    const mainCode = await this.getData(mainUrl);
    const allEndpoints = mainCode.matchAll(/this\.http(Client)?\.(.+?)\((.*?)\)[;.}]/g);
    for (const endpoint of allEndpoints) {
      endpoints.push({method: endpoint[2], parameters: endpoint[3]});
    }
    const runtime = await this.getScript(/runtime.*\.js/);
    const runtimeUrl = this.getFullUrl(runtime);
    const runtimeCode = await this.getData(runtimeUrl);
    const modulesCode = runtimeCode.match(/\[e]\|\|e\)\+"(.+?)"\+({.+?})/);
    if (modulesCode) {
      const prefix = modulesCode[1];
      let hashes = `hashes=${modulesCode[2]}`;
      hashes += `;`;
      console.log(hashes);
      eval(hashes);
      const modules = [];
      for (const key of Object.keys(hashes)) {
        const hash = hashes[key];
        modules.push(`${key}${prefix}${hash}.js`);
      }
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

  private getFullUrl(main: string) {
    if (main.startsWith('http')) {
      return main;
    } else {
      return `${this.site}/${main}`;
    }
  }
}
