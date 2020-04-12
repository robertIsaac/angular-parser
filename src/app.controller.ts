import { Controller, Get, Query, Render } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
  }

  @Get()
  @Render('index.hbs')
  root() {
    return;
  }

  @Get('parse')
  @Render('parse.hbs')
  async parse(@Query('site') site: string) {
    if (!site) {
      return {endpoints: []};
    }
    const endpoints = await this.appService.parseSite(site);
    return {
      endpoints
    };
  }
}
