import { create } from 'zustand';
import type {
  ExamRow,
  NewsTickerConfig,
  PlaylistSlide,
  ScheduleRow,
  SmartAlert,
  TvDisplayConfig,
  TvPoster,
  TvPosterConfig,
} from '../types/tv';
import { getCairoNow, getLectureState, isDateInWindow } from '../lib/cairoTime';

interface TvState {
  displayConfig: TvDisplayConfig;
  posterConfig: TvPosterConfig;
  newsConfig: NewsTickerConfig;
  allRoomsCatalog: string[];
  localRoomsOverride: string[] | null;
  scheduleRows: ScheduleRow[];
  examRows: ExamRow[];
  posters: TvPoster[];
  playlist: PlaylistSlide[];
  currentIndex: number;
  posterOffset: number;
  isStale: boolean;
  lastSyncAt: number | null;
  alerts: SmartAlert[];
  settingsOpen: boolean;
  lowPowerMode: boolean;

  setDisplayConfig: (cfg: TvDisplayConfig) => void;
  setPosterConfig: (cfg: TvPosterConfig) => void;
  setNewsConfig: (cfg: NewsTickerConfig) => void;
  setScheduleData: (rows: ScheduleRow[], isInitial?: boolean) => void;
  setExamRows: (rows: ExamRow[]) => void;
  setPosters: (posters: TvPoster[]) => void;
  setLocalRoomsOverride: (rooms: string[] | null) => void;
  setStale: (stale: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  advanceSlide: () => void;
  rebuildPlaylist: () => void;
  dismissAlert: (id: string) => void;
}

function readLocalRooms(): string[] | null {
  try {
    const raw = localStorage.getItem('citl-tv-local-rooms');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function diffScheduleAlerts(prev: ScheduleRow[], next: ScheduleRow[]): SmartAlert[] {
  if (!prev.length || !next.length) return [];
  const prevById = new Map(prev.filter((r) => r.id != null).map((r) => [String(r.id), r]));
  const alerts: SmartAlert[] = [];
  const now = Date.now();

  for (const row of next) {
    if (row.id == null) continue;
    const old = prevById.get(String(row.id));
    if (!old) continue;

    if (old.room_name !== row.room_name) {
      alerts.push({
        id: `swap-${row.id}-${row.room_name}`,
        kind: 'room-swap',
        message: `تم تغيير قاعة محاضرة ${row.course_name || ''} من ${old.room_name} إلى ${row.room_name}`,
        createdAt: now,
      });
    } else if (old.status !== 'cancelled' && row.status === 'cancelled') {
      alerts.push({
        id: `cancel-${row.id}-${now}`,
        kind: 'cancelled',
        message: `تم إلغاء محاضرة ${row.course_name || ''} في قاعة ${row.room_name}`,
        createdAt: now,
      });
    } else if (old.status === 'cancelled' && row.status !== 'cancelled') {
      alerts.push({
        id: `restore-${row.id}-${now}`,
        kind: 'restored',
        message: `تم إعادة تفعيل محاضرة ${row.course_name || ''} في قاعة ${row.room_name}`,
        createdAt: now,
      });
    }
  }
  return alerts.slice(0, 3);
}

export const useTvStore = create<TvState>((set, get) => ({
  displayConfig: {
    slideDurationSeconds: 10,
    examSlideDurationSeconds: 15,
    examsEnabled: true,
    studyEnhancedDisplayEnabled: true,
    studyRowsPerPage: 4,
    studySlidesPerPoster: 2,
    studyRotationMode: 'interleaved',
    studyAdaptiveDuration: true,
  },
  posterConfig: { enabled: true, rotationSeconds: 15 },
  newsConfig: { text: 'أهلاً بكم في كلية النقل الدولي واللوجستيات — CITL Smart System', speed: '35s' },
  allRoomsCatalog: [],
  localRoomsOverride: readLocalRooms(),
  scheduleRows: [],
  examRows: [],
  posters: [],
  playlist: [],
  currentIndex: 0,
  posterOffset: 0,
  isStale: false,
  lastSyncAt: null,
  alerts: [],
  settingsOpen: false,
  lowPowerMode: /SMART-TV|Tizen/i.test(navigator.userAgent),

  setDisplayConfig: (cfg) => {
    set((s) => ({ displayConfig: { ...s.displayConfig, ...cfg } }));
    get().rebuildPlaylist();
  },
  setPosterConfig: (cfg) => {
    set((s) => ({ posterConfig: { ...s.posterConfig, ...cfg } }));
    get().rebuildPlaylist();
  },
  setNewsConfig: (cfg) => set({ newsConfig: cfg }),

  setScheduleData: (rows, isInitial = false) => {
    const prev = get().scheduleRows;
    const catalog = Array.from(new Set(rows.map((r) => r.room_name).filter(Boolean))).sort();
    const newAlerts = isInitial ? [] : diffScheduleAlerts(prev, rows);
    set((s) => ({
      scheduleRows: rows,
      allRoomsCatalog: catalog.length ? catalog : s.allRoomsCatalog,
      lastSyncAt: Date.now(),
      isStale: false,
      alerts: newAlerts.length ? [...newAlerts, ...s.alerts].slice(0, 3) : s.alerts,
    }));
    get().rebuildPlaylist();
  },

  setExamRows: (rows) => set({ examRows: rows }),
  setPosters: (posters) => {
    set({ posters });
    get().rebuildPlaylist();
  },

  setLocalRoomsOverride: (rooms) => {
    if (rooms === null) localStorage.removeItem('citl-tv-local-rooms');
    else localStorage.setItem('citl-tv-local-rooms', JSON.stringify(rooms));
    set({ localRoomsOverride: rooms });
    get().rebuildPlaylist();
  },

  setStale: (isStale) => set({ isStale }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

  advanceSlide: () => {
    const { playlist, currentIndex, posterOffset } = get();
    if (!playlist.length) return;
    const nextIdx = (currentIndex + 1) % playlist.length;
    if (nextIdx === 0) {
      const adsCount = playlist.filter((p) => p.kind === 'poster').length;
      set({ currentIndex: 0, posterOffset: posterOffset + Math.max(1, adsCount) });
      get().rebuildPlaylist();
    } else {
      set({ currentIndex: nextIdx });
    }
  },

  rebuildPlaylist: () => {
    const { displayConfig, posterConfig, allRoomsCatalog, localRoomsOverride, scheduleRows, posters, posterOffset, playlist, currentIndex } = get();
    const now = getCairoNow();
    const currentKey = playlist[currentIndex]?.key || '';

    const selectedRooms = (localRoomsOverride ?? displayConfig.activeRooms ?? allRoomsCatalog)
      .filter((r) => isDateInWindow(displayConfig.studyRoomWindows?.[r], now.date));

    const rowsPerPage = Math.min(6, Math.max(2, Number(displayConfig.studyRowsPerPage) || 4));
    const studyPages: PlaylistSlide[] = [];

    for (const room of selectedRooms) {
      const roomRows = scheduleRows
        .filter((r) => r.room_name === room && r.day_of_week === now.day && getLectureState(r, now) !== 'ended')
        .sort((a, b) => (a.period_order || 0) - (b.period_order || 0));

      const totalPages = Math.ceil(roomRows.length / rowsPerPage);
      for (let p = 0; p < totalPages; p++) {
        studyPages.push({
          kind: 'study',
          key: `room:${room}:${p}`,
          room,
          rows: roomRows.slice(p * rowsPerPage, (p + 1) * rowsPerPage),
          allRows: roomRows,
          page: p + 1,
          totalPages,
        });
      }
    }

    if (!studyPages.length && selectedRooms.length) {
      const ended = scheduleRows.some((r) => r.day_of_week === now.day && getLectureState(r, now) === 'ended');
      studyPages.push({ kind: 'study-end', key: 'study-day-status', ended });
    }

    const activePosters = posterConfig.enabled === false
      ? []
      : posters.filter((p) => p.is_active !== false && isDateInWindow(p, now.date));

    const adSlides: PlaylistSlide[] = activePosters.map((poster, i) => ({
      kind: 'poster',
      key: `poster:${poster.id ?? i}`,
      poster,
      index: i,
      total: activePosters.length,
    }));

    let nextPlaylist: PlaylistSlide[] = [];
    if (!studyPages.length) {
      nextPlaylist = adSlides;
    } else if (displayConfig.studyRotationMode === 'grouped' || !adSlides.length) {
      nextPlaylist = [...studyPages, ...adSlides];
    } else {
      const every = Math.min(6, Math.max(1, Number(displayConfig.studySlidesPerPoster) || 2));
      let adPtr = posterOffset;
      studyPages.forEach((page, i) => {
        nextPlaylist.push(page);
        if ((i + 1) % every === 0 || i === studyPages.length - 1) {
          const ad = adSlides[adPtr % adSlides.length];
          adPtr++;
          nextPlaylist.push({ ...ad, key: `${ad.key}:slot:${i}` });
        }
      });
    }

    const preservedIdx = nextPlaylist.findIndex((s) => s.key === currentKey);
    set({
      playlist: nextPlaylist,
      currentIndex: preservedIdx >= 0 ? preservedIdx : 0,
    });
  },
}));
