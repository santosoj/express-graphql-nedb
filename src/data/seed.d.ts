import { AxiosInstance, AxiosResponse } from 'axios';
import { PlainTextHTMLField } from './store';
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
        plotShort: PlainTextHTMLField;
        plotFull: PlainTextHTMLField;
    };
}
export declare class IMDBClient {
    private baseURL;
    private apiKey;
    axios: AxiosInstance;
    defaultNumRequests: number;
    defaultRetryDelay: number;
    constructor(baseURL: string, apiKey: string);
    requestRetry<T>(path: string, numRequests?: number, retryDelay?: number): Promise<AxiosResponse<T, any>>;
    fetchData<T>(path: string): Promise<T | null>;
    searchMovie(searchString: string): Promise<SearchMovieData | null>;
    title(id: string): Promise<TitleData | null>;
}
declare function seed(reset?: boolean, doMergeIMDB?: boolean, doFetchIMDB?: boolean): Promise<void>;
export default seed;
