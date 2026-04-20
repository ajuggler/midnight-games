import express from "express"

import { createGameRouter } from "./routes/gameRoutes"
import { sessionMiddleware } from "./session"

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(sessionMiddleware)
  app.use(createGameRouter())

  return app
}
