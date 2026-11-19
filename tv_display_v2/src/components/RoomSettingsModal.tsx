import React, { useState } from 'react';
import { useTvStore } from '../store/useTvStore';

export const RoomSettingsModal: React.FC = () => {
  const open = useTvStore((s) => s.settingsOpen);
  const setOpen = useTvStore((s) => s.setSettingsOpen);
  const catalog = useTvStore((s) => s.allRoomsCatalog);
  const localRooms = useTvStore((s) => s.localRoomsOverride);
  const displayConfig = useTvStore((s) => s.displayConfig);
  const setLocalRoomsOverride = useTvStore((s) => s.setLocalRoomsOverride);

  const [followAdmin, setFollowAdmin] = useState(localRooms === null);
  const [selected, setSelected] = useState<string[]>(localRooms ?? displayConfig.activeRooms ?? catalog);

  if (!open) return null;

  const toggleRoom = (room: string) => {
    setFollowAdmin(false);
    setSelected((prev) => (prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]));
  };

  const handleSave = () => {
    setLocalRoomsOverride(followAdmin ? null : selected);
    setOpen(false);
  };

  return (
    <div className="tv2-modal-backdrop" onClick={() => setOpen(false)}>
      <div className="tv2-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="tv2-modal-head">
          <h3>اختيار القاعات للعرض</h3>
          <button type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <label className="tv2-modal-check">
          <input
            type="checkbox"
            checked={followAdmin}
            onChange={(e) => setFollowAdmin(e.target.checked)}
          />
          <span>اتباع اختيار القاعات من لوحة التحكم</span>
        </label>

        <div className="tv2-rooms-grid">
          {catalog.map((room) => {
            const active = selected.includes(room);
            return (
              <button
                key={room}
                type="button"
                className={`tv2-room-chip font-english ${active ? 'is-selected' : ''}`}
                onClick={() => toggleRoom(room)}
              >
                {room}
              </button>
            );
          })}
        </div>

        <div className="tv2-modal-actions">
          <button type="button" className="tv2-btn-cancel" onClick={() => setOpen(false)}>إلغاء</button>
          <button type="button" className="tv2-btn-save" onClick={handleSave}>حفظ وتشغيل</button>
        </div>
      </div>
    </div>
  );
};
