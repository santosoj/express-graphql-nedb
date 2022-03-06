import Datastore from 'nedb-promises';
declare type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
export declare type PageURLField = {
    page: string;
};
export declare type PlainTextHTMLField = {
    plainText: string;
    html: string;
};
export interface OrderBy<T> {
    order: ('asc' | 'desc')[];
    fields: (keyof T & string)[];
}
export declare type PopulateOption<T extends {
    [key in P]: unknown[];
}, P extends keyof T> = {
    prop: P;
    dataStore: Datastore<Exclude<ArrayElement<T[P]>, number>>;
};
export declare type Director = {
    _id: number;
    name: string;
    lexKey: string;
    birthYear: number;
    deathYear?: number;
    thumbnail?: {
        source: string;
    };
    contentURLs: {
        desktop: PageURLField;
        mobile: PageURLField;
    };
    extract: string;
    extractHTML: string;
};
export declare type Film = {
    _id: number;
    title: string;
    directors: number[] | Director[];
    year: number;
    imdbID: string;
    originalTitle: string;
    image: string;
    plot: string;
    directorsText: string;
    writers: string;
    stars: string;
    wikipedia: {
        plotShort: PlainTextHTMLField;
        plotFull: PlainTextHTMLField;
    };
};
declare type CursorType = any;
interface DB {
    directors: Datastore<Director>;
    films: Datastore<Film>;
    reset: () => Promise<void>;
    populate: <T extends {
        [key in P]: T[P];
    }, P extends keyof T>(target: T, populateOptions: PopulateOption<T, P>[]) => Promise<T>;
    orderBy: <T, C extends CursorType>(cursor: C, orderBy?: OrderBy<T>) => Promise<C>;
}
declare const db: DB;
export default db;
