import { createIsomorphicFn } from "@tanstack/react-start";
import { clientShinigamiService } from "./services/shinigami.service.client";

/**
 * Netlify Functions cannot reach the upstream API (Cloudflare answers 403 to
 * that egress range), so browser requests go straight to the API while server
 * rendering keeps using the Redis-cached instance. The TanStack Start compiler
 * replaces this call with the matching implementation for each bundle, which
 * also keeps ioredis out of the client build.
 */
const getApi = createIsomorphicFn()
  .client(() => clientShinigamiService)
  .server(async () => {
    const { serverShinigamiService } = await import(
      "./services/shinigami.service.server"
    );
    return serverShinigamiService;
  });

export async function getComicRecomendation(opts: {
  data: { format: string };
}) {
  const api = await getApi();
  return { data: await api.getComicRecomendation(opts.data.format) };
}

export async function getComicUpdate(opts: {
  data: { type?: string; page?: number; pageSize?: number };
}) {
  const api = await getApi();
  return {
    data: await api.getComicUpdate(
      opts.data.type ?? "mirror",
      opts.data.page ?? 1,
      opts.data.pageSize ?? 16
    ),
  };
}

export async function getGenreList() {
  const api = await getApi();
  return { data: await api.getGenreList() };
}

export async function getPopularComic(opts: {
  data: { page?: number; pageSize?: number };
}) {
  const api = await getApi();
  return {
    data: await api.getPopularComic(
      opts.data.page ?? 1,
      opts.data.pageSize ?? 16
    ),
  };
}

export async function getComicDetail(opts: { data: { comicId: string } }) {
  const api = await getApi();
  return { data: await api.getComicDetail(opts.data.comicId) };
}

export async function getChapterList(opts: {
  data: { comicId: string; page?: number; pageSize?: number };
}) {
  const api = await getApi();
  return {
    data: await api.getChapterList(
      opts.data.comicId,
      opts.data.page ?? 1,
      opts.data.pageSize ?? 24
    ),
  };
}

export async function getChapterDetail(opts: { data: { chapterId: string } }) {
  const api = await getApi();
  return { data: await api.getChapterDetail(opts.data.chapterId) };
}

export async function getComicGenre(opts: { data: { genre: string } }) {
  const api = await getApi();
  return { data: await api.getComicGenre(opts.data.genre) };
}

export async function searchComicServer(opts: {
  data: { q: string; page?: number; pageSize?: number };
}) {
  const api = await getApi();
  return {
    data: await api.searchComic(
      opts.data.q,
      opts.data.page ?? 1,
      opts.data.pageSize ?? 12
    ),
  };
}
