import { createAxiosClient } from "@/common/http/axios.client";
import {
    ApiResponse,
    ApiResponseDetail,
    ChapterDetail,
    ChapterList,
    Comic,
    ComicDetail,
    PopularComic,
    TaxonomyItem,
    UpdateComic,
} from "@/common/interface";
import { client } from "@/common/libs/redis";
import { getEnv } from "@/common/utils/env";
import { AxiosInstance } from "axios";

const API_FALLBACK = "https://api.shinigami.io/v1";
const SITE_URL = "https://s1.shinigami.mx";
const CACHE_VERSION = "v2";
const TAXONOMY_PAGE_SIZE = 100;
const CHAPTER_FETCH_LIMIT = 2000;

type RawMeta = Partial<{
    request_id: string;
    timestamp: number;
    process_time: string;
    page: number;
    page_size: number;
    total_page: number;
    total_record: number;
    total_data: number;
    offset: number;
    limit: number;
    has_next: boolean;
    next_cursor: string | null;
}>;

type RawApiResponse<T> = {
    retcode?: number;
    message?: string;
    meta?: RawMeta;
    data?: T[] | T;
};

type ListContext = {
    page?: number;
    pageSize?: number;
    totalRecord?: number;
    hasNext?: boolean;
};

class ShinigamiService {
    private client: AxiosInstance;

    constructor() {
        this.client = createAxiosClient(API_FALLBACK, SITE_URL);
    }

    private get apiUrl(): string {
        const raw = (getEnv().API_URL || API_FALLBACK).replace(/\/+$/, "");
        // The v2 API only exists on api.shinigami.io. A stale API_URL from an
        // older deployment points at the retired host and answers 403.
        if (!/^https:\/\/api(?:-dev)?\.shinigami\.io(?:\/v1)?$/.test(raw)) {
            return API_FALLBACK;
        }
        return raw.endsWith("/v1") ? raw : `${raw}/v1`;
    }

    private key(...parts: Array<string | number>): string {
        return `sg:${CACHE_VERSION}:${parts.join(":")}`;
    }

    private async safeGetCache<T>(key: string): Promise<T | null> {
        try {
            const cached = await client.get(key);
            if (cached) {
                return JSON.parse(cached) as T;
            }
        } catch (e) {
            console.warn(`[Redis Cache Error] GET ${key}:`, e);
        }
        return null;
    }

    private async safeSetCache(key: string, data: unknown, ttlSeconds: number): Promise<void> {
        try {
            await client.set(key, JSON.stringify(data), "EX", ttlSeconds);
        } catch (e) {
            console.warn(`[Redis Cache Error] SET ${key}:`, e);
        }
    }

    private normalizeListResponse<T>(
        resp: RawApiResponse<T> | null | undefined,
        context: ListContext = {}
    ): ApiResponse<T> {
        const data = Array.isArray(resp?.data) ? resp.data : [];
        const page = Math.max(1, context.page ?? 1);
        const pageSize = Math.max(1, context.pageSize ?? (data.length || 24));
        const hasNext = context.hasNext ?? resp?.meta?.has_next === true;
        const totalRecord =
            context.totalRecord ?? (page - 1) * pageSize + data.length;
        const totalPage =
            context.totalRecord !== undefined
                ? Math.max(1, Math.ceil(context.totalRecord / pageSize))
                : hasNext
                    ? page + 1
                    : page;

        return {
            retcode: resp?.retcode ?? 0,
            message: resp?.message ?? "OK",
            meta: {
                request_id: resp?.meta?.request_id ?? "",
                timestamp: resp?.meta?.timestamp ?? Date.now(),
                process_time: resp?.meta?.process_time ?? "0ms",
                page,
                page_size: pageSize,
                total_page: totalPage,
                total_record: totalRecord,
                offset: resp?.meta?.offset ?? (page - 1) * pageSize,
                limit: resp?.meta?.limit ?? pageSize,
                has_next: hasNext,
                next_cursor: resp?.meta?.next_cursor ?? null,
            },
            data,
        };
    }

    private emptyListResponse<T>(page = 1, pageSize = 24): ApiResponse<T> {
        return this.normalizeListResponse<T>(null, {
            page,
            pageSize,
            totalRecord: 0,
            hasNext: false,
        });
    }

