import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CodeAnalysisModule } from './modules/code-analysis/infrastructure/config/code-analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CodeAnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

