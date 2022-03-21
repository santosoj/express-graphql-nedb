import Datastore from 'nedb-promises';
import { Director, Film } from 'uncanon-types';
declare type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
export interface OrderBy<T> {
    order?: ('asc' | 'desc')[];
    fields?: (keyof T & string)[];
}
export declare type PopulateOption<T extends {
    [key in P]: unknown[];
}, P extends keyof T> = {
    prop: P;
    dataStore: Datastore<Exclude<ArrayElement<T[P]>, number>>;
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
