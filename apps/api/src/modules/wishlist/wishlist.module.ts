import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { ProductMetadataService } from './product-metadata/product-metadata.service';
import { WishlistRepository } from './repository/wishlist.repository';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistRepository, ProductMetadataService],
})
export class WishlistModule {}
