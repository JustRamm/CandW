import { FileText, ImageIcon, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

function DocChip({ docId }) {
  const { data } = useQuery({
    queryKey: ["doc", docId],
    queryFn: () => apiGet(`/uploads/${docId}/meta`),
    retry: false,
    staleTime: Infinity,
  });
  const isImage = data?.content_type?.startsWith("image/");
  return (
    <a
      href={`/api/uploads/${docId}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-secondary/50 px-2 py-1 text-xs transition-colors duration-150 hover:border-primary/50 hover:text-primary"
      data-testid="document-chip"
    >
      {isImage ? <ImageIcon className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
      <span className="truncate">{data?.filename ?? "Document"}</span>
      {data?.geo && (
        <span className="mono-label inline-flex items-center gap-0.5 text-sky-400">
          <MapPin className="size-3" />
          {data.geo}
        </span>
      )}
    </a>
  );
}

export default function DocumentList({ docIds = [], emptyText = "No documents" }) {
  if (!docIds.length) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="document-list">
      {docIds.map((id) => (
        <DocChip key={id} docId={id} />
      ))}
    </div>
  );
}
