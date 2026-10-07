import type {
  MediaCategory,
  PlaybackResult,
  ProviderCapability,
  ProviderEpisode,
  ProviderTitle,
} from "@/lib/playback";
export interface ProviderAdapter {
  id: string;
  name: string;
  host: string;
  capabilities: ProviderCapability[];
  categories: MediaCategory[];
  documentation: string;
  plan: string;
  reliability: number;
  search(query: string): Promise<ProviderTitle[]>;
  title(id: string): Promise<ProviderTitle>;
  episodes(id: string): Promise<ProviderEpisode[]>;
  episode(id: string): Promise<ProviderEpisode | null>;
  playback(id: string): Promise<PlaybackResult>;
}
