import { IStorageProvider } from '../../storage/types';

export interface Favorite {
  id: string;
  name: string;
  content: string;
  systemPrompt?: string;
  category?: string;
  tags?: string[];
  source?: string;
  createdAt: number;
  updatedAt: number;
  versionHistory?: Array<{
    content: string;
    systemPrompt?: string;
    createdAt: number;
  }>;
}

export class FavoriteManager {
  private storageKey = 'favorites';
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  async getFavorites(): Promise<Favorite[]> {
    const raw = await this.storage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  async getFavorite(id: string): Promise<Favorite | undefined> {
    const favorites = await this.getFavorites();
    return favorites.find(f => f.id === id);
  }

  async addFavorite(favorite: Favorite): Promise<void> {
    const favorites = await this.getFavorites();
    favorites.unshift(favorite);
    await this.storage.setItem(this.storageKey, JSON.stringify(favorites));
  }

  async updateFavorite(id: string, updates: Partial<Favorite>): Promise<void> {
    const favorites = await this.getFavorites();
    const index = favorites.findIndex(f => f.id === id);
    if (index < 0) throw new Error(`Favorite "${id}" not found`);
    favorites[index] = { ...favorites[index], ...updates, updatedAt: Date.now() };
    await this.storage.setItem(this.storageKey, JSON.stringify(favorites));
  }

  async deleteFavorite(id: string): Promise<void> {
    const favorites = await this.getFavorites();
    const filtered = favorites.filter(f => f.id !== id);
    await this.storage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  async getCategories(): Promise<string[]> {
    const favorites = await this.getFavorites();
    const cats = new Set<string>();
    for (const f of favorites) {
      if (f.category) cats.add(f.category);
    }
    return Array.from(cats);
  }

  async searchFavorites(query: string): Promise<Favorite[]> {
    const favorites = await this.getFavorites();
    const q = query.toLowerCase();
    return favorites.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.content.toLowerCase().includes(q) ||
      f.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  async importFavorites(data: string): Promise<void> {
    const favorites = JSON.parse(data) as Favorite[];
    const existing = await this.getFavorites();
    const merged = [...favorites, ...existing];
    const seen = new Set<string>();
    const deduped = merged.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    await this.storage.setItem(this.storageKey, JSON.stringify(deduped));
  }

  async exportData(): Promise<string> {
    const favorites = await this.getFavorites();
    return JSON.stringify(favorites, null, 2);
  }

  async importData(data: string): Promise<void> {
    await this.importFavorites(data);
  }
}
