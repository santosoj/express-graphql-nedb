import Axios, { AxiosInstance, AxiosResponse } from 'axios'
import db, { Director, Film } from './store'

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

  async searchMovie(searchString: string): Promise<SearchMovieData | null> {
    try {
      const res = await this.requestRetry<SearchMovieData>(
        `/SearchMovie/${this.apiKey}/${searchString}`
      )
      return res.data
    } catch (ex) {
      console.log(ex)
      return null
    }
  }
}

async function seed(reset: boolean = false): Promise<void> {
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
}

export default seed
