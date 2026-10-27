type Deliverable = { id: string; title: string; mimeType: string; markedInFile: boolean };

export function ManualDeliverableViewer({ file, reference }: { file: Deliverable; reference: string }) {
  const url = `/api/manual/files/${encodeURIComponent(file.id)}`;
  return <article className="card stack-sm">
    <h3>{file.title}</h3>
    <div style={{ position: "relative", width: "100%", minWidth: 0, overflow: "hidden" }}>
      {file.mimeType === "video/mp4" ? <video controls preload="metadata" src={url}
        controlsList="nodownload" style={{ display: "block", width: "100%", maxHeight: "60vh" }} /> :
        file.mimeType.startsWith("image/") ? <img src={url} alt={file.title}
          style={{ display: "block", width: "100%", maxHeight: "70vh", objectFit: "contain" }} /> :
          <iframe title={file.title} src={url} referrerPolicy="no-referrer" sandbox=""
            style={{ display: "block", width: "100%", minHeight: "55vh", border: 0 }} />}
      <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", maxWidth: "calc(100% - 1.5rem)",
        overflowWrap: "anywhere", padding: "0.4rem 0.65rem", background: "rgba(255,255,255,0.88)",
        color: "#30302d", borderRadius: "0.25rem", pointerEvents: "none", fontSize: "0.85rem" }}>
        Персонально для обращения {reference}
      </span>
    </div>
    <p className="muted">Материал доступен через ваш кабинет.
      {file.markedInFile ? " Персональная маркировка присутствует в файле." :
        " Номер обращения показан при просмотре; в сам файл эта маркировка не встроена."}</p>
  </article>;
}
