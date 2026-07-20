import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages do their own file/asset resolution at runtime (pdf.js's
  // worker script, ONNX runtime's native/wasm binaries) — bundling them
  // breaks that resolution, so they must run as plain Node `require`s
  // instead of being pulled into the Turbopack/webpack server bundle.
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
  // onnxruntime-node's native .node/.so binaries are required dynamically
  // (a constructed path per-platform), which Vercel's deployment file
  // tracer doesn't follow — without this, the file genuinely isn't
  // uploaded and loading it at runtime fails with "libonnxruntime.so.1:
  // cannot open shared object file".
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/onnxruntime-node/bin/**/*"],
  },
};

export default nextConfig;
