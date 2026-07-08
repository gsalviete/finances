import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { UsersRepository } from './repository/users.repository';

/** Sem controller na V1: usuários só existem via auth (register/login/me). */
@Module({
  imports: [DatabaseModule],
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
