import mysql from 'mysql2/promise'

const dbConfig = {
  host: '127.0.0.1',       // This MUST be 127.0.0.1, not localhost
  user: 'root',
  password: 'traffic123',  // Verified correct
  database: 'traffic_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Singleto Pattern : Prevents "Too many Connections" error in Nextjs
declare global{
    var mysqlPool: mysql.Pool | undefined;
}

let pool: mysql.Pool;
if(!global.mysqlPool){
    global.mysqlPool = mysql.createPool(dbConfig);
}
pool = global.mysqlPool;

export {pool};