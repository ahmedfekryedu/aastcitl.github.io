import { supabase } from '../lib/supabase';
import { getCairoNow } from '../lib/cairoTime';
import { useTvStore } from '../store/useTvStore';

let initialized = false;

export async function fetchAllTvData(isInitial = false): Promise<void> {
  const store = useTvStore.getState();
  const now = getCairoNow();
  const examDate = store.displayConfig.testExamDate?.trim() || now.date;

  try {
    const [settingsRes, scheduleRes, postersRes, examsRes] = await Promise.all([
      supabase
        .from('site_settings')
        .select('setting_key,setting_value')
        .in('setting_key', ['tv_display_config', 'tv_poster_config', 'news_config', 'exam_news_config']),
      supabase.from('academic_schedule').select('*').eq('day_of_week', now.day),
      supabase.from('tv_posters').select('*').eq('is_active', true).order('display_order', { ascending: true }),
      store.displayConfig.examsEnabled
        ? supabase.from('exam_schedule').select('*').eq('exam_date', examDate).order('start_time')
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (settingsRes.data) {
      const map = new Map(settingsRes.data.map((r) => [r.setting_key, r.setting_value]));
      if (map.has('tv_display_config')) store.setDisplayConfig(map.get('tv_display_config'));
      if (map.has('tv_poster_config')) store.setPosterConfig(map.get('tv_poster_config'));
      const isExam = (examsRes.data?.length || 0) > 0;
      const tickerKey = isExam ? 'exam_news_config' : 'news_config';
      if (map.has(tickerKey)) store.setNewsConfig(map.get(tickerKey));
    }

    if (!scheduleRes.error && Array.isArray(scheduleRes.data)) {
      store.setScheduleData(scheduleRes.data, isInitial);
    } else {
      store.setStale(true);
    }

    if (!postersRes.error && Array.isArray(postersRes.data)) {
      store.setPosters(postersRes.data);
    }

    if (!examsRes.error && Array.isArray(examsRes.data)) {
      store.setExamRows(examsRes.data);
    }
  } catch {
    store.setStale(true);
  }
}

export function startRealtimeSync(): () => void {
  if (initialized) return () => {};
  initialized = true;

  fetchAllTvData(true);

  const channel = supabase
    .channel('citl-tv-v2-unified')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_schedule' }, () => fetchAllTvData(false))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_posters' }, () => fetchAllTvData(false))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => fetchAllTvData(false))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_schedule' }, () => fetchAllTvData(false))
    .subscribe();

  const pollTimer = window.setInterval(() => fetchAllTvData(false), 120_000);
  const onOnline = () => fetchAllTvData(false);
  window.addEventListener('online', onOnline);

  return () => {
    initialized = false;
    window.clearInterval(pollTimer);
    window.removeEventListener('online', onOnline);
    supabase.removeChannel(channel);
  };
}
