import { BadRequestException } from '@nestjs/common';

export interface TransactionCursor {
  date: Date;
  id: string;
}

/** Cursor opaco (base64url de "epochMs:objectId") — estável para date desc, _id desc. */
export function encodeCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.date.getTime()}:${cursor.id}`).toString('base64url');
}

export function decodeCursor(raw: string): TransactionCursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const match = /^(\d+):([0-9a-fA-F]{24})$/.exec(decoded);
  if (!match) {
    throw new BadRequestException({
      message: 'Cursor de paginação inválido',
      reason: 'BAD_CURSOR',
    });
  }
  return { date: new Date(Number(match[1])), id: match[2] as string };
}
