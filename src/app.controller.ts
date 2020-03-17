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
  parse(@Query('site') site: string) {
    return this.appService.parseSite(site);
  }
}
