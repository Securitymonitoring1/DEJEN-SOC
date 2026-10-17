import type { HuntPreset, HuntQuery } from "../../types/threatHunting";

interface HuntPresetsProps {
  presets: HuntPreset[];
  saved: HuntQuery[];
  onSelect: (query: string) => void;
}

export const HuntPresets = ({ presets, saved, onSelect }: HuntPresetsProps) => {
  const hunts = [
    ...presets.map((preset) => ({ id: preset.id, name: preset.name, query: preset.query, technique: preset.technique })),
    ...saved.map((hunt) => ({ id: hunt.id, name: hunt.name, query: hunt.query, technique: undefined })),
  ];

  return <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Hunting presets">
    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
      Preset
      <select className="th-select min-w-48" defaultValue="" onChange={(event) => {
        const hunt = hunts.find((item) => item.id === event.target.value);
        if (hunt) onSelect(hunt.query);
      }}>
        <option value="">Choose a hunt</option>
        {hunts.map((hunt) => <option key={hunt.id} value={hunt.id}>{hunt.name}{hunt.technique ? ` · ${hunt.technique}` : ""}</option>)}
      </select>
    </label>
    <span className="text-[9px] text-slate-500">{presets.length} presets{saved.length ? ` · ${saved.length} saved` : ""}</span>
  </div>;
};