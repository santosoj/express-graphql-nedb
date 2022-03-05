import { AxiosInstance, AxiosResponse } from 'axios';
interface SearchMovieData {
    results: {
        id: string;
        resultType: string;
        image: string;
        title: string;
        description: string;
    }[];
}
export declare class IMDBClient {
    private baseURL;
    private apiKey;
    axios: AxiosInstance;
    defaultNumRequests: number;
    defaultRetryDelay: number;
    constructor(baseURL: string, apiKey: string);
    requestRetry<T>(path: string, numRequests?: number, retryDelay?: number): Promise<AxiosResponse<T, any>>;
    searchMovie(searchString: string): Promise<SearchMovieData | null>;
}
declare function seed(reset?: boolean): Promise<void>;
export default seed;
