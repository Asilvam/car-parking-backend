import { ConsoleLogger } from '@nestjs/common';
import { formatSantiagoTime, SANTIAGO_TIME_ZONE } from './santiago-time';

export class SantiagoLogger extends ConsoleLogger {
  protected getTimestamp(): string {
    return `[${formatSantiagoTime()} ${SANTIAGO_TIME_ZONE}]`;
  }
}
