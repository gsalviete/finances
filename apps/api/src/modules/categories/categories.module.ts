import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './repository/categories.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesRepository],
})
export class CategoriesModule {}
