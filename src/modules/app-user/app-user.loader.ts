import { Injectable, Scope } from '@nestjs/common';
import DataLoader = require('dataloader');
import { AppUserService } from './app-user.service';

/**
 * Request-scoped DataLoader для batch-загрузки профилей пользователей.
 * Сначала из app_user (БД), для отсутствующих — lazy-load из Keycloak.
 */
@Injectable({ scope: Scope.REQUEST })
export class AppUserLoader {
  private readonly loader: DataLoader<string, AppUserResolved | null>;

  constructor(private readonly appUserService: AppUserService) {
    this.loader = new DataLoader(
      async (ids: readonly string[]) => {
        const map = await this.appUserService.loadByIds([...ids]);
        return ids.map((id) => {
          const user = map.get(id);
          if (!user) return null;
          return {
            id: user.id,
            displayName: this.resolveDisplayName(user),
            personId: user.personId,
          };
        });
      },
      { cache: true },
    );
  }

  async load(id: string): Promise<AppUserResolved | null> {
    return this.loader.load(id);
  }

  private resolveDisplayName(user: {
    displayName: string;
    person?: { firstname: string | null; lastname: string | null } | null;
  }): string {
    if (user.person) {
      const name = [user.person.lastname, user.person.firstname]
        .filter(Boolean)
        .join(' ');
      if (name) return name;
    }
    return user.displayName;
  }
}

export interface AppUserResolved {
  id: string;
  displayName: string;
  personId: string | null;
}
