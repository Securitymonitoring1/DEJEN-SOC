import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfDocumentPreviewProps {
  file: Blob;
  title: string;
}

export const PdfDocumentPreview = ({ file, title }: PdfDocumentPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setPageWidth(Math.max(240, Math.min(1050, entry.contentRect.width - 40)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPageCount(0);
    setError("");
  }, [file]);

  return <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-[#e8ecef] p-4 sm:p-6" aria-label={`${title} PDF pages`}>
    <Document
      file={file}
      suspense={false}
      onLoadSuccess={({ numPages }) => setPageCount(numPages)}
      onLoadError={(loadError) => setError(loadError.message || "Could not render this PDF.")}
      loading={<p className="mx-auto max-w-xl rounded-md border border-black/10 bg-white p-5 text-center text-xs text-[#62686d]">Preparing PDF pages...</p>}
      error={<p role="alert" className="mx-auto max-w-xl rounded-md border border-red-200 bg-white p-5 text-center text-xs text-red-700">{error || "Could not render this PDF."}</p>}
      className="flex flex-col items-center gap-5"
    >
      {pageWidth > 0 && Array.from({ length: pageCount }, (_, index) => <div key={`${title}-page-${index + 1}`} className="pdf-paper overflow-hidden bg-white shadow-md ring-1 ring-black/10">
        <Page pageNumber={index + 1} width={pageWidth} renderTextLayer renderAnnotationLayer />
      </div>)}
    </Document>
  </div>;
};