import fs from 'fs'
import Datastore from 'nedb-promises'
import path from 'path'
import { Director, Film } from 'uncanon-types'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type Databases = 'directors' | 'films'

const PERSISTENCE_FILE: { [name in Databases]: string } = {
  directors:
    __dirname + process.env.NEDB_PERSISTENCE_DIRECTORY + '/directors.db',
  films: __dirname + process.env.NEDB_PERSISTENCE_DIRECTORY + '/films.db',
}

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

export interface OrderBy<T> {
  order?: ('asc' | 'desc')[]
  fields?: (keyof T & string)[]
}

export type PopulateOption<
  T extends { [key in P]: unknown[] },
  P extends keyof T
> = {
  prop: P
  dataStore: Datastore<Exclude<ArrayElement<T[P]>, number>>
}

type CursorType = any // protectionist nedb-promises

interface DB {
  directors: Datastore<Director>
  films: Datastore<Film>
  reset: () => Promise<void>
  populate: <T extends { [key in P]: T[P] }, P extends keyof T>(
    target: T,
    populateOptions: PopulateOption<T, P>[]
  ) => Promise<T>
  orderBy: <T, C extends CursorType>(
    cursor: C,
    orderBy?: OrderBy<T>
  ) => Promise<C>
}

async function populateSingle<
  P extends keyof T,
  S,
  T extends { [key in P]: number[] | S[] }
>(target: T, prop: P, dataStore: Datastore<S>): Promise<void> {
  const ids = target[prop]
  const objects = await dataStore.find({ _id: { $in: ids } })
  Object.assign(target, { [prop]: objects })
}

async function populate<T extends { [key in P]: T[P] }, P extends keyof T>(
  target: T,
  populateOptions: PopulateOption<T, P>[]
): Promise<T> {
  for (let option of populateOptions) {
    await populateSingle(target, option.prop, option.dataStore)
  }
  return target
}

function toNeDBSortOpts<T>(orderBy: OrderBy<T>): { [key: string]: 1 | -1 } {
  if (orderBy.fields && orderBy.order) {
    const nedbSortOpts: { [key: string]: 1 | -1 } = {}
    for (let i = 0; i < orderBy.fields.length; i++) {
      nedbSortOpts[orderBy.fields[i]] = orderBy.order[i] === 'asc' ? 1 : -1
    }
    return nedbSortOpts
  }
  throw new Error('`fields` and `orders` must be defined.')
}

async function orderBy<T, C extends CursorType>(
  cursor: CursorType,
  orderBy?: OrderBy<T>
): Promise<C> {
  if (orderBy && orderBy.fields && orderBy.order) {
    return cursor.sort(toNeDBSortOpts(orderBy))
  }
  return cursor
}

async function resetDB(): Promise<void> {
  for (let path of Object.values(PERSISTENCE_FILE)) {
    await fs.unlink(path, (err) => {
      if (err) {
        console.log(err)
      }
    })
  }
}

const db: DB = {
  directors: Datastore.create({
    filename: PERSISTENCE_FILE.directors,
    autoload: true,
  }),
  films: Datastore.create({
    filename: PERSISTENCE_FILE.films,
    autoload: true,
  }),
  reset: resetDB,
  populate: populate,
  orderBy: orderBy,
}

export default db
