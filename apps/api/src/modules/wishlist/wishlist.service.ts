import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Clock,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
  WishlistItem,
  WishlistPriority,
  WishlistScrapeStatus,
} from '@finances/shared';
import { CLOCK } from '../../common/clock/clock.module';
import { SettingsService } from '../settings/settings.service';
import type { ExtractedMetadata } from './product-metadata/html-metadata.parser';
import { ProductMetadataService } from './product-metadata/product-metadata.service';
import { assertPublicUrl } from './product-metadata/url-guard';
import { WishlistRepository } from './repository/wishlist.repository';

const PRIORITY_RANK: Record<WishlistPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** OK = tudo extraído; PARTIAL = algo; FAILED = nada (edição manual resolve). */
function statusOf(metadata: ExtractedMetadata): WishlistScrapeStatus {
  const found = [metadata.name, metadata.priceCents, metadata.imageUrl].filter(
    (value) => value !== null,
  ).length;
  if (found === 3) return 'OK';
  if (found > 0) return 'PARTIAL';
  return 'FAILED';
}

@Injectable()
export class WishlistService {
  constructor(
    private readonly repository: WishlistRepository,
    private readonly metadata: ProductMetadataService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Cadastro por URL: snapshot da extração; falha nunca bloqueia (ADR-018). */
  async create(userId: string, input: CreateWishlistItemInput): Promise<WishlistItem> {
    await assertPublicUrl(input.url); // URL privada/loopback → 400, antes de qualquer fetch
    const extracted = await this.metadata.extract(input.url);
    const status = statusOf(extracted);
    const userSettings = await this.settings.getOrCreate(userId);

    return this.repository.create({
      userId,
      url: input.url,
      name: extracted.name ?? new URL(input.url).hostname, // placeholder editável
      priceCents: extracted.priceCents,
      currency: extracted.currency ?? userSettings.currency,
      imageUrl: extracted.imageUrl,
      priority: input.priority,
      scrapeStatus: status,
      scrapedAt: status === 'FAILED' ? null : this.clock.now(),
    });
  }

  /** Prioridade manda; empate resolve por mais recente (determinístico). */
  async list(userId: string): Promise<WishlistItem[]> {
    const items = await this.repository.listForUser(userId);
    return items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }

  async get(userId: string, id: string): Promise<WishlistItem> {
    const item = await this.repository.findByIdForUser(id, userId);
    if (item === null) throw new NotFoundException('Item da wishlist não encontrado');
    return item;
  }

  async update(userId: string, id: string, input: UpdateWishlistItemInput): Promise<WishlistItem> {
    const updated = await this.repository.updateForUser(id, userId, input);
    if (updated === null) throw new NotFoundException('Item da wishlist não encontrado');
    return updated;
  }

  /**
   * Re-executa a extração sob demanda (ADR-018 §2). Só sobrescreve o que foi
   * extraído com sucesso — refresh falho não apaga dados existentes.
   */
  async refresh(userId: string, id: string): Promise<WishlistItem> {
    const item = await this.get(userId, id);
    await assertPublicUrl(item.url);
    const extracted = await this.metadata.extract(item.url);
    const status = statusOf(extracted);

    const update: Record<string, unknown> = { scrapeStatus: status };
    if (extracted.name !== null) update.name = extracted.name;
    if (extracted.priceCents !== null) update.priceCents = extracted.priceCents;
    if (extracted.imageUrl !== null) update.imageUrl = extracted.imageUrl;
    if (extracted.currency !== null) update.currency = extracted.currency;
    if (status !== 'FAILED') update.scrapedAt = this.clock.now();

    const updated = await this.repository.updateForUser(id, userId, update);
    if (updated === null) throw new NotFoundException('Item da wishlist não encontrado');
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const item = await this.get(userId, id);
    await this.repository.softDeleteById(item.id, {
      deletedAt: this.clock.now(),
      deletedBy: userId,
    });
  }
}
