const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.get('/', (req, res) => { res.send('AIOS V2 is running'); });
app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
module.exports = app;
