'use client';

import { ColumnMapping } from '@/types';
import { TARGET_COLUMN_DISPLAY, isRequiredColumn } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ColumnMappingProps {
  mappings: ColumnMapping[];
  sourceHeaders: string[];
  onChange: (mappings: ColumnMapping[]) => void;
}

const TRANSFORM_LABELS: Record<string, string> = {
  none: '直接映射',
  divide1000: '÷1000 (g→kg)',
  htmlToText: 'HTML→文本',
  calculated: '定价公式',
  fixedValue: '固定值',
};

export function ColumnMappingEditor({ mappings, sourceHeaders, onChange }: ColumnMappingProps) {
  function updateMapping(idx: number, patch: Partial<ColumnMapping>) {
    const updated = mappings.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange(updated);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-48">目标列</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-56">源数据列</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-36">转换方式</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">固定值 / 说明</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping, idx) => {
            const isRequired = isRequiredColumn(mapping.targetColumn);
            const displayName = TARGET_COLUMN_DISPLAY[mapping.targetColumn] || mapping.targetColumn;

            return (
              <tr key={mapping.targetColumn} className="border-b last:border-0 border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2">
                  <span className={`font-medium ${isRequired ? 'text-destructive' : 'text-foreground'}`}>
                    {displayName}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {mapping.transform === 'calculated' || mapping.transform === 'fixedValue' ? (
                    <span className="text-muted-foreground text-xs italic">—</span>
                  ) : (
                    <Select
                      value={mapping.sourceColumn || '__none__'}
                      onValueChange={(val) =>
                        updateMapping(idx, { sourceColumn: val === '__none__' ? null : val })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="不映射" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— 不映射 —</SelectItem>
                        {sourceHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-2">
                  {mapping.transform === 'calculated' ? (
                    <Badge variant="secondary" className="text-xs">定价公式</Badge>
                  ) : mapping.transform === 'fixedValue' ? (
                    <Badge variant="secondary" className="text-xs bg-primary/15 text-primary border border-primary/20">固定值</Badge>
                  ) : (
                    <Select
                      value={mapping.transform}
                      onValueChange={(val) =>
                        updateMapping(idx, { transform: val as ColumnMapping['transform'] })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">直接映射</SelectItem>
                        <SelectItem value="divide1000">÷1000 (g→kg)</SelectItem>
                        <SelectItem value="htmlToText">HTML→文本</SelectItem>
                        <SelectItem value="fixedValue">固定值</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-2">
                  {mapping.transform === 'fixedValue' ? (
                    <Input
                      className="h-8 text-xs"
                      placeholder="输入固定值…"
                      value={mapping.fixedValue || ''}
                      onChange={(e) => updateMapping(idx, { fixedValue: e.target.value })}
                    />
                  ) : mapping.description ? (
                    <span className="text-xs text-muted-foreground italic">{mapping.description}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
