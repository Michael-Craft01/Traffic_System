import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'traffic123',
    database: 'traffic_syatem',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0

})