import fs from "fs"
import path from "path"
import express from "express"

import { createGameRouter } from "./routes/gameRoutes"
import { sessionMiddleware } from "./session"

export function createApp() {
  const app = express()
  const frontendDistPath = path.resolve(__dirname, "../../frontend/dist")
  const frontendIndexPath = path.join(frontendDistPath, "index.html")

  app.use(express.json())
  app.use(sessionMiddleware)
  app.use(createGameRouter())
  app.use(express.static(frontendDistPath))
  app.get("*", (_req, res) => {
    if (!fs.existsSync(frontendIndexPath)) {
      return res.status(503).send(
        "Frontend build not found. Run `npm --prefix frontend install` and `npm --prefix frontend run build`."
      )
    }

    return res.sendFile(frontendIndexPath)
  })

  return app
}
