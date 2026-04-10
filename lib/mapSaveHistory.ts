import AsyncStorage from '@react-native-async-storage/async-storage';

export type MapSaveStatus = 'started' | 'success' | 'failed' | 'removed';

export type MapSaveHistoryItem = {
  id: string;
  status: MapSaveStatus;
  savedTiles?: number;
  message?: string;
  savedAt: string;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
};

const STORAGE_KEY = '@map_save_history_v1';
const MAX_ITEMS = 50;

export async function loadMapSaveHistory(): Promise<MapSaveHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MapSaveHistoryItem[];
  } catch {
    return [];
  }
}

export async function clearMapSaveHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function removeMapSaveHistoryItem(id: string): Promise<void> {
  const list = await loadMapSaveHistory();
  const next = list.filter((x) => x.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function appendMapSaveHistory(item: MapSaveHistoryItem): Promise<void> {
  const list = await loadMapSaveHistory();
  const deduped = [item, ...list.filter((x) => x.id !== item.id)];
  const next = deduped.slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
