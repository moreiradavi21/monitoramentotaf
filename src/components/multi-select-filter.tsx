import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MultiSelectFilter({ allLabel, options, value, onChange, className }: {
  allLabel: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const label = value.length === 0 ? allLabel
    : value.length === 1 ? options.find(o => o.value === value[0])?.label ?? allLabel
    : `${value.length} selecionados`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`justify-between font-normal ${className ?? ""}`}>
          <span className="truncate">{label}</span><ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent">
          <Checkbox checked={value.length === 0} onCheckedChange={() => onChange([])} />{allLabel}
        </label>
        {options.map(o => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent">
            <Checkbox checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />{o.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
