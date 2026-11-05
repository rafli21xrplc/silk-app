/** Sisipkan JSON-LD. Isi berasal dari objek yang kita bangun sendiri dan di-escape, bukan HTML pengguna. */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
