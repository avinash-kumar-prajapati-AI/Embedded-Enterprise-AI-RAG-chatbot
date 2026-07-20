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
};

export default nextConfig;
