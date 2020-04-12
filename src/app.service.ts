import { Injectable } from '@nestjs/common';
import { Endpoint } from "./interfaces/endpoint";
import jsdom = require("jsdom");
import https = require('https');

const {JSDOM} = jsdom;


@Injectable()
export class AppService {

  private dom: any;
  private site: string;
  private prefix: string;
  private endpoints: Endpoint[] = [];

  async parseSite(site: string): Promise<Endpoint[]> {
    this.site = site;
    const data = await this.getData(this.site);
    this.dom = new JSDOM(data);
    this.endpoints = [];

    // find inside main
    const main = await this.getScript(/main.*\.js/);
    if (main.startsWith('http')) {
      this.prefix = main.split('/main')[0];
    } else {
      this.prefix = null;
    }

    await this.parseScript(main);

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
        await this.parseScript(module);
      }
    }

    return this.endpoints;
  }

  private async getScript(name: RegExp): Promise<string> {
    const scripts = this.dom.window.document.querySelectorAll("script");
    for (const script of scripts) {
      if (script.src.search(name) !== -1) {
        return script.src;
      }
    }
  }

  private getData(url): Promise<string> {
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
      return url;
    } else {
      return `${this.prefix ?? this.site}/${url}`;
    }
  }

  private async parseScript(script: string) {
    const scriptUrl = this.getFullUrl(script);
    const array = scriptUrl.split('/');
    const scriptName = array[array.length - 1].split('.')[0]
    const scriptCode = await this.getData(scriptUrl);
    const allEndpoints = scriptCode.matchAll(/this\.http(Client)?\.(.+?)\((.*?)\)[;.}]/g);
    for (const endpoint of allEndpoints) {
      this.endpoints.push({method: endpoint[2], parameters: endpoint[3], scriptUrl, scriptName});
    }
  }
}
