/**
 * Function that logs the time it takes to process requests 
 * 
 * @param req
 * @param res
 */
const requestLogging = (req, res, next) => {
  const startMillis = Date.now();
  const start = new Date(startMillis).toISOString();
  const startDate = start.substring(0, 10);
  const startTime = start.substring(11, 19);

  res.on("finish", () => {
    const elapsedMillis = Date.now() - startMillis;
    console.log(`${req.method} ${startDate} ${startTime} ${res.statusCode} ${req.originalUrl} (${elapsedMillis} ms)`);
  });

  next();
}

export default requestLogging;