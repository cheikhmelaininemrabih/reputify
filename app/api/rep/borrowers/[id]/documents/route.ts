import { NextResponse } from "next/server";
import { uploadDocument, documentsForBorrower } from "@/lib/documents";
import { attestationExplorerUrls } from "@/lib/attestation";
import { rdb } from "@/lib/rep-db";

// GET — this borrower's uploaded documents (metadata only — never the file bytes).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const docs = documentsForBorrower(params.id).map((d) => {
    const att = d.attestationSeq != null ? rdb.attestations[d.attestationSeq] : undefined;
    return {
      id: d.id, kind: d.kind, label: d.label, mime: d.mime, uploadedAt: d.uploadedAt,
      hash: d.hash, attestationSeq: d.attestationSeq,
      proof: att ? attestationExplorerUrls(att) : null,
      broadcast: att?.broadcast ?? false,
    };
  });
  return NextResponse.json({ documents: docs });
}

// POST — upload + encrypt-at-rest + anchor the hash. Body: { kind, label, fileBase64, mime }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { kind?: string; label?: string; fileBase64?: string; mime?: string };
    if (!body.kind || !body.label || !body.fileBase64 || !body.mime) {
      return NextResponse.json({ error: "kind, label, fileBase64 and mime are required" }, { status: 400 });
    }
    const doc = await uploadDocument(params.id, body.kind as any, body.label, body.fileBase64, body.mime);
    return NextResponse.json({ ok: true, document: { id: doc.id, kind: doc.kind, label: doc.label, attestationSeq: doc.attestationSeq } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
