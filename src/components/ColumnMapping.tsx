'use client';

import { ColumnMapping } from '@/types';
import { TARGET_COLUMN_DISPLAY, isRequiredColumn } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getZebraTableToneClass } from '@/lib/table-contrast';
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

// Columns whose value is determined by AI variant analysis; fixedValue is only a fallback.
const VARIANT_NAME_COLUMNS = new Set([
  '变种属性名称一',
  '变种属性名称二',
  '主要销售变体名称（主题）',
  '次要销售变体名称（主题）',
]);

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
            const isVariantName = VARIANT_NAME_COLUMNS.has(mapping.targetColumn);

            return (
              <tr key={mapping.targetColumn} className={`border-b last:border-0 border-border transition-colors ${getZebraTableToneClass(idx)}`}>
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
                  ) : isVariantName ? (
                    <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">AI 自动</Badge>
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
                  {isVariantName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 text-xs w-28"
                        placeholder="回退值…"
                        value={mapping.fixedValue || ''}
                        onChange={(e) => updateMapping(idx, { fixedValue: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">AI 分析优先，此为无分析结果时的回退值</span>
                    </div>
                  ) : mapping.transform === 'fixedValue' ? (
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
