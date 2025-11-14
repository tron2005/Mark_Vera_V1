import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileArchive, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import JSZip from "jszip";

export const RunalyzeBackupAnalyzer = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [files, setFiles] = useState<Record<string, any> | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Prosím nahrajte ZIP soubor");
      return;
    }

    setAnalyzing(true);
    try {
      // Extract ZIP on client side using JSZip
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      const files: Record<string, any> = {};
      
      // Process each CSV file in the ZIP
      for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir && filename.endsWith('.csv')) {
          const content = await zipEntry.async('text');
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) continue;
          
          const headers = lines[0]?.split(',').map(h => h.trim()) || [];
          const sampleRows = lines.slice(1, 6).map(line => 
            line.split(',').map(cell => cell.trim())
          );
          
          files[filename] = {
            headers,
            rowCount: lines.length - 1,
            sample: sampleRows
          };
        }
      }
      
      setFiles(files);
      toast.success(`Nalezeno ${Object.keys(files).length} datových souborů`);
    } catch (error: any) {
      console.error('Chyba při analýze:', error);
      toast.error("Nepodařilo se analyzovat archiv");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Analýza Runalyze zálohy
        </CardTitle>
        <CardDescription>
          Nahrajte kompletní GDPR export z Runalyze pro zjištění dostupných dat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => document.getElementById('backup-upload')?.click()}
            disabled={analyzing}
            variant="outline"
          >
            <Upload className="h-4 w-4 mr-2" />
            {analyzing ? "Analyzuji..." : "Vybrat ZIP soubor"}
          </Button>
          <input
            id="backup-upload"
            type="file"
            accept=".zip"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {files && (
          <div className="space-y-3 mt-4">
            <h3 className="font-semibold">Nalezené datové soubory:</h3>
            <div className="space-y-2">
              {Object.entries(files).map(([filename, info]: [string, any]) => (
                <div key={filename} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{filename}</span>
                    <Badge variant="secondary">{info.rowCount} záznamů</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="font-mono text-xs">
                      Sloupce: {info.headers.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!files && (
          <p className="text-sm text-muted-foreground">
            Nahrajte ZIP soubor s vaší Runalyze zálohou pro zobrazení dostupných dat
          </p>
        )}
      </CardContent>
    </Card>
  );
};
