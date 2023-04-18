/* File for useful functions to encourage DRY code */
const pool = require("../pgdb")

/* DRY secure postgreSQl query function */
/* Example of how to use: pgQuery("INSERT INTO users (username, age, number) VALUES ($1, $2, $3)", "usernameValue", 25, 42) */
async function pgQuery (query, ...inputs) {
    const pgQuery = {
        text: query,
        values: inputs
    }
    
    try {
        const queryResult = await pool.query(pgQuery)
        return queryResult
    } catch (err) {
        console.error('Error executing postgreSQL query:', err)
        return {error: `There has been an error performing this query: ${err}`}
    }
}


module.exports = {pgQuery}