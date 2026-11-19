export type LectureState = 'live' | 'upcoming' | 'cancelled' | 'ended';

export interface ScheduleRow {
  id?: string | number;
  room_name: string;
  day_of_week: string;
  time_slot: string;
  period_order?: number;
  course_name?: string;
  course_code?: string;
  instructor?: string;
  status?: string;
  cancelled_dates?: string[] | string | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface ExamRow {
  id?: string | number;
  exam_date: string;
  start_time: string;
  end_time: string;
  academic_level?: string;
  course_name?: string;
  course_code?: string;
  course_language?: string;
  group_number?: string;
  instructor?: string;
  room_name: string;
}

export interface TvPoster {
  id: string | number;
  title?: string;
  image_url: string;
  media_type?: 'image' | 'video' | string;
  mime_type?: string;
  fit_mode?: 'cover' | 'contain' | string;
  video_layout?: 'portrait' | 'native-cw' | string;
  duration?: number;
  play_sound?: boolean;
  display_order?: number;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TvDisplayConfig {
  slideDurationSeconds?: number;
  examSlideDurationSeconds?: number;
  activeRooms?: string[];
  examsEnabled?: boolean;
  testExamDate?: string;
  examDisplayWindow?: { start_date?: string; end_date?: string };
  studyEnhancedDisplayEnabled?: boolean;
  studyRowsPerPage?: number;
  studySlidesPerPoster?: number;
  studyRotationMode?: 'interleaved' | 'grouped';
  studyAdaptiveDuration?: boolean;
  studyRoomWindows?: Record<string, { start_date?: string; end_date?: string }>;
  updatedAt?: number;
}

export interface TvPosterConfig {
  enabled?: boolean;
  rotationSeconds?: number;
}

export interface NewsTickerConfig {
  text?: string;
  speed?: string;
  sliderVal?: number;
}

export interface SmartAlert {
  id: string;
  message: string;
  kind: 'room-swap' | 'cancelled' | 'restored' | 'updated';
  createdAt: number;
}

export type PlaylistSlide =
  | { kind: 'study'; key: string; room: string; rows: ScheduleRow[]; allRows: ScheduleRow[]; page: number; totalPages: number }
  | { kind: 'study-end'; key: string; ended: boolean }
  | { kind: 'poster'; key: string; poster: TvPoster; index: number; total: number };
