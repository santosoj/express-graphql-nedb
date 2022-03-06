import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import Axios, { AxiosInstance, AxiosResponse } from 'axios'
import db, { Director, Film, PlainTextHTMLField } from './store'

const MAXINT32 = 0x7fffffff

interface SearchMovieData {
  results: {
    id: string
    resultType: string
    image: string
    title: string
    description: string
  }[]
}

interface TitleData {
  originalTitle: string
  image: string
  plot: string
  directors: string
  writers: string
  stars: string
  wikipedia: {
    plotShort: PlainTextHTMLField
    plotFull: PlainTextHTMLField
  }
}

export class IMDBClient {
  axios: AxiosInstance
  defaultNumRequests: number
  defaultRetryDelay: number

  constructor(private baseURL: string, private apiKey: string) {
    this.axios = Axios.create({
      baseURL: baseURL,
      timeout: 10_000,
    })
    this.defaultNumRequests = 3
    this.defaultRetryDelay = 3_000
  }

  async requestRetry<T>(
    path: string,
    numRequests?: number,
    retryDelay?: number
  ): Promise<AxiosResponse<T, any>> {
    let exception: unknown
    for (let i = 0; i < (numRequests || this.defaultNumRequests); i++) {
      if (i > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, retryDelay || this.defaultRetryDelay)
        })
      }
      try {
        const res = await this.axios.get<T>(path)
        return res
      } catch (ex) {
        exception = ex
      }
    }
    throw exception
  }

  async fetchData<T>(path: string): Promise<T | null> {
    try {
      const res = await this.requestRetry<T>(path)
      return res.data
    } catch (ex) {
      console.log(ex)
      return null
    }
  }

  async searchMovie(searchString: string): Promise<SearchMovieData | null> {
    return await this.fetchData(
      `/SearchMovie/${this.apiKey}/${encodeURIComponent(searchString)}`
    )
  }

  async title(id: string): Promise<TitleData | null> {
    return await this.fetchData(`/Title/${this.apiKey}/${id}/Wikipedia`)
  }
}

async function mergeIMDBData(doFetch: boolean = false) {
  const apiBase = process.env.IMDB_API_BASE
  const apiKey = process.env.IMDB_API_KEY
  let client: IMDBClient
  let searchMovieResults: { [key: number]: object } = {}
  let titleResults: { [key: number]: object } = {}
  if (apiBase && apiKey) {
    client = new IMDBClient(apiBase, apiKey)
    const films: Film[] = await db.films.find({})

    // Fetch SearchMovie data.
    //
    if (doFetch) {
      console.log('Fetching SearchMovie data...')
      for (let film of films) {
        try {
          const result = await client.searchMovie(`${film.title} ${film.year}`)
          if (result) {
            searchMovieResults[film._id] = result
          }
        } catch (ex) {
          console.log(ex)
        }
      }
      fs.writeFileSync(
        __dirname +
          process.env.NEDB_PERSISTENCE_DIRECTORY +
          '/searchMovieResults.json',
        JSON.stringify(searchMovieResults)
      )
    }

    let json = JSON.parse(
      fs
        .readFileSync(
          __dirname +
            process.env.NEDB_PERSISTENCE_DIRECTORY +
            '/searchMovieResults.json'
        )
        .toString('utf-8')
    )

    // Flag incorrect results.
    //
    console.log('SearchMovie data flagged as incorrect:')
    for (let filmID in json) {
      const result = json[filmID]
      if (result.results.length !== 1) {
        console.log(`\t[${filmID}]: ${result.results.length} results`)
      }
    }
    console.log('\t(END)\n')

    // Update DB with IMDB IDs.
    //
    for (let filmID in json) {
      const result = json[filmID]
      await db.films.update(
        { _id: Number(filmID) },
        { $set: { imdbID: result.results[0].id } }
      )
    }

    // Fetch Title data.
    //
    if (doFetch) {
      console.log('Fetching Title data...')
      for (let film of films) {
        try {
          const result = await client.title(film.imdbID)
          if (result) {
            titleResults[film._id] = result
          }
        } catch (ex) {
          console.log(ex)
        }
      }
      fs.writeFileSync(
        __dirname +
          process.env.NEDB_PERSISTENCE_DIRECTORY +
          '/titleResults.json',
        JSON.stringify(titleResults)
      )
    }

    json = JSON.parse(
      fs
        .readFileSync(
          __dirname +
            process.env.NEDB_PERSISTENCE_DIRECTORY +
            '/titleResults.json'
        )
        .toString('utf-8')
    )

    // Flag incorrect results.
    //
    console.log('Titledata flagged as incorrect:')
    for (let filmID in json) {
      const result = json[filmID]
      if (
        typeof result.originalTitle !== 'string' ||
        typeof result.image !== 'string' ||
        typeof result.plot !== 'string' ||
        typeof result.directors !== 'string' ||
        typeof result.writers !== 'string' ||
        typeof result.stars !== 'string' ||
        typeof result.wikipedia?.plotShort?.plainText !== 'string' ||
        typeof result.wikipedia?.plotShort?.html !== 'string' ||
        typeof result.wikipedia?.plotFull?.plainText !== 'string' ||
        typeof result.wikipedia?.plotFull?.html !== 'string'
      ) {
        console.log(`\t${filmID}`)
      }
    }
    console.log('\t(END)\n')

    // Update DB with IMDB Title data.
    //
    for (let filmID in json) {
      const result = json[filmID]
      await db.films.update(
        { _id: Number(filmID) },
        {
          $set: {
            originalTitle: result.originalTitle,
            image: result.image,
            plot: result.plot,
            directorsText: result.directors,
            writers: result.writers,
            stars: result.stars,
            wikipedia: {
              plotShort: result.wikipedia.plotShort,
              plotFull: result.wikipedia.plotFull,
            },
          },
        }
      )
    }
  } else {
    throw new Error('IMDB_API_BASE, IMDB_API_KEY missing from env.')
  }
}

async function seed(
  reset: boolean = false,
  doMergeIMDB: boolean = false,
  doFetchIMDB: boolean = false
): Promise<void> {
  if (reset) {
    await db.reset()
    console.log('Existing DB files deleted.')
  }

  const existing = await db.directors.count({})
  if (existing === 0) {
    const directors = require('./directors.csv').map((d: any) => ({
      ...d,
      deathYear: d.deathYear || MAXINT32,
    }))
    db.directors.insert(directors)
    console.log(`Inserted ${await db.directors.count({})} directors.`)

    const films = require('./films.csv').map((f: any) => ({
      ...f,
      directors: eval(f.directors),
    }))
    db.films.insert(films)
    console.log(`Inserted ${await db.films.count({})} films.`)
  } else {
    console.log(
      `Not inserting: found ${await db.directors.count({})} directors.`
    )
  }

  if (doMergeIMDB) {
    await mergeIMDBData(doFetchIMDB)
  }
}

export default seed
