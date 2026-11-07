import { Module } from '@nestjs/common';
import { CatsModule } from './cats/cats.module';

/**
 * Root module of the playground application.
 *
 * Edit this file (and the modules it imports) to experiment with NestJS.
 * The runtime only requires that this file exports `AppModule`.
 */
@Module({
  imports: [CatsModule],
})
export class AppModule {}
