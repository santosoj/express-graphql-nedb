import { AxiosInstance, AxiosResponse } from 'axios';
import { PlainTextHTMLField } from 'uncanon-types';
interface SearchMovieData {
    results: {
        id: string;
        resultType: string;
        image: string;
        title: string;
        description: string;
    }[];
}
interface TitleData {
    originalTitle: string;
    image: string;
    plot: string;
    directors: string;
    writers: string;
    stars: string;
    wikipedia: {
        url: string;
        plotShort: PlainTextHTMLField;
        plotFull: PlainTextHTMLField;
    };
}
declare class APIClient {
    private baseURL;
    axios: AxiosInstance;
    defaultNumRequests: number;
    defaultRetryDelay: number;
    constructor(baseURL: string);
    requestRetry<T>(path: string, numRequests?: number, retryDelay?: number): Promise<AxiosResponse<T, any>>;
    fetchData<T>(path: string): Promise<T | null>;
}
export declare class IMDBClient extends APIClient {
    private apiKey;
    constructor(baseURL: string, apiKey: string);
    searchMovie(searchString: string): Promise<SearchMovieData | null>;
    title(id: string): Promise<TitleData | null>;
}
export declare class WikipediaClient extends APIClient {
    summary(title: string): Promise<object | null>;
}
export declare function mergeWikipediaData(doFetch?: boolean): Promise<void>;
export interface SeedOptions {
    reset: boolean;
    doMergeIMDB: boolean;
    doFetchIMDB: boolean;
    doMergeWikipedia: boolean;
    doFetchWikipedia: boolean;
    doFetchImages: boolean;
}
declare function seed({ reset, doMergeIMDB, doFetchIMDB, doMergeWikipedia, doFetchWikipedia, doFetchImages, }: SeedOptions): Promise<void>;
export default seed;
