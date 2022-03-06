import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import Axios, { AxiosInstance, AxiosResponse } from 'axios'
import db, { Director, Film, PageURLField, PlainTextHTMLField } from './store'

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

interface SummaryData {
  thumbnail?: {
    source: string
  }
  content_urls: {
    desktop: PageURLField
    mobile: PageURLField
  }
  extract: string
  extract_html: string
}

class APIClient {
  axios: AxiosInstance
  defaultNumRequests: number
  defaultRetryDelay: number

  constructor(private baseURL: string) {
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
      if (res.status === 200) {
        return res.data
      }
      console.log(`response.status=${res.status} (${res.statusText})`)
      return null
    } catch (ex) {
      console.log(ex)
      return null
    }
  }
}

export class IMDBClient extends APIClient {
  constructor(baseURL: string, private apiKey: string) {
    super(baseURL)
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

export class WikipediaClient extends APIClient {
  async summary(title: string): Promise<object | null> {
    return await this.fetchData(`/page/summary/${encodeURIComponent(title)}`)
  }
}

export async function mergeWikipediaData(doFetch: boolean = false) {
  if (!process.env.NEDB_PERSISTENCE_DIRECTORY) {
    throw new Error('NEDB_PERSISTENCE_DIRECTORY missing from env.')
  }

  const apiBase = process.env.WIKIPEDIA_API_BASE
  let summaryResults: { [key: number]: object } = {}
  if (apiBase) {
    const client = new WikipediaClient(apiBase)
    const directors: Director[] = await db.directors.find({})

    // Fetch Summary data.
    //
    if (doFetch) {
      console.log('Fetching Summary data...')
      for (let director of directors) {
        try {
          const result = await client.summary(`${director.name}`)
          if (result) {
            summaryResults[director._id] = result
          }
        } catch (ex) {
          console.log(ex)
        }
      }
      fs.writeFileSync(
        __dirname +
          process.env.NEDB_PERSISTENCE_DIRECTORY +
          '/summaryResults.json',
        JSON.stringify(summaryResults)
      )
    }

    let json = JSON.parse(
      fs
        .readFileSync(
          __dirname +
            process.env.NEDB_PERSISTENCE_DIRECTORY +
            '/summaryResults.json'
        )
        .toString('utf-8')
    )

    // Flag incorrect results.
    //
    console.log('Summary data flagged as incorrect:')
    for (let director of directors) {
      if (!json.hasOwnProperty(director._id)) {
        console.log(`\t${director._id} missing.`)
      }
    }
    for (let directorID in json) {
      const result = json[directorID]
      if (
        typeof result.content_urls?.desktop?.page !== 'string' ||
        typeof result.content_urls?.mobile?.page !== 'string' ||
        typeof result.extract !== 'string' ||
        typeof result.extract_html !== 'string'
      ) {
        console.log(`\t${directorID} malformed.`)
      }
    }
    console.log('\t(END)\n')

    // Update DB with Wikipedia Summary data.
    //
    for (let directorID in json) {
      const result = json[directorID]
      await db.directors.update(
        { _id: Number(directorID) },
        {
          $set: {
            thumbnail: result.thumbnail,
            contentURLs: {
              desktop: { page: result.content_urls.desktop.page },
              mobile: { page: result.content_urls.mobile.page },
            },
            extract: result.extract,
            extractHTML: result.extract_html,
          },
        }
      )
    }
  } else {
    throw new Error('WIKIPEDIA_API_BASE missing from env.')
  }
}

async function mergeIMDBData(doFetch: boolean = false) {
  if (!process.env.NEDB_PERSISTENCE_DIRECTORY) {
    throw new Error('NEDB_PERSISTENCE_DIRECTORY missing from env.')
  }

  const apiBase = process.env.IMDB_API_BASE
  const apiKey = process.env.IMDB_API_KEY
  let searchMovieResults: { [key: number]: object } = {}
  let titleResults: { [key: number]: object } = {}
  if (apiBase && apiKey) {
    const client = new IMDBClient(apiBase, apiKey)
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
    console.log('Title data flagged as incorrect:')
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

export interface SeedOptions {
  reset: boolean
  doMergeIMDB: boolean
  doFetchIMDB: boolean
  doMergeWikipedia: boolean
  doFetchWikipedia: boolean
}

async function seed({
  reset,
  doMergeIMDB,
  doFetchIMDB,
  doMergeWikipedia,
  doFetchWikipedia,
}: SeedOptions): Promise<void> {
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

  if (doMergeWikipedia) {
    await mergeWikipediaData(doFetchWikipedia)
  }
}

export default seed
