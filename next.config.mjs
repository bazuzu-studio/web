// Публичный URL S3/MinIO (например https://s3.otakuum.ru/media) — берётся при сборке,
// чтобы next/image разрешил картинки с этого хоста.
const s3PublicUrl = process.env.S3_PUBLIC_URL;
const s3Pattern = (() => {
  if (!s3PublicUrl) return null;
  try {
    const u = new URL(s3PublicUrl);
    return {
      protocol: u.protocol.replace(":", ""),
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
    };
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Минимальный самодостаточный сервер для Docker (.next/standalone)
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" }, // dev: картинки с localhost:*
      ...(s3Pattern ? [s3Pattern] : []),
    ],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          // Синхронно с ALLOWED_EMBED_HOSTS в src/lib/embed-allowlist.ts
          value:
            "frame-src 'self' kodikplayer.com embed.kinobox.ru video.collabs.ru;",
        },
      ],
    },
  ],
};

export default nextConfig;
