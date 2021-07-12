const express = require('express')
const app = express()
const port = 3000

app.use(express.static(__dirname + "/www/"));

app.get('/', (req, res) => {
  res.sendFile('www/chesstopia.html', {root: __dirname})
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})