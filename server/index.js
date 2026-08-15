import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDB, seedIfEmpty, saveDB } from './db.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import taskRoutes from './routes/tasks.js'
import supervisionRoutes from './routes/supervision.js'
import notificationRoutes from './routes/notifications.js'
import departmentRoutes from './routes/departments.js'
import moduleRoutes from './routes/modules.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/supervision', supervisionRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/modules', moduleRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

async function start() {
  try {
    await initDB()
    seedIfEmpty()
    app.listen(PORT, '0.0.0.0', () => {
      console.log('Server running at http://localhost:' + PORT)
      console.log('LAN access: http://172.16.20.6:' + PORT)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

process.on('SIGINT', () => { saveDB(); process.exit(0) })
process.on('SIGTERM', () => { saveDB(); process.exit(0) })

start()
