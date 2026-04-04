'use client';

import { useCallback, useState } from 'react';
import { SourceRow } from '@/types';
import { parseHtmlXls } from '@/lib/parse-html-xls';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface FileUploadProps {
  onDataParsed: (headers: string[], rows: SourceRow[]) => void;
}

export function FileUpload({ onDataParsed }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      setFileName(file.name);

      try {
        const text = await file.text();

        // Detect HTML format
        const isHtml = /<html|<table|<HTML|<TABLE/i.test(text.substring(0, 500));

        if (isHtml) {
          const { headers, rows } = parseHtmlXls(text);
          if (rows.length === 0) throw new Error('文件中未找到数据行');
          onDataParsed(headers, rows);
        } else {
          throw new Error('暂不支持此文件格式，请上传 HTML 格式的 .xls 文件（ERP 导出格式）');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '文件解析失败');
        setFileName(null);
      } finally {
        setLoading(false);
      }
    },
    [onDataParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-primary bg-primary/8 glow-coral scale-[1.005]'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={handleFileInput}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">正在解析文件…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <svg className="w-12 h-12 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-base font-medium text-foreground">
                拖拽文件到此处，或点击选择文件
              </p>
              <p className="text-sm text-muted-foreground mt-1">支持 ERP 导出的 .xls 格式</p>
            </div>
          </div>
        )}
      </div>

      {fileName && !error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <svg className="w-5 h-5 text-[oklch(0.72_0.17_162)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-foreground flex-1">{fileName}</span>
            <Badge className="bg-[oklch(0.72_0.17_162)]/20 text-[oklch(0.72_0.17_162)] border border-[oklch(0.72_0.17_162)]/30">已解析</Badge>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
