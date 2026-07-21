import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        dbName: configService.get<string>('MONGODB_DB', 'CarParking'),
      }),
    }),
  ],
  providers: [Logger],
  exports: [MongooseModule],
})
export class DatabaseModule {
  constructor(private readonly logger: Logger) {}

  async onModuleInit() {
    this.logger.log(`Connected to MongoDB database`);
  }
}
