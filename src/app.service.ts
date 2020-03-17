import { Injectable } from '@nestjs/common';
import { Endpoint } from "./interfaces/endpoint";
import jsdom = require("jsdom");
import https = require('https');

const {JSDOM} = jsdom;


@Injectable()
export class AppService {
  async parseSite(site: string): Promise<Endpoint[]> {
    const main = await this.getScript(site, /main.*\.js/);
    const mainCode = await this.getData(main);
    const allEndpoints = mainCode.matchAll(/this\.http(Client)?\.(.+?)\((.*?)\)[;.}]/g);
    const endpoints: Endpoint[] = [];
    for (const endpoint of allEndpoints) {
      endpoints.push({method: endpoint[2], parameters: endpoint[3]});
    }
    return endpoints;
  }

  async getScript(site: string, name: RegExp): Promise<string> {
    const data = await this.getData(site);
    const dom = new JSDOM(data);
    const scripts = dom.window.document.querySelectorAll("script");
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
}