    public async getComicRecomendation(format: string) {
        const cacheKey = this.key("comic_recomendation", format);
        const cached = await this.safeGetCache<ApiResponse<Comic>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const res = await this.client.get<RawApiResponse<Comic>>(
            `${this.apiUrl}/manga/list`,
            {
                params: {
                    format,
                    limit: 10,
                    is_recommended: true,
                    sort: "latest",
                    sort_order: "desc",
                },
            }
        );
        const normalized = this.normalizeListResponse(res.data, {
            page: 1,
            pageSize: 10,
        });
        if (normalized.data.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 604800); // 7 hari
        }
        return normalized;
    }

    public async getComicUpdate(type: string, page: number = 1, pageSize: number = 19) {
        const safePage = Math.max(1, Math.floor(page));
        const safePageSize = Math.max(1, Math.floor(pageSize));
        const cacheKey = this.key("comic_update", type, safePage, safePageSize);
        const cached = await this.safeGetCache<ApiResponse<UpdateComic>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const res = await this.client.get<RawApiResponse<UpdateComic>>(
            `${this.apiUrl}/manga/list`,
            {
                params: {
                    type,
                    offset: (safePage - 1) * safePageSize,
                    limit: safePageSize,
                    is_update: true,
                    sort: "latest",
                    sort_order: "desc",
                },
            }
        );
        const normalized = this.normalizeListResponse(res.data, {
            page: safePage,
            pageSize: safePageSize,
        });
        if (normalized.data.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 600); // 10 menit
        }
        return normalized;
    }

    public async getComicStatus(status: string) {
        const cacheKey = this.key("comic_status", status);
        const cached = await this.safeGetCache<ApiResponse<Comic>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const res = await this.client.get<RawApiResponse<Comic>>(
            `${this.apiUrl}/manga/list`,
            {
                params: {
                    offset: 0,
                    limit: 24,
                    status,
                    sort: "latest",
                    sort_order: "desc",
                },
            }
        );
        const normalized = this.normalizeListResponse(res.data, {
            page: 1,
            pageSize: 24,
        });
        if (normalized.data.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 86400); // 1 hari
        }
        return normalized;
    }

    public async getGenreList(): Promise<ApiResponse<TaxonomyItem>> {
        const cacheKey = this.key("genre_list");
        const cached = await this.safeGetCache<ApiResponse<TaxonomyItem>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const all: TaxonomyItem[] = [];
        let offset = 0;
        let lastMeta: RawMeta | undefined;

        for (let guard = 0; guard < 20; guard++) {
            const res = await this.client.get<RawApiResponse<TaxonomyItem>>(
                `${this.apiUrl}/taxonomy/list`,
                {
                    params: {
                        type: "genre",
                        offset,
                        limit: TAXONOMY_PAGE_SIZE,
                    },
                }
            );
            const batch = Array.isArray(res.data.data) ? res.data.data : [];
            all.push(...batch);
            lastMeta = res.data.meta;

            if (res.data.meta?.has_next !== true || batch.length === 0) break;
            offset += batch.length;
        }

        const normalized = this.normalizeListResponse(
            {
                retcode: 0,
                message: "OK",
                meta: {
                    ...lastMeta,
                    has_next: false,
                    next_cursor: null,
                    offset: 0,
                    limit: Math.max(1, all.length),
                },
                data: all,
            },
            {
                page: 1,
                pageSize: Math.max(1, all.length),
                totalRecord: all.length,
                hasNext: false,
            }
        );

        if (all.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 604800); // 7 hari
        }
        return normalized;
    }

    public async getComicGenre(genre: string) {
        const cacheKey = this.key("comic_genre", genre);
        const cached = await this.safeGetCache<ApiResponse<Comic>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const res = await this.client.get<RawApiResponse<Comic>>(
            `${this.apiUrl}/manga/list`,
            {
                params: {
                    offset: 0,
                    limit: 24,
                    genre,
                    sort: "latest",
                    sort_order: "desc",
                },
            }
        );
        const normalized = this.normalizeListResponse(res.data, {
            page: 1,
            pageSize: 24,
        });
        if (normalized.data.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 172800); // 2 hari
        }
        return normalized;
    }

    private async fetchTopPage(
        page: number,
        pageSize: number
    ): Promise<RawApiResponse<PopularComic>> {
        let cursor: string | undefined;
        let last: RawApiResponse<PopularComic> | undefined;

        for (let current = 1; current <= page; current++) {
            const res = await this.client.get<RawApiResponse<PopularComic>>(
                `${this.apiUrl}/manga/top`,
                {
                    params: {
                        filter: "all_time",
                        limit: pageSize,
                        ...(cursor ? { cursor } : {}),
                    },
                }
            );

            last = res.data;
            const nextCursor = res.data.meta?.next_cursor ?? undefined;

            if (!nextCursor) {
                if (current < page) {
                    return {
                        retcode: 0,
                        message: "OK",
                        meta: { has_next: false, limit: pageSize, offset: 0 },
                        data: [],
                    };
                }
                break;
            }

            cursor = nextCursor;
        }

        return (
            last ?? {
                retcode: 0,
                message: "OK",
                meta: { has_next: false, limit: pageSize, offset: 0 },
                data: [],
            }
        );
    }

    public async getPopularComic(page: number = 1, pageSize: number = 16) {
        const safePage = Math.max(1, Math.floor(page));
        const safePageSize = Math.max(1, Math.floor(pageSize));
        const cacheKey = this.key("popular_comic", safePage, safePageSize);
        const cached = await this.safeGetCache<ApiResponse<PopularComic>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const raw = await this.fetchTopPage(safePage, safePageSize);
        const normalized = this.normalizeListResponse(raw, {
            page: safePage,
            pageSize: safePageSize,
        });
        if (normalized.data.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 172800); // 2 hari
        }
        return normalized;
    }

    public async getComicDetail(comicId: string) {
        const cacheKey = this.key("comic_detail", comicId);
        const cached = await this.safeGetCache<ApiResponseDetail<ComicDetail>>(cacheKey);
        if (cached) return cached;

        const res = await this.client.get<ApiResponseDetail<ComicDetail>>(
            `${this.apiUrl}/manga/detail/${comicId}`
        );
        await this.safeSetCache(cacheKey, res.data, 7200); // 2 jam
        return res.data;
    }

    private async getAllChapters(comicId: string): Promise<ChapterList[]> {
        const cacheKey = this.key("chapter_all", comicId);
        const cached = await this.safeGetCache<ChapterList[]>(cacheKey);
        if (cached && Array.isArray(cached)) return cached;

        const all: ChapterList[] = [];
        let cursor: string | undefined;

        for (let guard = 0; guard < 10; guard++) {
            const res = await this.client.get<RawApiResponse<ChapterList>>(
                `${this.apiUrl}/chapter/${comicId}/list`,
                {
                    params: {
                        limit: CHAPTER_FETCH_LIMIT,
                        sort_by: "chapter_number",
                        sort_order: "desc",
                        ...(cursor ? { cursor } : {}),
                    },
                }
            );

            const batch = Array.isArray(res.data.data) ? res.data.data : [];
            all.push(...batch);

            const nextCursor = res.data.meta?.next_cursor ?? undefined;
            if (!nextCursor || batch.length === 0) break;
            cursor = nextCursor;
        }

        if (all.length > 0) {
            await this.safeSetCache(cacheKey, all, 3600); // 1 jam
        }
        return all;
    }

    public async getChapterList(comicId: string, page: number = 1, pageSize: number = 24) {
        const safePage = Math.max(1, Math.floor(page));
        const safePageSize = Math.max(1, Math.floor(pageSize));
        const all = await this.getAllChapters(comicId);

        const totalRecord = all.length;
        const totalPage = Math.max(1, Math.ceil(totalRecord / safePageSize));
        const effectivePage = Math.min(safePage, totalPage);
        const start = (effectivePage - 1) * safePageSize;
        const data = all.slice(start, start + safePageSize);

        return {
            retcode: 0,
            message: "OK",
            meta: {
                request_id: "",
                timestamp: Date.now(),
                process_time: "0ms",
                page: effectivePage,
                page_size: safePageSize,
                total_page: totalPage,
                total_record: totalRecord,
                offset: start,
                limit: safePageSize,
                has_next: effectivePage < totalPage,
                next_cursor: null,
            },
            data,
        };
    }

    public async getChapterDetail(chapterId: string) {
        const cacheKey = this.key("chapter_detail", chapterId);
        const cached = await this.safeGetCache<ApiResponseDetail<ChapterDetail>>(cacheKey);
        if (cached) return cached;

        const res = await this.client.get<ApiResponseDetail<ChapterDetail>>(
            `${this.apiUrl}/chapter/detail/${chapterId}`
        );
        await this.safeSetCache(cacheKey, res.data, 21600); // 6 jam
        return res.data;
    }

    public async searchComic(q: string, page: number = 1, pageSize: number = 12) {
        const query = q.trim();
        if (!query) {
            return this.emptyListResponse<Comic>(1, pageSize);
        }

        const safePage = Math.max(1, Math.floor(page));
        const safePageSize = Math.max(1, Math.floor(pageSize));
        const cacheKey = this.key(
            "comic_search",
            encodeURIComponent(query),
            safePage,
            safePageSize
        );
        const cached = await this.safeGetCache<ApiResponse<Comic>>(cacheKey);
        if (cached && Array.isArray(cached.data)) return cached;

        const res = await this.client.get<RawApiResponse<Comic>>(
            `${this.apiUrl}/manga/list`,
            {
                params: {
                    offset: (safePage - 1) * safePageSize,
                    limit: safePageSize,
                    q: query,
                },
            }
        );
        const normalized = this.normalizeListResponse(res.data, {
            page: safePage,
            pageSize: safePageSize,
        });
        if (normalized.data.length > 0) {
            await this.safeSetCache(cacheKey, normalized, 3600); // 1 jam
        }
        return normalized;
    }
}

export const shinigamiService = new ShinigamiService();
